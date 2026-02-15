/**
 * Receipt Book Types
 * Physical receipt book tracking for Ugandan schools
 *
 * Background: Many parents in Uganda still demand physical receipts.
 * Schools use pre-printed receipt books with sequential numbering.
 * This module tracks receipt book issuance, usage, and reconciliation.
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// RECEIPT BOOK TYPES
// ============================================================================

/**
 * Represents a physical receipt book issued to a bursar
 */
export interface ReceiptBook {
  id: string;
  schoolId: string;

  // Book identification
  bookNumber: string; // e.g., "RB-2026-001"
  prefix: string; // e.g., "STMARY" for receipts like STMARY-001

  // Range of receipts in this book
  startNumber: number; // e.g., 1
  endNumber: number; // e.g., 100
  totalReceipts: number; // e.g., 100

  // Usage tracking
  currentNumber: number; // Next receipt number to issue
  usedCount: number; // How many have been issued
  voidedCount: number; // How many were voided/spoiled
  remainingCount: number; // How many are left

  // Assignment
  assignedTo: string; // User ID of assigned bursar
  assignedToName: string; // Display name
  assignedAt: Timestamp;
  assignedBy: string; // User ID who assigned

  // Status
  status: ReceiptBookStatus;

  // Dates
  activatedAt?: Timestamp; // When first receipt was issued
  completedAt?: Timestamp; // When last receipt was issued
  returnedAt?: Timestamp; // When book was returned (if applicable)

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  notes?: string;
}

export type ReceiptBookStatus =
  | "pending" // Created but not yet assigned
  | "assigned" // Assigned to a bursar but not yet used
  | "active" // Currently in use
  | "completed" // All receipts used
  | "returned" // Returned before completion
  | "archived"; // Old books kept for records

/**
 * Individual physical receipt record
 */
export interface PhysicalReceipt {
  id: string;
  schoolId: string;

  // Receipt identification
  receiptBookId: string;
  receiptNumber: string; // Full number: e.g., "STMARY-0042"
  sequenceNumber: number; // Sequential: e.g., 42

  // Link to digital payment
  paymentId?: string; // Link to Payment record

  // Receipt details (for standalone/reconciliation)
  studentId?: string;
  studentName: string;
  className: string;
  amount: number;
  amountInWords: string; // e.g., "Five Hundred Thousand Shillings Only"
  paymentMethod: string;
  paymentDate: Date;

  // For cash payments
  denominationBreakdown?: CashDenomination;

  // Status
  status: PhysicalReceiptStatus;
  voidReason?: string;

  // Issued by
  issuedBy: string;
  issuedByName: string;
  issuedAt: Timestamp;

  // Parent/Guardian who received
  receivedBy?: string; // Guardian name
  receivedByPhone?: string; // Guardian phone

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PhysicalReceiptStatus =
  | "issued" // Normal receipt issued
  | "voided" // Cancelled/spoiled
  | "duplicate" // Duplicate issued (original lost)
  | "unused"; // Reserved but not yet used

/**
 * Cash denomination tracking (for end-of-day reconciliation)
 */
export interface CashDenomination {
  notes50000: number; // 50,000 UGX notes
  notes20000: number; // 20,000 UGX notes
  notes10000: number; // 10,000 UGX notes
  notes5000: number; // 5,000 UGX notes
  notes2000: number; // 2,000 UGX notes
  notes1000: number; // 1,000 UGX notes
  coins500: number; // 500 UGX coins
  coins200: number; // 200 UGX coins
  coins100: number; // 100 UGX coins
  total: number; // Calculated total
}

// ============================================================================
// RECEIPT BOOK MANAGEMENT
// ============================================================================

/**
 * Request to create a new receipt book
 */
export interface CreateReceiptBookInput {
  schoolId: string;
  bookNumber: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  assignedTo?: string;
  notes?: string;
}

/**
 * Request to issue a receipt
 */
export interface IssueReceiptInput {
  receiptBookId: string;
  paymentId?: string;
  studentId?: string;
  studentName: string;
  className: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  receivedBy?: string;
  receivedByPhone?: string;
  denominationBreakdown?: CashDenomination;
  notes?: string;
}

/**
 * Receipt book summary for dashboard
 */
export interface ReceiptBookSummary {
  totalBooks: number;
  activeBooks: number;
  completedBooks: number;
  totalReceiptsIssued: number;
  totalVoided: number;
  bursarBreakdown: {
    bursarId: string;
    bursarName: string;
    activeBooks: number;
    receiptsIssued: number;
  }[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert number to words for receipt (UGX)
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return "Zero Shillings Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  function convertHundreds(num: number): string {
    let result = "";
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + " Hundred ";
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + " ";
      num %= 10;
    } else if (num >= 10) {
      result += teens[num - 10] + " ";
      return result.trim();
    }
    if (num > 0) {
      result += ones[num] + " ";
    }
    return result.trim();
  }

  function convert(num: number): string {
    if (num === 0) return "";

    let result = "";

    if (num >= 1000000) {
      result += convertHundreds(Math.floor(num / 1000000)) + " Million ";
      num %= 1000000;
    }

    if (num >= 1000) {
      result += convertHundreds(Math.floor(num / 1000)) + " Thousand ";
      num %= 1000;
    }

    if (num > 0) {
      result += convertHundreds(num);
    }

    return result.trim();
  }

  return convert(amount) + " Shillings Only";
}

/**
 * Calculate total from denomination breakdown
 */
export function calculateDenominationTotal(
  denom: Partial<CashDenomination>,
): number {
  return (
    (denom.notes50000 || 0) * 50000 +
    (denom.notes20000 || 0) * 20000 +
    (denom.notes10000 || 0) * 10000 +
    (denom.notes5000 || 0) * 5000 +
    (denom.notes2000 || 0) * 2000 +
    (denom.notes1000 || 0) * 1000 +
    (denom.coins500 || 0) * 500 +
    (denom.coins200 || 0) * 200 +
    (denom.coins100 || 0) * 100
  );
}

/**
 * Format receipt number with leading zeros
 */
export function formatReceiptNumber(
  prefix: string,
  sequenceNumber: number,
  padLength: number = 4,
): string {
  return `${prefix}-${sequenceNumber.toString().padStart(padLength, "0")}`;
}

/**
 * Validate receipt book range
 */
export function validateReceiptBookRange(
  startNumber: number,
  endNumber: number,
): { valid: boolean; error?: string } {
  if (startNumber < 1) {
    return { valid: false, error: "Start number must be at least 1" };
  }
  if (endNumber <= startNumber) {
    return {
      valid: false,
      error: "End number must be greater than start number",
    };
  }
  if (endNumber - startNumber > 500) {
    return {
      valid: false,
      error: "Receipt book cannot have more than 500 receipts",
    };
  }
  return { valid: true };
}

/**
 * Get receipt book status display info
 */
export function getReceiptBookStatusInfo(status: ReceiptBookStatus): {
  label: string;
  color: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
  icon: string;
} {
  const statusMap: Record<
    ReceiptBookStatus,
    {
      label: string;
      color: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
      icon: string;
    }
  > = {
    pending: { label: "Pending", color: "gray", icon: "hourglass_empty" },
    assigned: { label: "Assigned", color: "blue", icon: "person" },
    active: { label: "Active", color: "green", icon: "edit_note" },
    completed: { label: "Completed", color: "purple", icon: "check_circle" },
    returned: { label: "Returned", color: "yellow", icon: "assignment_return" },
    archived: { label: "Archived", color: "gray", icon: "archive" },
  };
  return statusMap[status];
}
