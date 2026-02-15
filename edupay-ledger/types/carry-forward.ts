/**
 * Carry-Forward Balance Types
 * Manages positive/negative balance rollover between terms
 *
 * Background: In Ugandan schools, if a parent overpays in Term 1,
 * that credit should automatically reduce Term 2 fees.
 * Similarly, unpaid arrears carry forward as debt.
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// CARRY-FORWARD TYPES
// ============================================================================

/**
 * Represents a balance carry-forward record between terms
 */
export interface CarryForwardRecord {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  className: string;

  // Source term (where balance originated)
  fromTermId: string;
  fromTerm: number; // 1, 2, or 3
  fromYear: string; // "2026"

  // Destination term (where balance applies)
  toTermId: string;
  toTerm: number;
  toYear: string;

  // Balance details
  balanceType: CarryForwardType;
  amount: number; // Always positive (type determines credit/debit)

  // Application status
  status: CarryForwardStatus;
  appliedAt?: Timestamp;
  appliedBy?: string;

  // Notes
  reason?: string; // Why this carry-forward exists
  notes?: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type CarryForwardType =
  | "credit" // Overpayment - reduces next term fees
  | "arrears"; // Underpayment - adds to next term fees

export type CarryForwardStatus =
  | "pending" // Not yet applied to next term
  | "applied" // Applied to student's next term balance
  | "void" // Cancelled (e.g., student left)
  | "refunded"; // Credit was refunded instead of carried forward

/**
 * Term transition configuration
 */
export interface TermTransitionConfig {
  id: string;
  schoolId: string;

  // Term being closed
  fromTermId: string;
  fromTerm: number;
  fromYear: string;

  // Term being opened
  toTermId: string;
  toTerm: number;
  toYear: string;

  // Settings
  autoCarryForwardCredits: boolean; // Auto-apply overpayments
  autoCarryForwardArrears: boolean; // Auto-apply unpaid balances
  requireApprovalForCredits: boolean; // Need bursar approval for credits > threshold
  creditApprovalThreshold: number; // UGX amount requiring approval

  // Status
  status: TermTransitionStatus;

  // Audit
  initiatedAt: Timestamp;
  initiatedBy: string;
  completedAt?: Timestamp;
  completedBy?: string;
}

export type TermTransitionStatus =
  | "draft" // Planning stage
  | "in_progress" // Processing carry-forwards
  | "completed" // All done
  | "cancelled";

/**
 * Summary of carry-forwards for a term transition
 */
export interface CarryForwardSummary {
  transitionId: string;
  fromTerm: string;
  toTerm: string;

  // Credit summary (overpayments)
  totalCredits: number;
  creditsCount: number;
  creditsApplied: number;
  creditsPending: number;

  // Arrears summary (underpayments)
  totalArrears: number;
  arrearsCount: number;
  arrearsApplied: number;
  arrearsPending: number;

  // Net position
  netPosition: number; // Positive = school owes parents, Negative = parents owe school

  // Student breakdown
  studentsWithCredits: number;
  studentsWithArrears: number;
  studentsCleared: number; // Balance exactly zero
}

/**
 * Individual student balance at end of term
 */
export interface StudentTermBalance {
  studentId: string;
  studentName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;

  // Term details
  termId: string;
  term: number;
  year: string;

  // Financial position
  totalFees: number;
  totalPaid: number;
  balance: number; // Negative = credit, Positive = owes

  // Computed
  balanceType: CarryForwardType | "cleared";
  carryForwardAmount: number; // Absolute value to carry

  // Flags
  hasOutstandingPromise: boolean;
  lastPaymentDate?: Date;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for processing carry-forwards
 */
export interface ProcessCarryForwardInput {
  schoolId: string;
  fromTermId: string;
  toTermId: string;
  processCredits: boolean;
  processArrears: boolean;
  studentIds?: string[]; // If provided, only process these students
}

/**
 * Input for manual carry-forward adjustment
 */
export interface ManualCarryForwardInput {
  studentId: string;
  fromTermId: string;
  toTermId: string;
  balanceType: CarryForwardType;
  amount: number;
  reason: string;
  notes?: string;
}

/**
 * Refund request for credit balances
 */
export interface RefundRequest {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;

  amount: number;
  reason: string;

  // Refund method
  refundMethod: "cash" | "mobile_money" | "bank_transfer" | "cheque";
  refundDetails?: string; // Account number, MoMo number, etc.

  // Status
  status: "pending" | "approved" | "rejected" | "completed";

  // Approval
  requestedBy: string;
  requestedAt: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;

  // Completion
  completedAt?: Timestamp;
  completedBy?: string;
  transactionReference?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine carry-forward type from balance
 * Negative balance = credit (parent overpaid)
 * Positive balance = arrears (parent owes)
 */
export function getCarryForwardType(
  balance: number,
): CarryForwardType | "cleared" {
  if (balance < 0) return "credit";
  if (balance > 0) return "arrears";
  return "cleared";
}

/**
 * Format carry-forward for display
 */
export function formatCarryForward(
  type: CarryForwardType,
  amount: number,
): string {
  if (type === "credit") {
    return `Credit: UGX ${amount.toLocaleString()} (Overpayment)`;
  } else {
    return `Arrears: UGX ${amount.toLocaleString()} (Outstanding)`;
  }
}

/**
 * Get carry-forward status display info
 */
export function getCarryForwardStatusInfo(status: CarryForwardStatus): {
  label: string;
  color: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
  icon: string;
} {
  const statusMap: Record<
    CarryForwardStatus,
    {
      label: string;
      color: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
      icon: string;
    }
  > = {
    pending: { label: "Pending", color: "yellow", icon: "hourglass_empty" },
    applied: { label: "Applied", color: "green", icon: "check_circle" },
    void: { label: "Void", color: "gray", icon: "cancel" },
    refunded: { label: "Refunded", color: "blue", icon: "payments" },
  };
  return statusMap[status];
}

/**
 * Calculate next term from current
 */
export function getNextTerm(
  currentTerm: number,
  currentYear: string,
): { term: number; year: string } {
  if (currentTerm === 3) {
    return { term: 1, year: (parseInt(currentYear) + 1).toString() };
  }
  return { term: currentTerm + 1, year: currentYear };
}

/**
 * Format term for display
 */
export function formatTerm(term: number, year: string): string {
  return `Term ${term}, ${year}`;
}

/**
 * Validate carry-forward amount
 */
export function validateCarryForwardAmount(amount: number): {
  valid: boolean;
  error?: string;
} {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than zero" };
  }
  if (amount > 50000000) {
    // 50 million UGX cap
    return {
      valid: false,
      error: "Amount exceeds maximum allowed (UGX 50,000,000)",
    };
  }
  return { valid: true };
}
