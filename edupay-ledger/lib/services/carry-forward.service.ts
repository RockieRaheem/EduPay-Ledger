/**
 * Carry-Forward Balance Service
 * Manages balance rollover between academic terms
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CarryForwardRecord,
  CarryForwardType,
  CarryForwardStatus,
  CarryForwardSummary,
  StudentTermBalance,
  TermTransitionConfig,
  ProcessCarryForwardInput,
  ManualCarryForwardInput,
  RefundRequest,
  getCarryForwardType,
  getNextTerm,
} from "@/types/carry-forward";

// ============================================================================
// CONSTANTS
// ============================================================================

const CARRY_FORWARDS_COLLECTION = "carryForwards";
const TERM_TRANSITIONS_COLLECTION = "termTransitions";
const REFUND_REQUESTS_COLLECTION = "refundRequests";
const STUDENTS_COLLECTION = "students";

// ============================================================================
// TERM TRANSITION MANAGEMENT
// ============================================================================

/**
 * Create a new term transition
 */
export async function createTermTransition(
  schoolId: string,
  fromTermId: string,
  fromTerm: number,
  fromYear: string,
  toTermId: string,
  toTerm: number,
  toYear: string,
  initiatedBy: string,
  config: Partial<TermTransitionConfig> = {},
): Promise<TermTransitionConfig> {
  const docRef = doc(collection(db, TERM_TRANSITIONS_COLLECTION));
  const now = Timestamp.now();

  const transition: TermTransitionConfig = {
    id: docRef.id,
    schoolId,
    fromTermId,
    fromTerm,
    fromYear,
    toTermId,
    toTerm,
    toYear,
    autoCarryForwardCredits: config.autoCarryForwardCredits ?? true,
    autoCarryForwardArrears: config.autoCarryForwardArrears ?? true,
    requireApprovalForCredits: config.requireApprovalForCredits ?? false,
    creditApprovalThreshold: config.creditApprovalThreshold ?? 1000000, // 1M UGX
    status: "draft",
    initiatedAt: now,
    initiatedBy,
  };

  await setDoc(docRef, transition);
  return transition;
}

/**
 * Get term transition by ID
 */
export async function getTermTransition(
  transitionId: string,
): Promise<TermTransitionConfig | null> {
  const docRef = doc(db, TERM_TRANSITIONS_COLLECTION, transitionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as TermTransitionConfig) : null;
}

/**
 * Get all term transitions for a school
 */
