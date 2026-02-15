/**
 * Daily Cash Summary Types
 * Daily report that bursars hand to Headteacher each evening
 *
 * Features:
 * - Total collections by payment method
 * - Cash denomination breakdown
 * - Receipt number range used
 * - Comparison with previous day
 */

import { Timestamp } from "firebase/firestore";
import { CashDenomination } from "./receipt-book";

// ============================================================================
// DAILY SUMMARY TYPES
// ============================================================================

/**
 * Complete daily cash summary for Headteacher
 */
export interface DailyCashSummary {
  id: string;
  schoolId: string;

  // Date
  date: Date;
  dateString: string; // "2026-02-15"
  displayDate: string; // "Saturday, February 15, 2026"

  // Bursar who prepared
  preparedBy: string;
  preparedByName: string;
  preparedAt: Timestamp;

  // Collection totals
  totalCollections: number;
  transactionCount: number;

  // Breakdown by payment method
  paymentMethodBreakdown: PaymentMethodTotal[];

  // Cash denomination breakdown (for cash payments)
  cashDenomination: CashDenomination;

  // Receipt tracking
  receiptSummary: ReceiptSummary;

  // Student statistics
  studentStats: DailyStudentStats;

  // Comparison with previous day
  comparison: DayComparison;

  // Top payments (for highlighting)
  topPayments: TopPayment[];

  // Notes and remarks
  remarks?: string;

  // Approval status
  status: DailySummaryStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type DailySummaryStatus =
  | "draft" // Being prepared
  | "submitted" // Submitted for approval
  | "approved" // Approved by Headteacher
  | "revised"; // Sent back for revision

/**
 * Payment method totals
 */
export interface PaymentMethodTotal {
  method: string;
  methodDisplay: string; // "MTN Mobile Money"
  icon: string;
  transactionCount: number;
  totalAmount: number;
  percentage: number;
}

/**
 * Receipt tracking summary
 */
export interface ReceiptSummary {
  booksUsed: {
    bookId: string;
    bookNumber: string;
    startReceipt: string;
    endReceipt: string;
    receiptsIssued: number;
    receiptsVoided: number;
  }[];
  totalReceiptsIssued: number;
  totalReceiptsVoided: number;
  voidedDetails?: {
    receiptNumber: string;
    reason: string;
  }[];
}

/**
 * Student-related statistics
 */
export interface DailyStudentStats {
  studentsWhoPaid: number;
  newFullPayments: number; // Students who completed full payment today
  installmentPayments: number;
  classBreakdown: {
    className: string;
    studentCount: number;
    totalCollected: number;
  }[];
}

/**
 * Day-over-day comparison
 */
export interface DayComparison {
  previousDate: Date;
  previousTotal: number;
  difference: number;
  percentageChange: number;
  trend: "up" | "down" | "same";
}

/**
 * Top/notable payments
 */
export interface TopPayment {
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  paymentMethod: string;
  time: Date;
  receiptNumber: string;
}

// ============================================================================
// REPORT GENERATION TYPES
// ============================================================================

/**
 * Input for generating daily summary
 */
export interface GenerateDailySummaryInput {
  schoolId: string;
  date: Date;
  bursarId: string;
  remarks?: string;
}

/**
 * Historical summary query
 */
export interface DailySummaryQuery {
  schoolId: string;
  dateFrom?: Date;
  dateTo?: Date;
  bursarId?: string;
  status?: DailySummaryStatus;
  limit?: number;
}

// ============================================================================
// ARREARS BY GUARDIAN TYPES (for Feature 4)
// ============================================================================

/**
 * Guardian arrears summary (multiple children)
 */
export interface GuardianArrearsSummary {
  guardianId?: string; // Optional - may not have user account
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;

  // Children
  children: GuardianChildArrears[];
  childCount: number;

  // Totals
  totalFeesDue: number;
  totalPaid: number;
  totalArrears: number;

  // Status
  overdueCount: number; // How many children have overdue payments
  hasPaymentPromise: boolean;
  lastPaymentDate?: Date;

  // Risk level
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Individual child arrears within guardian summary
 */
export interface GuardianChildArrears {
  studentId: string;
  studentName: string;
  className: string;

  totalFees: number;
  amountPaid: number;
  balance: number;

  // Installment status
  currentInstallment?: string;
  installmentStatus: "current" | "overdue" | "paid";
  daysOverdue: number;

