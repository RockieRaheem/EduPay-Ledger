/**
 * Bad Debt Write-off Types
 * Formal process for writing off uncollectable school fees
 *
 * Features:
 * - Multi-level approval workflow
 * - Documentation requirements
 * - BOG authorization tracking
 * - Tax/audit compliance
 * - Partial vs full write-off
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Write-off status in approval workflow
 */
export type WriteOffStatus =
  | "draft" // Created, not yet submitted
  | "pending_bursar" // Awaiting bursar review
  | "pending_head" // Awaiting headteacher approval
  | "pending_bog" // Awaiting BOG authorization (for amounts > threshold)
  | "approved" // Fully approved
  | "rejected" // Rejected at any stage
  | "applied" // Write-off applied to student account
  | "reversed"; // Write-off reversed (rare)

/**
 * Reason category for write-off
 */
export type WriteOffReason =
  | "orphaned" // Student is orphan, no guardian
  | "guardian_deceased" // Guardian passed away
  | "guardian_unable" // Guardian financially unable (documented)
  | "family_displaced" // Family displaced due to circumstances
  | "student_dropout" // Student dropped out mid-term
  | "student_transferred" // Student transferred without clearing
  | "student_deceased" // Student passed away
  | "disputed_fees" // Fee disputed and resolved for less
  | "administrative_error" // Fee was incorrectly charged
  | "scholarship_reversal" // Scholarship awarded retroactively
  | "hardship" // General financial hardship
  | "other"; // Other (requires explanation)

/**
 * Write-off type
 */
export type WriteOffType = "full" | "partial";

/**
 * Bad debt write-off request
 */
export interface BadDebtWriteOff {
  id: string;
  schoolId: string;

  // Student information
  studentId: string;
  studentName: string;
  className: string;
  guardianName: string;
  guardianPhone: string;

  // Current balances
  originalBalance: number;
  arrearsAmount: number; // Total past-due amount
  currentTermBalance: number;

  // Write-off details
  writeOffType: WriteOffType;
  writeOffAmount: number;
  remainingBalance: number; // After write-off

  // Reason and documentation
  reason: WriteOffReason;
  reasonDisplay: string;
  detailedExplanation: string;
  supportingDocuments: WriteOffDocument[];

  // Fee breakdown being written off
  feeBreakdown: WriteOffFeeItem[];

  // Collection attempts documentation
  collectionAttempts: CollectionAttempt[];
  totalCollectionAttempts: number;
  lastContactDate: Date | null;

  // Workflow
  status: WriteOffStatus;
  statusHistory: StatusChange[];
  currentApprover: string | null;

  // Approvals
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;

  bursarReview?: ApprovalRecord;
  headteacherApproval?: ApprovalRecord;
  bogAuthorization?: BOGAuthorizationRecord;

  // Application
  appliedAt?: Timestamp;
  appliedBy?: string;
  journalEntryId?: string; // Reference to accounting entry

  // Thresholds
  requiresBOGApproval: boolean; // Amount > BOG threshold
  bogThreshold: number; // School's BOG approval threshold

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fiscalYear: string;
  term: number;
}

/**
 * Document attached to write-off
 */
export interface WriteOffDocument {
  id: string;
  type:
    | "death_certificate"
    | "medical_report"
    | "police_report"
    | "lc_letter"
    | "social_worker_report"
    | "school_committee_minutes"
    | "guardian_statement"
    | "other";
  typeDisplay: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
  verified: boolean;
  verifiedBy?: string;
}

/**
 * Individual fee item being written off
 */
export interface WriteOffFeeItem {
  categoryId: string;
  categoryName: string;
  originalAmount: number;
  paidAmount: number;
  writeOffAmount: number;
  remainingAmount: number;
}

/**
 * Collection attempt record
 */
export interface CollectionAttempt {
  id: string;
  date: Date;
  type:
    | "phone_call"
    | "sms"
    | "home_visit"
    | "guardian_meeting"
    | "letter"
    | "payment_promise";
  typeDisplay: string;
  contactedBy: string;
  outcome:
    | "no_answer"
    | "promised"
    | "refused"
    | "unable"
    | "partial_payment"
    | "wrong_contact";
  outcomeDisplay: string;
  notes: string;
  promiseAmount?: number;
  promiseDate?: Date;
  promiseKept?: boolean;
}

/**
 * Status change record
 */
export interface StatusChange {
  from: WriteOffStatus;
  to: WriteOffStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Timestamp;
  reason?: string;
}

/**
 * Approval record
 */
