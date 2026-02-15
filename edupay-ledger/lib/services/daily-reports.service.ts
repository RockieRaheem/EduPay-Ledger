/**
 * Daily Reports Service
 * Generates daily cash summary and related reports for Headteacher
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
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DailyCashSummary,
  DailySummaryStatus,
  PaymentMethodTotal,
  ReceiptSummary,
  DailyStudentStats,
  DayComparison,
  TopPayment,
  GenerateDailySummaryInput,
  DailySummaryQuery,
  GuardianArrearsSummary,
  GuardianChildArrears,
  CollectionVsBudgetReport,
  CategoryBudgetActual,
  ClassBudgetActual,
  PreviousTermSummary,
  formatDailySummaryDate,
  calculateRiskLevel,
  calculateTrend,
} from "@/types/daily-reports";
import { CashDenomination } from "@/types/receipt-book";

// ============================================================================
// CONSTANTS
// ============================================================================

const DAILY_SUMMARIES_COLLECTION = "dailySummaries";
const PAYMENTS_COLLECTION = "payments";
const STUDENTS_COLLECTION = "students";

// ============================================================================
// DAILY CASH SUMMARY
// ============================================================================

/**
 * Generate daily cash summary for a specific date
 */
export async function generateDailyCashSummary(
  input: GenerateDailySummaryInput,
): Promise<DailyCashSummary> {
  const { schoolId, date, bursarId, remarks } = input;

  // Get date boundaries
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Query payments for the day
  const q = query(
    collection(db, PAYMENTS_COLLECTION),
    where("schoolId", "==", schoolId),
    where("recordedAt", ">=", Timestamp.fromDate(startOfDay)),
    where("recordedAt", "<=", Timestamp.fromDate(endOfDay)),
    orderBy("recordedAt", "desc"),
  );

  const snapshot = await getDocs(q);
  const payments = snapshot.docs.map((doc) => doc.data());

  // Calculate totals
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
  const transactionCount = payments.length;

  // Payment method breakdown
  const methodMap = new Map<string, { count: number; total: number }>();
  for (const payment of payments) {
    const method = payment.channel || "other";
    const existing = methodMap.get(method) || { count: 0, total: 0 };
    existing.count++;
    existing.total += payment.amount;
    methodMap.set(method, existing);
  }

  const paymentMethodBreakdown: PaymentMethodTotal[] = Array.from(
    methodMap.entries(),
  ).map(([method, data]) => ({
    method,
    methodDisplay: getPaymentMethodDisplay(method),
    icon: getPaymentMethodIcon(method),
    transactionCount: data.count,
    totalAmount: data.total,
    percentage:
      totalCollections > 0 ? (data.total / totalCollections) * 100 : 0,
  }));

  // Cash denomination (would come from physical receipts in real implementation)
  const cashDenomination: CashDenomination = {
    notes50000: 0,
    notes20000: 0,
    notes10000: 0,
    notes5000: 0,
    notes2000: 0,
    notes1000: 0,
    coins500: 0,
    coins200: 0,
    coins100: 0,
    total: 0,
  };

  // Get receipt summary (placeholder)
  const receiptSummary: ReceiptSummary = {
    booksUsed: [],
    totalReceiptsIssued: transactionCount,
    totalReceiptsVoided: 0,
  };

  // Student stats
  const uniqueStudents = new Set(payments.map((p) => p.studentId));
  const classMap = new Map<string, { count: number; total: number }>();
  for (const payment of payments) {
    const className = payment.studentClass || "Unknown";
    const existing = classMap.get(className) || { count: 0, total: 0 };
    existing.count++;
    existing.total += payment.amount;
    classMap.set(className, existing);
  }

  const studentStats: DailyStudentStats = {
    studentsWhoPaid: uniqueStudents.size,
    newFullPayments: 0, // Would need to check student records
    installmentPayments: transactionCount,
    classBreakdown: Array.from(classMap.entries()).map(([className, data]) => ({
      className,
      studentCount: data.count,
      totalCollected: data.total,
    })),
  };

  // Get previous day for comparison
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previousSummary = await getDailyCashSummary(schoolId, previousDate);

  const comparison: DayComparison = {
    previousDate,
    previousTotal: previousSummary?.totalCollections || 0,
    difference: totalCollections - (previousSummary?.totalCollections || 0),
    percentageChange: previousSummary?.totalCollections
      ? ((totalCollections - previousSummary.totalCollections) /
          previousSummary.totalCollections) *
        100
      : 0,
    trend: calculateTrend(
      totalCollections,
      previousSummary?.totalCollections || 0,
    ),
  };

  // Top payments
  const topPayments: TopPayment[] = payments
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((p) => ({
      studentId: p.studentId,
      studentName: p.studentName,
      className: p.studentClass,
      amount: p.amount,
      paymentMethod: getPaymentMethodDisplay(p.channel),
      time: p.recordedAt.toDate(),
      receiptNumber: p.receiptNumber,
    }));

  // Create summary
  const { dateString, displayDate } = formatDailySummaryDate(date);
  const now = Timestamp.now();
  const docRef = doc(collection(db, DAILY_SUMMARIES_COLLECTION));

  const summary: DailyCashSummary = {
    id: docRef.id,
    schoolId,
    date,
    dateString,
    displayDate,
    preparedBy: bursarId,
    preparedByName: "", // Would get from user record
    preparedAt: now,
    totalCollections,
    transactionCount,
    paymentMethodBreakdown,
    cashDenomination,
    receiptSummary,
    studentStats,
    comparison,
    topPayments,
    remarks,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, summary);
  return summary;
}