export async function getTermTransitions(
  schoolId: string,
): Promise<TermTransitionConfig[]> {
  const q = query(
    collection(db, TERM_TRANSITIONS_COLLECTION),
    where("schoolId", "==", schoolId),
    orderBy("initiatedAt", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as TermTransitionConfig);
}

// ============================================================================
// STUDENT BALANCE ANALYSIS
// ============================================================================

/**
 * Get all students with their end-of-term balances
 */
export async function getStudentTermBalances(
  schoolId: string,
  termId: string,
): Promise<StudentTermBalance[]> {
  const q = query(
    collection(db, STUDENTS_COLLECTION),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );

  const snapshot = await getDocs(q);
  const balances: StudentTermBalance[] = [];

  for (const doc of snapshot.docs) {
    const student = doc.data();
    const balance = student.totalFees - student.amountPaid;
    const type = getCarryForwardType(balance);

    balances.push({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      className: student.className,
      guardianName: student.guardian?.name || "",
      guardianPhone: student.guardian?.phone || "",
      termId,
      term: student.term,
      year: student.academicYear,
      totalFees: student.totalFees,
      totalPaid: student.amountPaid,
      balance,
      balanceType: type,
      carryForwardAmount: Math.abs(balance),
      hasOutstandingPromise: false, // TODO: Check promises collection
      lastPaymentDate: student.lastPaymentDate?.toDate(),
    });
  }

  return balances;
}

/**
 * Get students with credit balances (overpayments)
 */
export async function getStudentsWithCredits(
  schoolId: string,
  termId: string,
): Promise<StudentTermBalance[]> {
  const allBalances = await getStudentTermBalances(schoolId, termId);
  return allBalances.filter((b) => b.balanceType === "credit");
}

/**
 * Get students with arrears (underpayments)
 */
export async function getStudentsWithArrears(
  schoolId: string,
  termId: string,
): Promise<StudentTermBalance[]> {
  const allBalances = await getStudentTermBalances(schoolId, termId);
  return allBalances.filter((b) => b.balanceType === "arrears");
}

// ============================================================================
// CARRY-FORWARD PROCESSING
// ============================================================================

/**
 * Process carry-forwards for a term transition
 */
export async function processCarryForwards(
  input: ProcessCarryForwardInput,
  processedBy: string,
): Promise<{ processed: number; errors: string[] }> {
  const {
    schoolId,
    fromTermId,
    toTermId,
    processCredits,
    processArrears,
    studentIds,
  } = input;

  // Get student balances
  let balances = await getStudentTermBalances(schoolId, fromTermId);

  // Filter to specific students if provided
  if (studentIds && studentIds.length > 0) {
    balances = balances.filter((b) => studentIds.includes(b.studentId));
  }

  const errors: string[] = [];
  let processed = 0;
  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const balance of balances) {
    // Skip if balance is zero
    if (balance.balanceType === "cleared") continue;

    // Skip credits if not processing them
    if (balance.balanceType === "credit" && !processCredits) continue;

    // Skip arrears if not processing them
    if (balance.balanceType === "arrears" && !processArrears) continue;

    try {
      // Create carry-forward record
      const cfRef = doc(collection(db, CARRY_FORWARDS_COLLECTION));
      const nextTerm = getNextTerm(balance.term, balance.year);

      const carryForward: CarryForwardRecord = {
        id: cfRef.id,
        schoolId,
        studentId: balance.studentId,
        studentName: balance.studentName,
        className: balance.className,
        fromTermId,
        fromTerm: balance.term,
        fromYear: balance.year,
        toTermId,
        toTerm: nextTerm.term,
        toYear: nextTerm.year,
        balanceType: balance.balanceType as CarryForwardType,
        amount: balance.carryForwardAmount,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        createdBy: processedBy,
      };

      batch.set(cfRef, carryForward);
      processed++;
    } catch (err) {
      errors.push(`Failed to process ${balance.studentName}: ${err}`);
    }
  }

  if (processed > 0) {
    await batch.commit();
  }

  return { processed, errors };
}

/**
 * Apply carry-forward to a student's next term balance
 */
export async function applyCarryForward(
  carryForwardId: string,
  appliedBy: string,
): Promise<void> {
  const cfRef = doc(db, CARRY_FORWARDS_COLLECTION, carryForwardId);

  await runTransaction(db, async (transaction) => {
    const cfSnap = await transaction.get(cfRef);

    if (!cfSnap.exists()) {
      throw new Error("Carry-forward record not found");
    }

    const cf = cfSnap.data() as CarryForwardRecord;

    if (cf.status !== "pending") {
      throw new Error(`Cannot apply carry-forward with status: ${cf.status}`);
    }

    // Get the student
    const studentRef = doc(db, STUDENTS_COLLECTION, cf.studentId);
    const studentSnap = await transaction.get(studentRef);

    if (!studentSnap.exists()) {
      throw new Error("Student not found");
    }

    const student = studentSnap.data();
    const now = Timestamp.now();

    // Calculate new balance
    let newBalance = student.balance || 0;
    let newAmountPaid = student.amountPaid || 0;

    if (cf.balanceType === "credit") {
      // Credit reduces balance (increases amount paid conceptually)
      newBalance -= cf.amount;
      newAmountPaid += cf.amount;
    } else {
      // Arrears increases balance
      newBalance += cf.amount;
    }

    // Update student
    transaction.update(studentRef, {
      balance: newBalance,
      amountPaid: newAmountPaid,
      updatedAt: now,
    });

    // Update carry-forward status
    transaction.update(cfRef, {
      status: "applied",
      appliedAt: now,
      appliedBy,
      updatedAt: now,
    });
  });
}

/**
 * Void a carry-forward record
 */
