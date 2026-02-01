/**
 * Payments Firebase Service
 * Handles all payment-related database operations for eBursar
 */

import {
  db,
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  subscribeToCollection,
  batchWrite,
  logAuditAction,
  COLLECTIONS,
  Timestamp,
} from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  sum,
  average,
  getAggregateFromServer,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import type {
  Payment,
  PaymentChannel,
  PaymentRecordStatus,
} from "@/types/payment";
import { updateStudentBalance } from "./students.service";

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentFilters {
  schoolId: string;
  studentId?: string;
  termId?: string;
  status?: PaymentRecordStatus;
  channel?: PaymentChannel;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentStats {
  totalCollected: number;
  totalPending: number;
  transactionCount: number;
  averagePayment: number;
  todayCollections: number;
  thisMonthCollections: number;
}

export interface RecordPaymentInput {
  studentId: string;
  studentName: string;
  studentClass: string;
  studentStream?: string;
  schoolId: string;
  amount: number;
  channel: PaymentChannel;
  transactionRef: string;
  installmentId: string;
  installmentName: string;
  description?: string;
  receiptNumber?: string;
  notes?: string;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get a single payment by ID
 */
export async function getPayment(paymentId: string): Promise<Payment | null> {
  return fetchDocument<Payment>(COLLECTIONS.PAYMENTS, paymentId);
}

/**
 * Get all payments with optional filters
 */
export async function getPayments(
  filters: PaymentFilters,
  pagination?: { pageSize?: number; lastDoc?: DocumentData },
): Promise<{ payments: Payment[]; lastDoc: DocumentData | null }> {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", filters.schoolId),
  ];

  if (filters.studentId) {
    constraints.push(where("studentId", "==", filters.studentId));
  }

  if (filters.status) {
    constraints.push(where("status", "==", filters.status));
  }

  if (filters.channel) {
    constraints.push(where("channel", "==", filters.channel));
  }

  if (filters.dateFrom) {
    constraints.push(
      where("recordedAt", ">=", Timestamp.fromDate(filters.dateFrom)),
    );
  }

  if (filters.dateTo) {
    constraints.push(
      where("recordedAt", "<=", Timestamp.fromDate(filters.dateTo)),
    );
  }

  constraints.push(orderBy("recordedAt", "desc"));

  if (pagination?.pageSize) {
    constraints.push(limit(pagination.pageSize));
  }

  if (pagination?.lastDoc) {
    constraints.push(startAfter(pagination.lastDoc));
  }

  const payments = await fetchCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    constraints,
  );

  return {
    payments,
    lastDoc: payments.length > 0 ? payments[payments.length - 1] : null,
  };
}

/**
 * Record a new payment
 */
export async function recordPayment(
  input: RecordPaymentInput,
  userId: string,
): Promise<{ paymentId: string; receiptNumber: string }> {
  const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const receiptNumber = input.receiptNumber || generateReceiptNumber();

  const payment: Partial<Payment> = {
    id: paymentId,
    studentId: input.studentId,
    studentName: input.studentName,
    studentClass: input.studentClass,
    studentStream: input.studentStream,
    schoolId: input.schoolId,
    amount: input.amount,
    currency: "UGX",
    channel: input.channel,
    transactionRef: input.transactionRef,
    installmentId: input.installmentId,
    installmentName: input.installmentName,
    status: "pending",
    receiptNumber,
    stellarAnchored: false,
    notes: input.notes,
    recordedBy: userId,
    recordedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await saveDocument(COLLECTIONS.PAYMENTS, paymentId, payment);

  // Update student balance
  await updateStudentBalance(input.studentId, input.amount, "credit", userId);

  // Log audit
  await logAuditAction("CREATE", COLLECTIONS.PAYMENTS, paymentId, userId, {
    studentId: input.studentId,
    amount: input.amount,
    channel: input.channel,
    receiptNumber,
  });

  // Save receipt
  await saveDocument(COLLECTIONS.RECEIPTS, receiptNumber, {
    paymentId,
    studentId: input.studentId,
    studentName: input.studentName,
    amount: input.amount,
    channel: input.channel,
    installmentName: input.installmentName,
    issuedBy: userId,
    issuedAt: Timestamp.now(),
    schoolId: input.schoolId,
  });

  return { paymentId, receiptNumber };
}

/**
 * Verify/clear a payment
 */
export async function verifyPayment(
  paymentId: string,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.PAYMENTS, paymentId, {
    status: "cleared",
    verifiedAt: Timestamp.now(),
    verifiedBy: userId,
    updatedAt: Timestamp.now(),
  });

  await logAuditAction("VERIFY", COLLECTIONS.PAYMENTS, paymentId, userId, {
    action: "cleared",
  });
}

/**
 * Reverse a payment
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
  userId: string,
): Promise<void> {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "reversed")
    throw new Error("Payment already reversed");

  await updateDocument(COLLECTIONS.PAYMENTS, paymentId, {
    status: "reversed",
    reversedAt: Timestamp.now(),
    reversedBy: userId,
    reversalReason: reason,
    updatedAt: Timestamp.now(),
  });

  // Restore student balance
  await updateStudentBalance(
    payment.studentId,
    payment.amount,
    "debit",
    userId,
  );

  await logAuditAction("REVERSE", COLLECTIONS.PAYMENTS, paymentId, userId, {
    originalAmount: payment.amount,
    reason,
  });
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get payment statistics for a school
 */