export interface ApprovalRecord {
  approverId: string;
  approverName: string;
  approverRole: string;
  decision: "approved" | "rejected" | "returned";
  decisionAt: Timestamp;
  comments?: string;
  conditions?: string;
}

/**
 * BOG authorization record
 */
export interface BOGAuthorizationRecord extends ApprovalRecord {
  meetingDate: Date;
  meetingMinutesRef: string;
  boardResolutionNumber: string;
  votingRecord?: {
    inFavor: number;
    against: number;
    abstained: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * School's write-off policy configuration
 */
export interface WriteOffPolicyConfig {
  schoolId: string;

  // Approval thresholds
  bursarApprovalThreshold: number; // Below this, bursar can approve alone
  headteacherApprovalThreshold: number; // Below this, HT can approve
  bogApprovalThreshold: number; // Above this, requires BOG

  // Documentation requirements by reason
  requiredDocuments: Record<WriteOffReason, string[]>;

  // Minimum collection attempts before write-off
  minimumCollectionAttempts: number;
  minimumDaysOverdue: number;

  // Annual limits
  annualWriteOffBudget: number;
  annualWriteOffUsed: number;

  // Audit requirements
  requireJournalEntry: boolean;
  requireExternalAuditReview: boolean;

  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// INPUT/QUERY TYPES
// ============================================================================

export interface CreateWriteOffInput {
  schoolId: string;
  studentId: string;
  writeOffType: WriteOffType;
  writeOffAmount: number;
  reason: WriteOffReason;
  detailedExplanation: string;
  feeBreakdown: Omit<WriteOffFeeItem, "remainingAmount">[];
  requestedBy: string;
  requestedByName: string;
}

export interface WriteOffQuery {
  schoolId: string;
  status?: WriteOffStatus;
  reason?: WriteOffReason;
  studentId?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  pendingApproval?: boolean;
  limit?: number;
}

export interface WriteOffApprovalInput {
  writeOffId: string;
  approverId: string;
  approverName: string;
  approverRole: "bursar" | "headteacher" | "bog";
  decision: "approved" | "rejected" | "returned";
  comments?: string;
  conditions?: string;
  // For BOG only
  meetingDate?: Date;
  meetingMinutesRef?: string;
  boardResolutionNumber?: string;
}

// ============================================================================
// SUMMARY/REPORT TYPES
// ============================================================================

/**
 * Write-off summary for reporting
 */
export interface WriteOffSummary {
  schoolId: string;
  fiscalYear: string;
  asOfDate: Date;

  // Totals
  totalWriteOffsApproved: number;
  totalAmountWrittenOff: number;
  totalStudentsAffected: number;

  // By status
  byStatus: Record<WriteOffStatus, { count: number; amount: number }>;

  // By reason
  byReason: WriteOffByReason[];

  // By class
  byClass: WriteOffByClass[];

  // Budget tracking
  annualBudget: number;
  budgetUsedPercent: number;
  remainingBudget: number;

  // Trends
  monthlyTrend: MonthlyWriteOff[];
}

export interface WriteOffByReason {
  reason: WriteOffReason;
  reasonDisplay: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface WriteOffByClass {
  className: string;
  count: number;
  totalAmount: number;
  studentsAffected: number;
}

export interface MonthlyWriteOff {
  month: string;
  monthDisplay: string;
  count: number;
  amount: number;
  approvedCount: number;
  rejectedCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display name for write-off reason
 */
export function getReasonDisplay(reason: WriteOffReason): string {
  const displays: Record<WriteOffReason, string> = {
    orphaned: "Student Orphaned",
    guardian_deceased: "Guardian Deceased",
    guardian_unable: "Guardian Financially Unable",
    family_displaced: "Family Displaced",
    student_dropout: "Student Dropped Out",
    student_transferred: "Student Transferred",
    student_deceased: "Student Deceased",
    disputed_fees: "Fee Dispute Resolution",
    administrative_error: "Administrative Error",
    scholarship_reversal: "Scholarship Applied",
    hardship: "Financial Hardship",
    other: "Other",
  };
  return displays[reason];
}

/**
 * Get status display info
 */
export function getWriteOffStatusInfo(status: WriteOffStatus): {
  label: string;
  color: "gray" | "yellow" | "blue" | "green" | "red" | "purple";
  icon: string;
} {
  const info: Record<
    WriteOffStatus,
    {
      label: string;
      color: "gray" | "yellow" | "blue" | "green" | "red" | "purple";
      icon: string;
    }
  > = {
    draft: { label: "Draft", color: "gray", icon: "edit" },
    pending_bursar: {
      label: "Pending Bursar",
      color: "yellow",
      icon: "hourglass_empty",
    },
    pending_head: {
      label: "Pending Headteacher",
      color: "yellow",
      icon: "hourglass_empty",
    },
    pending_bog: { label: "Pending BOG", color: "blue", icon: "groups" },
    approved: { label: "Approved", color: "green", icon: "check_circle" },
    rejected: { label: "Rejected", color: "red", icon: "cancel" },
    applied: { label: "Applied", color: "purple", icon: "done_all" },
    reversed: { label: "Reversed", color: "red", icon: "undo" },
  };
  return info[status];
}

/**
 * Get required documents for reason
 */
export function getRequiredDocuments(reason: WriteOffReason): string[] {
  const requirements: Record<WriteOffReason, string[]> = {
    orphaned: ["lc_letter", "social_worker_report"],
    guardian_deceased: ["death_certificate", "lc_letter"],
    guardian_unable: ["guardian_statement", "lc_letter"],
    family_displaced: ["police_report", "lc_letter"],
    student_dropout: ["guardian_statement"],
    student_transferred: ["guardian_statement"],
    student_deceased: ["death_certificate"],
    disputed_fees: ["school_committee_minutes"],
    administrative_error: ["school_committee_minutes"],
    scholarship_reversal: ["school_committee_minutes"],
    hardship: ["guardian_statement", "lc_letter"],
    other: ["guardian_statement"],
  };
  return requirements[reason];
}

/**
 * Format write-off amount
 */
export function formatWriteOffAmount(amount: number): string {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

/**
 * Calculate approval level required
 */
export function getRequiredApprovalLevel(
  amount: number,
  config: WriteOffPolicyConfig,
): "bursar" | "headteacher" | "bog" {
  if (amount >= config.bogApprovalThreshold) return "bog";
  if (amount >= config.headteacherApprovalThreshold) return "headteacher";
  return "bursar";
}

/**
 * Check if write-off can be submitted
 */
export function canSubmitWriteOff(
  writeOff: BadDebtWriteOff,
  config: WriteOffPolicyConfig,
): { canSubmit: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check minimum collection attempts
  if (writeOff.totalCollectionAttempts < config.minimumCollectionAttempts) {
    reasons.push(
      `Minimum ${config.minimumCollectionAttempts} collection attempts required`,
    );
  }

  // Check required documents
  const requiredDocs = getRequiredDocuments(writeOff.reason);
  const uploadedTypes = writeOff.supportingDocuments.map((d) => d.type);
  const missingDocs = requiredDocs.filter(
    (d) => !uploadedTypes.includes(d as any),
  );
  if (missingDocs.length > 0) {
    reasons.push(`Missing required documents: ${missingDocs.join(", ")}`);
  }

  // Check explanation
  if (
    !writeOff.detailedExplanation ||
    writeOff.detailedExplanation.length < 50
  ) {
    reasons.push("Detailed explanation required (minimum 50 characters)");
  }

  return {
    canSubmit: reasons.length === 0,
    reasons,
  };
}

/**
 * Get document type display
 */
export function getDocumentTypeDisplay(type: WriteOffDocument["type"]): string {
  const displays: Record<WriteOffDocument["type"], string> = {
    death_certificate: "Death Certificate",
    medical_report: "Medical Report",
    police_report: "Police Report",
    lc_letter: "LC Letter",
    social_worker_report: "Social Worker Report",
    school_committee_minutes: "School Committee Minutes",
    guardian_statement: "Guardian Statement",
    other: "Other Document",
  };
  return displays[type];
}

/**
 * Get collection attempt type display
 */
export function getAttemptTypeDisplay(type: CollectionAttempt["type"]): string {
  const displays: Record<CollectionAttempt["type"], string> = {
    phone_call: "Phone Call",
    sms: "SMS",
    home_visit: "Home Visit",
    guardian_meeting: "Guardian Meeting",
    letter: "Letter Sent",
    payment_promise: "Payment Promise",
  };
  return displays[type];
}

/**
 * Get collection outcome display
 */
export function getOutcomeDisplay(
  outcome: CollectionAttempt["outcome"],
): string {
  const displays: Record<CollectionAttempt["outcome"], string> = {
    no_answer: "No Answer",
    promised: "Payment Promised",
    refused: "Payment Refused",
    unable: "Unable to Pay",
    partial_payment: "Partial Payment Made",
    wrong_contact: "Wrong Contact",
  };
  return displays[outcome];
}
