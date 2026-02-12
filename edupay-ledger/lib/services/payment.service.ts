/**
 * Payment Service
 *
 * Handles all payment recording, validation, and ledger operations.
 * CRITICAL: This system does NOT process payments - it only RECORDS them.
 * Payments happen externally via Mobile Money, banks, or cash.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  increment,
} from "firebase/firestore";
import { db, initializeFirebase, COLLECTIONS } from "@/lib/firebase";
import { Payment, PaymentRecordInput, PaymentChannel } from "@/types/payment";
import { Student, InstallmentProgress } from "@/types/student";
import {
  anchorPaymentToStellar,
  queueForRetry,
  createPaymentHash,
  isStellarConfigured,
  type PaymentProof,
} from "@/lib/stellar";
import { anchorPayment as anchorPaymentWithDB } from "@/lib/services/stellar.service";
import { generateReceiptNumber, generatePaymentId } from "@/lib/utils";
import {
  sendPaymentReceiptSMS,
  sendPaymentReceiptEmail,
} from "@/lib/services/notification.service";
import { generateReceipt } from "@/lib/services/receipt.service";

export interface PaymentRecordResult {
  success: boolean;
  payment?: Payment;
  receipt?: {
    number: string;
    url?: string;
  };
  stellarTxHash?: string;
  stellarAnchorId?: string;
  error?: string;
}

export interface InstallmentApplicationResult {
  installmentId: string;
  installmentName: string;
  amountApplied: number;
  previouslyPaid: number;
  nowPaid: number;
  isCompleted: boolean;
}

/**
 * Records a payment for a student
 * This is the main entry point for recording fee payments
 *
 * Flow:
 * 1. Validate payment against installment rules
 * 2. Create payment record
 * 3. Update student balances
 * 4. Generate receipt
 * 5. Anchor to Stellar blockchain
 * 6. Send notifications
 */