  // Last activity
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
}

// ============================================================================
// COLLECTION VS BUDGET TYPES (for Feature 5 - BOG Report)
// ============================================================================

/**
 * Collection vs Budget report (Board of Governors format)
 */
export interface CollectionVsBudgetReport {
  id: string;
  schoolId: string;

  // Period
  termId: string;
  term: number;
  year: string;
  asOfDate: Date;

  // Budget
  totalBudgetedFees: number;
  totalStudentsEnrolled: number;

  // Actual collection
  totalCollected: number;
  collectionRate: number; // Percentage

  // Breakdown by category
  categoryBreakdown: CategoryBudgetActual[];

  // Breakdown by class
  classBreakdown: ClassBudgetActual[];

  // Variance analysis
  varianceAnalysis: VarianceItem[];

  // Projections
  projectedEndOfTerm: number;
  daysRemaining: number;
  requiredDailyCollection: number;

  // Historical comparison
  previousTerms: TermComparison[];

  // Prepared for BOG
  preparedFor: string;
  preparedBy: string;
  preparedAt: Timestamp;
}

/**
 * Category budget vs actual
 */
export interface CategoryBudgetActual {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

/**
 * Class budget vs actual
 */
export interface ClassBudgetActual {
  classId: string;
  className: string;
  studentCount: number;
  budgeted: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  fullyPaidCount: number;
  partialPaidCount: number;
  noPaidCount: number;
}

/**
 * Variance item for analysis
 */
export interface VarianceItem {
  description: string;
  budgeted: number;
  actual: number;
  variance: number; // +ve = over, -ve = under
  variancePercent: number;
  explanation?: string;
}

/**
 * Term-over-term comparison
 */
export interface TermComparison {
  termId: string;
  term: number;
  year: string;
  totalBudgeted: number;
  totalCollected: number;
  collectionRate: number;
  studentCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for daily summary
 */
export function formatDailySummaryDate(date: Date): {
  dateString: string;
  displayDate: string;
} {
  const dateString = date.toISOString().split("T")[0];
  const displayDate = date.toLocaleDateString("en-UG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { dateString, displayDate };
}

/**
 * Get risk level for guardian arrears
 */
export function calculateRiskLevel(
  totalArrears: number,
  overdueCount: number,
  daysOverdue: number,
): "low" | "medium" | "high" | "critical" {
  if (totalArrears >= 5000000 || daysOverdue >= 60) return "critical";
  if (totalArrears >= 2000000 || daysOverdue >= 30) return "high";
  if (totalArrears >= 500000 || daysOverdue >= 14) return "medium";
  return "low";
}

/**
 * Get risk level display info
 */
export function getRiskLevelInfo(
  level: "low" | "medium" | "high" | "critical",
): {
  label: string;
  color: "green" | "yellow" | "orange" | "red";
  icon: string;
} {
  const levels = {
    low: { label: "Low Risk", color: "green" as const, icon: "check_circle" },
    medium: { label: "Medium Risk", color: "yellow" as const, icon: "warning" },
    high: { label: "High Risk", color: "orange" as const, icon: "error" },
    critical: { label: "Critical", color: "red" as const, icon: "dangerous" },
  };
  return levels[level];
}

/**
 * Calculate trend from comparison
 */
export function calculateTrend(
  current: number,
  previous: number,
): "up" | "down" | "same" {
  const threshold = 0.01; // 1% tolerance for "same"
  const change = (current - previous) / (previous || 1);
  if (change > threshold) return "up";
  if (change < -threshold) return "down";
  return "same";
}

/**
 * Get trend display info
 */
export function getTrendInfo(trend: "up" | "down" | "same"): {
  icon: string;
  color: "green" | "red" | "gray";
  label: string;
} {
  const trends = {
    up: { icon: "trending_up", color: "green" as const, label: "Increase" },
    down: { icon: "trending_down", color: "red" as const, label: "Decrease" },
    same: { icon: "trending_flat", color: "gray" as const, label: "No Change" },
  };
  return trends[trend];
}

/**
 * Get daily summary status display info
 */
export function getDailySummaryStatusInfo(status: DailySummaryStatus): {
  label: string;
  color: "gray" | "blue" | "green" | "yellow";
  icon: string;
} {
  const statuses = {
    draft: { label: "Draft", color: "gray" as const, icon: "edit" },
    submitted: { label: "Submitted", color: "blue" as const, icon: "send" },
    approved: {
      label: "Approved",
      color: "green" as const,
      icon: "check_circle",
    },
    revised: {
      label: "Needs Revision",
      color: "yellow" as const,
      icon: "refresh",
    },
  };
  return statuses[status];
}