export async function voidCarryForward(
  carryForwardId: string,
  reason: string,
  voidedBy: string,
): Promise<void> {
  const cfRef = doc(db, CARRY_FORWARDS_COLLECTION, carryForwardId);
  await updateDoc(cfRef, {
    status: "void",
    reason,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Create a manual carry-forward adjustment
 */
export async function createManualCarryForward(
  input: ManualCarryForwardInput,
  createdBy: string,
): Promise<CarryForwardRecord> {
  const docRef = doc(collection(db, CARRY_FORWARDS_COLLECTION));
  const now = Timestamp.now();

  // Get student info
  const studentRef = doc(db, STUDENTS_COLLECTION, input.studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) {
    throw new Error("Student not found");
  }

  const student = studentSnap.data();
  const nextTerm = getNextTerm(student.term, student.academicYear);

  const carryForward: CarryForwardRecord = {
    id: docRef.id,
    schoolId: student.schoolId,
    studentId: input.studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    className: student.className,
    fromTermId: input.fromTermId,
    fromTerm: student.term,
    fromYear: student.academicYear,
    toTermId: input.toTermId,
    toTerm: nextTerm.term,
    toYear: nextTerm.year,
    balanceType: input.balanceType,
    amount: input.amount,
    status: "pending",
    reason: input.reason,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  await setDoc(docRef, carryForward);
  return carryForward;
}

// ============================================================================
// CARRY-FORWARD QUERIES
// ============================================================================

/**
 * Get carry-forwards for a specific term transition
 */
export async function getCarryForwards(
  schoolId: string,
  fromTermId: string,
  status?: CarryForwardStatus,
): Promise<CarryForwardRecord[]> {
  let q = query(
    collection(db, CARRY_FORWARDS_COLLECTION),
    where("schoolId", "==", schoolId),
    where("fromTermId", "==", fromTermId),
    orderBy("createdAt", "desc"),
  );

  if (status) {
    q = query(q, where("status", "==", status));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as CarryForwardRecord);
}

/**
 * Get carry-forwards for a specific student
 */
export async function getStudentCarryForwards(
  studentId: string,
): Promise<CarryForwardRecord[]> {
  const q = query(
    collection(db, CARRY_FORWARDS_COLLECTION),
    where("studentId", "==", studentId),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as CarryForwardRecord);
}

/**
 * Get carry-forward summary for a term transition
 */
export async function getCarryForwardSummary(
  schoolId: string,
  fromTermId: string,
  toTermId: string,
): Promise<CarryForwardSummary> {
  const carryForwards = await getCarryForwards(schoolId, fromTermId);

  let totalCredits = 0;
  let creditsCount = 0;
  let creditsApplied = 0;
  let creditsPending = 0;

  let totalArrears = 0;
  let arrearsCount = 0;
  let arrearsApplied = 0;
  let arrearsPending = 0;

  const studentsWithCreditsSet = new Set<string>();
  const studentsWithArrearsSet = new Set<string>();

  for (const cf of carryForwards) {
    if (cf.balanceType === "credit") {
      totalCredits += cf.amount;
      creditsCount++;
      studentsWithCreditsSet.add(cf.studentId);
      if (cf.status === "applied") creditsApplied++;
      if (cf.status === "pending") creditsPending++;
    } else {
      totalArrears += cf.amount;
      arrearsCount++;
      studentsWithArrearsSet.add(cf.studentId);
      if (cf.status === "applied") arrearsApplied++;
      if (cf.status === "pending") arrearsPending++;
    }
  }

  // Get cleared students count
  const balances = await getStudentTermBalances(schoolId, fromTermId);
  const studentsCleared = balances.filter(
    (b) => b.balanceType === "cleared",
  ).length;

  return {
    transitionId: `${fromTermId}-${toTermId}`,
    fromTerm: fromTermId,
    toTerm: toTermId,
    totalCredits,
    creditsCount,
    creditsApplied,
    creditsPending,
    totalArrears,
    arrearsCount,
    arrearsApplied,
    arrearsPending,
    netPosition: totalCredits - totalArrears,
    studentsWithCredits: studentsWithCreditsSet.size,
    studentsWithArrears: studentsWithArrearsSet.size,
    studentsCleared,
  };
}

// ============================================================================
// REFUND MANAGEMENT
// ============================================================================

/**
 * Create a refund request for a credit balance
 */
export async function createRefundRequest(
  studentId: string,
  amount: number,
  reason: string,
  refundMethod: RefundRequest["refundMethod"],
  refundDetails: string,
  requestedBy: string,
): Promise<RefundRequest> {
  const docRef = doc(collection(db, REFUND_REQUESTS_COLLECTION));
  const now = Timestamp.now();

  // Get student info
  const studentRef = doc(db, STUDENTS_COLLECTION, studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) {
    throw new Error("Student not found");
  }

  const student = studentSnap.data();

  const request: RefundRequest = {
    id: docRef.id,
    schoolId: student.schoolId,
    studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    amount,
    reason,
    refundMethod,
    refundDetails,
    status: "pending",
    requestedBy,
    requestedAt: now,
  };

  await setDoc(docRef, request);
  return request;
}

/**
 * Approve a refund request
 */
export async function approveRefundRequest(
  requestId: string,
  approvedBy: string,
): Promise<void> {
  const docRef = doc(db, REFUND_REQUESTS_COLLECTION, requestId);
  await updateDoc(docRef, {
    status: "approved",
    approvedBy,
    approvedAt: Timestamp.now(),
  });
}

/**
 * Complete a refund request
 */
export async function completeRefundRequest(
  requestId: string,
  transactionReference: string,
  completedBy: string,
): Promise<void> {
  const docRef = doc(db, REFUND_REQUESTS_COLLECTION, requestId);
  await updateDoc(docRef, {
    status: "completed",
    transactionReference,
    completedBy,
    completedAt: Timestamp.now(),
  });
}

// ============================================================================
// MOCK DATA
// ============================================================================

export function getMockStudentTermBalances(): StudentTermBalance[] {
  return [
    {
      studentId: "stu-001",
      studentName: "Nakamya Grace",
      className: "S.4 Blue",
      guardianName: "Mrs. Nakamya",
      guardianPhone: "+256772123456",
      termId: "term-2026-1",
      term: 1,
      year: "2026",
      totalFees: 1500000,
      totalPaid: 1650000,
      balance: -150000, // Credit
      balanceType: "credit",
      carryForwardAmount: 150000,
      hasOutstandingPromise: false,
      lastPaymentDate: new Date("2026-04-15"),
    },
    {
      studentId: "stu-002",
      studentName: "Mugisha David",
      className: "S.3 Red",
      guardianName: "Mr. Mugisha Peter",
      guardianPhone: "+256701234567",
      termId: "term-2026-1",
      term: 1,
      year: "2026",
      totalFees: 1500000,
      totalPaid: 1200000,
      balance: 300000, // Arrears
      balanceType: "arrears",
      carryForwardAmount: 300000,
      hasOutstandingPromise: true,
      lastPaymentDate: new Date("2026-03-20"),
    },
    {
      studentId: "stu-003",
      studentName: "Apio Esther",
      className: "S.4 Blue",
      guardianName: "Mr. Francis Ocen",
      guardianPhone: "+256782345678",
      termId: "term-2026-1",
      term: 1,
      year: "2026",
      totalFees: 1500000,
      totalPaid: 1500000,
      balance: 0, // Cleared
      balanceType: "cleared",
      carryForwardAmount: 0,
      hasOutstandingPromise: false,
      lastPaymentDate: new Date("2026-04-01"),
    },
  ];
}

export function getMockCarryForwardSummary(): CarryForwardSummary {
  return {
    transitionId: "term-2026-1-to-term-2026-2",
    fromTerm: "Term 1, 2026",
    toTerm: "Term 2, 2026",
    totalCredits: 2450000,
    creditsCount: 12,
    creditsApplied: 8,
    creditsPending: 4,
    totalArrears: 5780000,
    arrearsCount: 28,
    arrearsApplied: 20,
    arrearsPending: 8,
    netPosition: -3330000, // Parents owe this much
    studentsWithCredits: 12,
    studentsWithArrears: 28,
    studentsCleared: 145,
  };
}