export async function recordPayment(
  input: PaymentRecordInput,
  recordedByUserId: string,
  schoolId: string,
  sendSmsNotification: boolean = true,
): Promise<PaymentRecordResult> {
  initializeFirebase();

  try {
    // Use transaction to ensure data consistency
    const result = await runTransaction(db, async (transaction) => {
      // 1. Get student data
      const studentRef = doc(db, COLLECTIONS.STUDENTS, input.studentId);
      const studentDoc = await transaction.get(studentRef);

      if (!studentDoc.exists()) {
        throw new Error("Student not found");
      }

      const student = { id: studentDoc.id, ...studentDoc.data() } as Student;

      // 2. Validate payment
      const validation = validatePaymentAmount(student, input.amount);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // 3. Calculate installment application
      const installmentApplication = calculateInstallmentApplication(
        student.installmentProgress || [],
        input.amount,
      );

      // 4. Generate payment record
      const paymentId = generatePaymentId();
      const receiptNumber = generateReceiptNumber();
      const now = Timestamp.now();

      const payment: Payment = {
        id: paymentId,
        receiptNumber,
        transactionRef: input.transactionRef,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentClass: student.className,
        studentStream: student.streamName,
        schoolId,
        amount: input.amount,
        currency: "UGX",
        channel: input.channel,
        channelDetails: getChannelDetails(input.channel),
        installmentId: installmentApplication[0]?.installmentId || "",
        installmentName: installmentApplication
          .map((ia) => ia.installmentName)
          .join(", "),
        status: "cleared",
        stellarAnchored: false,
        recordedBy: recordedByUserId,
        recordedAt: now,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      };

      // 5. Update student installment progress
      const updatedInstallments = applyPaymentToInstallments(
        student.installmentProgress || [],
        installmentApplication,
      );

      const newAmountPaid = student.amountPaid + input.amount;
      const newBalance = student.totalFees - newAmountPaid;
      const newPaymentStatus =
        newBalance === 0
          ? "fully_paid"
          : newBalance < student.totalFees
            ? "partial"
            : "no_payment";

      // Find current installment (first non-completed)
      const currentInstallmentOrder =
        updatedInstallments.find((i) => i.status !== "completed")
          ?.installmentOrder || updatedInstallments.length;

      // 6. Write payment record
      const paymentRef = doc(db, COLLECTIONS.PAYMENTS, paymentId);
      transaction.set(paymentRef, payment);

      // 7. Update student record
      transaction.update(studentRef, {
        amountPaid: newAmountPaid,
        balance: newBalance,
        paymentStatus: newPaymentStatus,
        currentInstallment: currentInstallmentOrder,
        installmentProgress: updatedInstallments,
        lastPaymentDate: now,
        updatedAt: now,
      });

      return {
        payment,
        student,
        updatedInstallments,
        newBalance,
      };
    });

    // 8. Post-transaction operations (non-critical)

    // 8a. Anchor to Stellar blockchain (with persistent tracking)
    let stellarAnchorId: string | undefined;

    if (isStellarConfigured()) {
      const proof: PaymentProof = {
        paymentId: result.payment.id,
        studentId: result.student.id,
        schoolId,
        amount: result.payment.amount,
        currency: "UGX",
        timestamp: new Date().toISOString(),
        transactionRef: result.payment.transactionRef,
        receiptNumber: result.payment.receiptNumber,
      };

      try {
        // Use the enhanced database-backed anchoring service
        // This creates a persistent record and handles retries automatically
        const { anchor, result: anchorResult } = await anchorPaymentWithDB(
          proof,
          "high",
        );

        stellarAnchorId = anchor.id;

        if (anchorResult.success && anchorResult.txHash) {
          // Update payment with Stellar hash
          await updateDoc(doc(db, COLLECTIONS.PAYMENTS, result.payment.id), {
            stellarTxHash: anchorResult.txHash,
            stellarTimestamp: Timestamp.now(),
            stellarAnchored: true,
            stellarAnchorId: anchor.id,
          });
          result.payment.stellarTxHash = anchorResult.txHash;
          result.payment.stellarAnchored = true;
        } else {
          // Record is already queued for retry via anchorPaymentWithDB
          // Just store the anchor ID reference
          await updateDoc(doc(db, COLLECTIONS.PAYMENTS, result.payment.id), {
            stellarAnchorId: anchor.id,
            stellarAnchored: false,
          });
        }
      } catch (stellarError) {
        // Non-critical: log but don't fail the payment
        console.error("[Payment] Stellar anchoring error:", stellarError);
      }
    }

    // 8b. Generate receipt
    const receiptUrl = await generateReceipt({
      payment: result.payment,
      student: result.student,
      newBalance: result.newBalance,
    });

    // 8c. Send notifications
    if (sendSmsNotification && result.student.guardian?.phone) {
      await sendPaymentReceiptSMS({
        phoneNumber: result.student.guardian.phone,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        amount: result.payment.amount,
        balance: result.newBalance,
        receiptNumber: result.payment.receiptNumber,
      });
    }

    if (result.student.guardian?.email) {
      await sendPaymentReceiptEmail({
        email: result.student.guardian.email,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        amount: result.payment.amount,
        balance: result.newBalance,
        receiptNumber: result.payment.receiptNumber,
        receiptUrl,
      });
    }

    return {
      success: true,
      payment: result.payment,
      receipt: {
        number: result.payment.receiptNumber,
        url: receiptUrl,
      },
      stellarTxHash: result.payment.stellarTxHash,
      stellarAnchorId,
    };
  } catch (error: any) {
    console.error("Payment recording failed:", error);
    return {
      success: false,
      error: error.message || "Failed to record payment",
    };
  }
}

/**
 * Validates payment amount against student's balance and installment rules
 */