export async function getPaymentStats(
  schoolId: string,
  termId?: string,
): Promise<PaymentStats> {
  const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);

  const baseConstraints = [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
  ];

  // Total collected
  const collectedQuery = query(paymentsRef, ...baseConstraints);
  const collectedSnapshot = await getAggregateFromServer(collectedQuery, {
    totalAmount: sum("amount"),
    avgAmount: average("amount"),
  });

  // Count separately
  const countSnapshot = await getCountFromServer(collectedQuery);

  // Pending payments
  const pendingQuery = query(
    paymentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "pending"),
  );
  const pendingSnapshot = await getAggregateFromServer(pendingQuery, {
    totalPending: sum("amount"),
  });

  // Today's collections
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayQuery = query(
    paymentsRef,
    ...baseConstraints,
    where("recordedAt", ">=", Timestamp.fromDate(today)),
  );
  const todaySnapshot = await getAggregateFromServer(todayQuery, {
    todayTotal: sum("amount"),
  });

  // This month's collections
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthQuery = query(
    paymentsRef,
    ...baseConstraints,
    where("recordedAt", ">=", Timestamp.fromDate(startOfMonth)),
  );
  const monthSnapshot = await getAggregateFromServer(monthQuery, {
    monthTotal: sum("amount"),
  });

  const collectedData = collectedSnapshot.data();
  const pendingData = pendingSnapshot.data();
  const todayData = todaySnapshot.data();
  const monthData = monthSnapshot.data();

  return {
    totalCollected: collectedData.totalAmount || 0,
    totalPending: pendingData.totalPending || 0,
    transactionCount: countSnapshot.data().count,
    averagePayment: collectedData.avgAmount || 0,
    todayCollections: todayData.todayTotal || 0,
    thisMonthCollections: monthData.monthTotal || 0,
  };
}

/**
 * Get collections by payment channel
 */
export async function getCollectionsByChannel(
  schoolId: string,
  termId?: string,
): Promise<Record<PaymentChannel, number>> {
  const channels: PaymentChannel[] = [
    "cash",
    "momo_mtn",
    "momo_airtel",
    "bank_transfer",
    "cheque",
    "other",
  ];
  const results: Record<string, number> = {};

  for (const channel of channels) {
    const constraints = [
      where("schoolId", "==", schoolId),
      where("status", "==", "cleared"),
      where("channel", "==", channel),
    ];

    const q = query(collection(db, COLLECTIONS.PAYMENTS), ...constraints);
    const snapshot = await getAggregateFromServer(q, {
      total: sum("amount"),
    });

    results[channel] = snapshot.data().total || 0;
  }

  return results as Record<PaymentChannel, number>;
}

/**
 * Get daily collections for a date range
 */
export async function getDailyCollections(
  schoolId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ date: string; amount: number }[]> {
  const payments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
    where("recordedAt", ">=", Timestamp.fromDate(startDate)),
    where("recordedAt", "<=", Timestamp.fromDate(endDate)),
    orderBy("recordedAt", "asc"),
  ]);

  // Group by date
  const dailyTotals: Record<string, number> = {};

  payments.forEach((payment) => {
    const date = payment.recordedAt.toDate().toISOString().split("T")[0];
    dailyTotals[date] = (dailyTotals[date] || 0) + payment.amount;
  });

  return Object.entries(dailyTotals).map(([date, amount]) => ({
    date,
    amount,
  }));
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to real-time payment updates
 */
export function subscribeToPayments(
  schoolId: string,
  onData: (payments: Payment[]) => void,
  onError?: (error: Error) => void,
  filters?: { studentId?: string; termId?: string },
): () => void {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    orderBy("recordedAt", "desc"),
    limit(50),
  ];

  if (filters?.studentId) {
    constraints.unshift(where("studentId", "==", filters.studentId));
  }

  return subscribeToCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    constraints,
    onData,
    onError,
  );
}

/**
 * Subscribe to today's payments in real-time
 */
export function subscribeToTodayPayments(
  schoolId: string,
  onData: (payments: Payment[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return subscribeToCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    [
      where("schoolId", "==", schoolId),
      where("recordedAt", ">=", Timestamp.fromDate(today)),
      orderBy("recordedAt", "desc"),
    ],
    onData,
    onError,
  );
}

// ============================================================================
// RECEIPTS
// ============================================================================

/**
 * Get receipt by number
 */
export async function getReceipt(receiptNumber: string) {
  return fetchDocument(COLLECTIONS.RECEIPTS, receiptNumber);
}

/**
 * Resend receipt via SMS
 */
export async function resendReceiptSMS(
  receiptNumber: string,
  phoneNumber: string,
  userId: string,
): Promise<void> {
  const receipt = await getReceipt(receiptNumber);
  if (!receipt) throw new Error("Receipt not found");

  // Log SMS attempt
  await saveDocument(COLLECTIONS.SMS_LOGS, `SMS-${Date.now()}`, {
    type: "receipt",
    receiptNumber,
    phoneNumber,
    status: "pending",
    createdAt: Timestamp.now(),
    createdBy: userId,
  });

  // Actual SMS sending would be done via Cloud Function
  // This just logs the request
}

// ============================================================================
// HELPERS
// ============================================================================

function generateReceiptNumber(): string {
  const prefix = "RCP";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Get student's payment history
 */
export async function getStudentPaymentHistory(
  studentId: string,
  limit_count: number = 50,
): Promise<Payment[]> {
  return fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("studentId", "==", studentId),
    where("status", "==", "cleared"),
    orderBy("recordedAt", "desc"),
    limit(limit_count),
  ]);
}

/**
 * Calculate outstanding fees for a student
 */
export async function calculateOutstandingFees(
  studentId: string,
  termId: string,
): Promise<{
  totalFees: number;
  totalPaid: number;
  balance: number;
}> {
  const payments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("studentId", "==", studentId),
    where("status", "==", "cleared"),
  ]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // For now, return simplified calculation
  // In production, this would fetch actual fee structure
  return {
    totalFees: 0, // Would come from fee structure
    totalPaid,
    balance: 0 - totalPaid, // Negative means overpaid
  };
}