/**
 * Get daily cash summary for a specific date
 */
export async function getDailyCashSummary(
  schoolId: string,
  date: Date,
): Promise<DailyCashSummary | null> {
  const dateString = date.toISOString().split("T")[0];

  const q = query(
    collection(db, DAILY_SUMMARIES_COLLECTION),
    where("schoolId", "==", schoolId),
    where("dateString", "==", dateString),
    limit(1),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as DailyCashSummary;
}

/**
 * Get daily summaries for a date range
 */
export async function getDailySummaries(
  queryParams: DailySummaryQuery,
): Promise<DailyCashSummary[]> {
  let q = query(
    collection(db, DAILY_SUMMARIES_COLLECTION),
    where("schoolId", "==", queryParams.schoolId),
    orderBy("date", "desc"),
  );

  if (queryParams.dateFrom) {
    q = query(q, where("date", ">=", Timestamp.fromDate(queryParams.dateFrom)));
  }

  if (queryParams.dateTo) {
    q = query(q, where("date", "<=", Timestamp.fromDate(queryParams.dateTo)));
  }

  if (queryParams.status) {
    q = query(q, where("status", "==", queryParams.status));
  }

  if (queryParams.limit) {
    q = query(q, limit(queryParams.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as DailyCashSummary);
}

/**
 * Submit daily summary for approval
 */
export async function submitDailySummary(summaryId: string): Promise<void> {
  const docRef = doc(db, DAILY_SUMMARIES_COLLECTION, summaryId);
  await updateDoc(docRef, {
    status: "submitted",
    updatedAt: Timestamp.now(),
  });
}

/**
 * Approve daily summary (Headteacher)
 */
export async function approveDailySummary(
  summaryId: string,
  approvedBy: string,
  approvedByName: string,
): Promise<void> {
  const docRef = doc(db, DAILY_SUMMARIES_COLLECTION, summaryId);
  await updateDoc(docRef, {
    status: "approved",
    approvedBy,
    approvedByName,
    approvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// ARREARS BY GUARDIAN
// ============================================================================

/**
 * Get arrears grouped by guardian
 */
export async function getArrearsByGuardian(
  schoolId: string,
): Promise<GuardianArrearsSummary[]> {
  // Get all active students with arrears
  const q = query(
    collection(db, STUDENTS_COLLECTION),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
    where("balance", ">", 0),
  );

  const snapshot = await getDocs(q);
  const students = snapshot.docs.map((doc) => doc.data());

  // Group by guardian phone (as unique identifier)
  const guardianMap = new Map<string, GuardianArrearsSummary>();

  for (const student of students) {
    const guardianPhone = student.guardian?.phone || "unknown";
    const guardianName = student.guardian?.name || "Unknown Guardian";

    let guardianSummary = guardianMap.get(guardianPhone);

    if (!guardianSummary) {
      guardianSummary = {
        guardianName,
        guardianPhone,
        guardianEmail: student.guardian?.email,
        children: [],
        childCount: 0,
        totalFeesDue: 0,
        totalPaid: 0,
        totalArrears: 0,
        overdueCount: 0,
        hasPaymentPromise: false,
        riskLevel: "low",
      };
      guardianMap.set(guardianPhone, guardianSummary);
    }

    // Calculate days overdue (simplified)
    const daysOverdue = student.lastPaymentDate
      ? Math.floor(
          (Date.now() - student.lastPaymentDate.toMillis()) /
            (1000 * 60 * 60 * 24),
        )
      : 30; // Default 30 days if never paid

    const childArrears: GuardianChildArrears = {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      className: student.className,
      totalFees: student.totalFees,
      amountPaid: student.amountPaid,
      balance: student.balance,
      installmentStatus: daysOverdue > 14 ? "overdue" : "current",
      daysOverdue: Math.max(0, daysOverdue),
      lastPaymentDate: student.lastPaymentDate?.toDate(),
      lastPaymentAmount: undefined,
    };

    guardianSummary.children.push(childArrears);
    guardianSummary.childCount++;
    guardianSummary.totalFeesDue += student.totalFees;
    guardianSummary.totalPaid += student.amountPaid;
    guardianSummary.totalArrears += student.balance;

    if (daysOverdue > 14) {
      guardianSummary.overdueCount++;
    }
  }

  // Calculate risk levels
  const summaries = Array.from(guardianMap.values()).map((summary) => {
    const maxDaysOverdue = Math.max(
      ...summary.children.map((c) => c.daysOverdue),
    );
    summary.riskLevel = calculateRiskLevel(
      summary.totalArrears,
      summary.overdueCount,
      maxDaysOverdue,
    );
    return summary;
  });

  // Sort by risk level (critical first)
  const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return summaries.sort(
    (a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel],
  );
}

// ============================================================================
// COLLECTION VS BUDGET (BOG REPORT)
// ============================================================================

/**
 * Generate Collection vs Budget report for BOG
 */
export async function generateCollectionVsBudgetReport(
  schoolId: string,
  termId: string,
  preparedBy: string,
): Promise<CollectionVsBudgetReport> {
  // This would aggregate from fee structures, payments, and student records
  // Placeholder implementation

  const now = Timestamp.now();
  const docRef = doc(collection(db, "bogReports"));

  const report: CollectionVsBudgetReport = {
    id: docRef.id,
    schoolId,
    termId,
    term: 1,
    year: "2026",
    asOfDate: new Date(),
    totalBudgetedFees: 0,
    totalStudentsEnrolled: 0,
    totalCollected: 0,
    collectionRate: 0,
    categoryBreakdown: [],
    classBreakdown: [],
    varianceAnalysis: [],
    projectedEndOfTerm: 0,
    daysRemaining: 0,
    requiredDailyCollection: 0,
    previousTerms: [],
    preparedFor: "Board of Governors",
    preparedBy,
    preparedAt: now,
  };

  return report;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPaymentMethodDisplay(method: string): string {
  const displays: Record<string, string> = {
    cash: "Cash",
    momo_mtn: "MTN Mobile Money",
    momo_airtel: "Airtel Money",
    bank_transfer: "Bank Transfer",
    bank_deposit: "Bank Deposit",
    cheque: "Cheque",
    other: "Other",
  };
  return displays[method] || method;
}

function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    cash: "payments",
    momo_mtn: "smartphone",
    momo_airtel: "smartphone",
    bank_transfer: "account_balance",
    bank_deposit: "account_balance",
    cheque: "description",
    other: "receipt",
  };
  return icons[method] || "receipt";
}

// ============================================================================
// MOCK DATA
// ============================================================================

export function getMockDailyCashSummary(): DailyCashSummary {
  const today = new Date();
  const { dateString, displayDate } = formatDailySummaryDate(today);

  return {
    id: "daily-001",
    schoolId: "school-001",
    date: today,
    dateString,
    displayDate,
    preparedBy: "user-001",
    preparedByName: "Sarah Nambi",
    preparedAt: Timestamp.now(),
    totalCollections: 4750000,
    transactionCount: 12,
    paymentMethodBreakdown: [
      {
        method: "cash",
        methodDisplay: "Cash",
        icon: "payments",
        transactionCount: 5,
        totalAmount: 2350000,
        percentage: 49.5,
      },
      {
        method: "momo_mtn",
        methodDisplay: "MTN Mobile Money",
        icon: "smartphone",
        transactionCount: 4,
        totalAmount: 1600000,
        percentage: 33.7,
      },
      {
        method: "momo_airtel",
        methodDisplay: "Airtel Money",
        icon: "smartphone",
        transactionCount: 2,
        totalAmount: 600000,
        percentage: 12.6,
      },
      {
        method: "bank_transfer",
        methodDisplay: "Bank Transfer",
        icon: "account_balance",
        transactionCount: 1,
        totalAmount: 200000,
        percentage: 4.2,
      },
    ],
    cashDenomination: {
      notes50000: 35,
      notes20000: 25,
      notes10000: 30,
      notes5000: 10,
      notes2000: 0,
      notes1000: 0,
      coins500: 0,
      coins200: 0,
      coins100: 0,
      total: 2350000,
    },
    receiptSummary: {
      booksUsed: [
        {
          bookId: "rb-001",
          bookNumber: "RB-2026-001",
          startReceipt: "STMARY-0047",
          endReceipt: "STMARY-0058",
          receiptsIssued: 12,
          receiptsVoided: 0,
        },
      ],
      totalReceiptsIssued: 12,
      totalReceiptsVoided: 0,
    },
    studentStats: {
      studentsWhoPaid: 12,
      newFullPayments: 2,
      installmentPayments: 10,
      classBreakdown: [
        { className: "S.4 Blue", studentCount: 4, totalCollected: 1850000 },
        { className: "S.3 Red", studentCount: 3, totalCollected: 1200000 },
        { className: "S.2 Green", studentCount: 3, totalCollected: 1100000 },
        { className: "S.1 Yellow", studentCount: 2, totalCollected: 600000 },
      ],
    },
    comparison: {
      previousDate: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      previousTotal: 3200000,
      difference: 1550000,
      percentageChange: 48.4,
      trend: "up",
    },
    topPayments: [
      {
        studentId: "stu-001",
        studentName: "Nakamya Grace",
        className: "S.4 Blue",
        amount: 750000,
        paymentMethod: "Cash",
        time: today,
        receiptNumber: "STMARY-0058",
      },
      {
        studentId: "stu-005",
        studentName: "Okello James",
        className: "S.3 Red",
        amount: 650000,
        paymentMethod: "MTN Mobile Money",
        time: today,
        receiptNumber: "STMARY-0055",
      },
      {
        studentId: "stu-008",
        studentName: "Atim Sarah",
        className: "S.4 Blue",
        amount: 500000,
        paymentMethod: "Cash",
        time: today,
        receiptNumber: "STMARY-0052",
      },
    ],
    status: "submitted",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export function getMockGuardianArrears(): GuardianArrearsSummary[] {
  return [
    {
      guardianName: "Mr. Mukasa Peter",
      guardianPhone: "+256772123456",
      guardianEmail: "mukasa.peter@email.com",
      children: [
        {
          studentId: "stu-010",
          studentName: "Mukasa Brian",
          className: "S.4 Blue",
          totalFees: 1500000,
          amountPaid: 500000,
          balance: 1000000,
          installmentStatus: "overdue",
          daysOverdue: 45,
          lastPaymentDate: new Date("2025-12-15"),
          lastPaymentAmount: 500000,
        },
        {
          studentId: "stu-011",
          studentName: "Mukasa Faith",
          className: "S.2 Green",
          totalFees: 1200000,
          amountPaid: 400000,
          balance: 800000,
          installmentStatus: "overdue",
          daysOverdue: 45,
          lastPaymentDate: new Date("2025-12-15"),
          lastPaymentAmount: 400000,
        },
      ],
      childCount: 2,
      totalFeesDue: 2700000,
      totalPaid: 900000,
      totalArrears: 1800000,
      overdueCount: 2,
      hasPaymentPromise: true,
      lastPaymentDate: new Date("2025-12-15"),
      riskLevel: "high",
    },
    {
      guardianName: "Mrs. Nambi Rose",
      guardianPhone: "+256701234567",
      children: [
        {
          studentId: "stu-020",
          studentName: "Nambi Gloria",
          className: "S.3 Red",
          totalFees: 1500000,
          amountPaid: 1200000,
          balance: 300000,
          installmentStatus: "current",
          daysOverdue: 5,
          lastPaymentDate: new Date("2026-02-10"),
          lastPaymentAmount: 300000,
        },
      ],
      childCount: 1,
      totalFeesDue: 1500000,
      totalPaid: 1200000,
      totalArrears: 300000,
      overdueCount: 0,
      hasPaymentPromise: false,
      lastPaymentDate: new Date("2026-02-10"),
      riskLevel: "low",
    },
  ];
}

export function getMockCollectionVsBudget(): CollectionVsBudgetReport {
  return {
    id: "bog-001",
    schoolId: "school-001",
    termId: "term-2026-1",
    term: 1,
    year: "2026",
    asOfDate: new Date(),
    totalBudgetedFees: 285000000, // 285M UGX
    totalStudentsEnrolled: 190,
    totalCollected: 198750000, // 198.75M UGX
    collectionRate: 69.7,
    categoryBreakdown: [
      {
        categoryId: "cat-001",
        categoryName: "Tuition Fees",
        budgeted: 171000000,
        collected: 128250000,
        outstanding: 42750000,
        collectionRate: 75.0,
      },
      {
        categoryId: "cat-002",
        categoryName: "Exam Fees",
        budgeted: 38000000,
        collected: 30400000,
        outstanding: 7600000,
        collectionRate: 80.0,
      },
      {
        categoryId: "cat-003",
        categoryName: "Development Levy",
        budgeted: 57000000,
        collected: 31350000,
        outstanding: 25650000,
        collectionRate: 55.0,
      },
      {
        categoryId: "cat-004",
        categoryName: "Computer Lab",
        budgeted: 19000000,
        collected: 8750000,
        outstanding: 10250000,
        collectionRate: 46.1,
      },
    ],
    classBreakdown: [
      {
        classId: "class-s4",
        className: "S.4",
        studentCount: 45,
        budgeted: 67500000,
        collected: 52875000,
        outstanding: 14625000,
        collectionRate: 78.3,
        fullyPaidCount: 28,
        partialPaidCount: 12,
        noPaidCount: 5,
      },
      {
        classId: "class-s3",
        className: "S.3",
        studentCount: 50,
        budgeted: 75000000,
        collected: 55500000,
        outstanding: 19500000,
        collectionRate: 74.0,
        fullyPaidCount: 30,
        partialPaidCount: 15,
        noPaidCount: 5,
      },
      {
        classId: "class-s2",
        className: "S.2",
        studentCount: 48,
        budgeted: 72000000,
        collected: 50400000,
        outstanding: 21600000,
        collectionRate: 70.0,
        fullyPaidCount: 25,
        partialPaidCount: 18,
        noPaidCount: 5,
      },
      {
        classId: "class-s1",
        className: "S.1",
        studentCount: 47,
        budgeted: 70500000,
        collected: 39975000,
        outstanding: 30525000,
        collectionRate: 56.7,
        fullyPaidCount: 20,
        partialPaidCount: 17,
        noPaidCount: 10,
      },
    ],
    varianceAnalysis: [
      {
        description: "New enrollment below target",
        budgeted: 200,
        actual: 190,
        variance: -10,
        variancePercent: -5.0,
        explanation: "10 fewer students enrolled than projected",
      },
      {
        description: "Computer Lab fee uptake",
        budgeted: 19000000,
        actual: 8750000,
        variance: -10250000,
        variancePercent: -53.9,
        explanation: "Optional fee with low adoption",
      },
    ],
    projectedEndOfTerm: 242250000,
    daysRemaining: 45,
    requiredDailyCollection: 1916667, // ~1.9M per day to reach target
    previousTerms: [
      {
        termId: "term-2025-3",
        term: 3,
        year: "2025",
        totalBudgeted: 270000000,
        totalCollected: 248400000,
        collectionRate: 92.0,
        studentCount: 185,
      },
      {
        termId: "term-2025-2",
        term: 2,
        year: "2025",
        totalBudgeted: 265000000,
        totalCollected: 238500000,
        collectionRate: 90.0,
        studentCount: 183,
      },
    ],
    preparedFor: "Board of Governors",
    preparedBy: "Sarah Nambi (Bursar)",
    preparedAt: Timestamp.now(),
  };
}