export function validatePaymentAmount(
  student: Student,
  amount: number,
): { isValid: boolean; message: string } {
  // Check if student has any balance
  if (student.balance <= 0) {
    return {
      isValid: false,
      message: "Student has no outstanding balance",
    };
  }

  // Check if amount exceeds balance
  if (amount > student.balance) {
    return {
      isValid: false,
      message: `Amount (${amount.toLocaleString()}) exceeds outstanding balance (${student.balance.toLocaleString()})`,
    };
  }

  // Check minimum payment (must not be zero or negative)
  if (amount <= 0) {
    return {
      isValid: false,
      message: "Payment amount must be greater than zero",
    };
  }

  // Check if current installment is unlocked
  const currentInstallment = (student.installmentProgress || []).find(
    (i) => i.status !== "completed" && i.isUnlocked,
  );

  if (!currentInstallment) {
    // Check if there's an installment that should be unlocked
    const nextInstallment = (student.installmentProgress || []).find(
      (i) => i.status !== "completed",
    );

    if (nextInstallment && !nextInstallment.isUnlocked) {
      return {
        isValid: false,
        message: `${nextInstallment.installmentName} is not yet unlocked. Previous installments must be completed first.`,
      };
    }
  }

  return { isValid: true, message: "Payment is valid" };
}

/**
 * Calculates how a payment amount will be applied across installments
 * Follows the rule: current installment must be completed before next
 */
export function calculateInstallmentApplication(
  installments: InstallmentProgress[],
  amount: number,
): InstallmentApplicationResult[] {
  const results: InstallmentApplicationResult[] = [];
  let remainingAmount = amount;

  // Sort by order
  const sortedInstallments = [...installments].sort(
    (a, b) => a.installmentOrder - b.installmentOrder,
  );

  for (const installment of sortedInstallments) {
    if (remainingAmount <= 0) break;
    if (installment.status === "completed") continue;

    const outstanding = installment.amountDue - installment.amountPaid;
    const toApply = Math.min(remainingAmount, outstanding);

    if (toApply > 0) {
      results.push({
        installmentId: installment.installmentId,
        installmentName: installment.installmentName,
        amountApplied: toApply,
        previouslyPaid: installment.amountPaid,
        nowPaid: installment.amountPaid + toApply,
        isCompleted: toApply >= outstanding,
      });
      remainingAmount -= toApply;
    }
  }

  return results;
}

/**
 * Applies payment to installments and returns updated installment array
 */
export function applyPaymentToInstallments(
  installments: InstallmentProgress[],
  applications: InstallmentApplicationResult[],
): InstallmentProgress[] {
  const now = Timestamp.now();

  const updatedInstallments: InstallmentProgress[] = installments.map(
    (installment) => {
      const application = applications.find(
        (a) => a.installmentId === installment.installmentId,
      );

      if (!application) return installment;

      const newAmountPaid = installment.amountPaid + application.amountApplied;
      const isCompleted = newAmountPaid >= installment.amountDue;

      return {
        ...installment,
        amountPaid: newAmountPaid,
        status: (isCompleted
          ? "completed"
          : "in_progress") as InstallmentProgress["status"],
        completedAt: isCompleted ? now : undefined,
      };
    },
  );

  // Unlock next installment if current is completed
  return updatedInstallments.map((installment, index, arr) => {
    if (index > 0) {
      const prevInstallment = arr[index - 1];
      if (prevInstallment.status === "completed") {
        return { ...installment, isUnlocked: true };
      }
    }
    return installment;
  });
}

/**
 * Gets display details for payment channel
 */
export function getChannelDetails(channel: PaymentChannel): string {
  const details: Record<PaymentChannel, string> = {
    momo_mtn: "MTN Mobile Money",
    momo_airtel: "Airtel Money",
    bank_transfer: "Bank Transfer",
    cash: "Cash Payment",
    cheque: "Cheque Payment",
    other: "Other Payment Method",
  };
  return details[channel] || "Unknown";
}

/**
 * Gets payment by ID
 */
export async function getPaymentById(
  paymentId: string,
): Promise<Payment | null> {
  initializeFirebase();

  const paymentDoc = await getDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId));
  if (!paymentDoc.exists()) return null;

  return { id: paymentDoc.id, ...paymentDoc.data() } as Payment;
}
