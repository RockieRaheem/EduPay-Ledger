/**
 * Bank Deposit Slip Types
 * Manage bank deposits and slip generation for schools
 *
 * Features:
 * - Deposit slip generation
 * - Multi-bank support (Stanbic, Centenary, dfcu, etc.)
 * - Cash denomination tracking
 * - Deposit reconciliation
 * - Slip number tracking
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Supported banks in Uganda
 */
export type UgandaBank =
  | "stanbic"
  | "centenary"
  | "dfcu"
  | "equity"
  | "absa"
  | "kcb"
  | "standard_chartered"
  | "bank_of_africa"
  | "housing_finance"
  | "ecobank"
  | "postbank"
  | "other";

/**
 * Deposit status
 */
export type DepositStatus =
  | "draft" // Being prepared
  | "pending" // Awaiting deposit
  | "deposited" // Cash taken to bank
  | "confirmed" // Bank has confirmed receipt
  | "reconciled" // Matched with bank statement
  | "discrepancy" // Amount doesn't match
  | "cancelled"; // Deposit cancelled

/**
 * Payment methods included in deposit
 */
export type DepositPaymentType = "cash" | "cheque";

/**
 * Bank deposit slip
 */
export interface BankDepositSlip {
  id: string;
  schoolId: string;

  // Slip identity
  slipNumber: string; // Auto-generated: DEP-2024-001
  manualSlipNumber?: string; // Bank's printed slip number if different

  // Bank details
  bank: UgandaBank;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountName: string;

  // Deposit details
  depositDate: Date;
  depositAmount: number;
  currency: "UGX";

  // Sources
  paymentType: DepositPaymentType;
  includesPayments: DepositPaymentReference[];

  // Cash denominations (for cash deposits)
  denominations?: CashDenominations;
  totalFromDenominations?: number;

  // Cheques (for cheque deposits)
  cheques?: ChequeDetail[];

  // Status
  status: DepositStatus;

  // Bank confirmation
  bankReferenceNumber?: string;
  bankConfirmedAt?: Timestamp;
  bankConfirmedAmount?: number;

  // Discrepancy handling
  hasDiscrepancy: boolean;
  discrepancyAmount?: number;
  discrepancyReason?: string;
  discrepancyResolvedAt?: Timestamp;
  discrepancyResolvedBy?: string;

  // Depositor info
  depositorName: string;
  depositorId: string;
  depositorPhone?: string;

  // Bank teller info
  tellerName?: string;
  tellerId?: string;

  // Notes and attachments
  notes?: string;
  scannedSlipUrl?: string;
  photos?: string[];

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  updatedAt: Timestamp;
  printedAt?: Timestamp;
  printedBy?: string;
}

/**
 * Reference to included payment
 */
export interface DepositPaymentReference {
  paymentId: string;
  receiptNumber: string;
  studentName: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "cheque";
}

/**
 * Cash denomination breakdown
 */
export interface CashDenominations {
  // Notes
  notes_50000: number;
  notes_20000: number;
  notes_10000: number;
  notes_5000: number;
  notes_2000: number;
  notes_1000: number;

  // Coins
  coins_500: number;
  coins_200: number;
  coins_100: number;
  coins_50: number;
}

/**
 * Cheque detail
 */
export interface ChequeDetail {
  chequeNumber: string;
  bankName: string;
  branchName?: string;
  drawerName: string;
  amount: number;
  chequeDate: Date;

  // Clearing status
  clearingStatus: "pending" | "cleared" | "bounced";
  clearedAt?: Timestamp;
  bounceReason?: string;
}

// ============================================================================
// BANK ACCOUNT CONFIGURATION
// ============================================================================

/**
 * School bank account
 */
export interface SchoolBankAccount {
  id: string;
  schoolId: string;

  // Account info
  bank: UgandaBank;
  bankName: string;
  branchName: string;
  branchCode?: string;
  accountNumber: string;
  accountName: string;
  accountType: "current" | "savings";

  // Contact
  relationshipManager?: string;
  managerPhone?: string;

  // Settings
  isDefault: boolean;
  isActive: boolean;
  acceptsCash: boolean;
  acceptsCheques: boolean;
  acceptsMobileMoney: boolean;

  // For reconciliation
  statementEmail?: string;
  lastStatementDate?: Date;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DEPOSIT SLIP GENERATION
// ============================================================================

/**
 * Slip generation settings
 */
export interface SlipSettings {
  schoolId: string;

  // Numbering
  slipPrefix: string; // Default: "DEP"
  currentYear: number;
  lastSlipNumber: number;
  resetYearly: boolean;

  // Default bank
  defaultBankAccountId?: string;

  // Printing
  paperSize: "A4" | "A5" | "custom";
  printInDuplicate: boolean;
  includeSchoolLogo: boolean;
  includeDenominations: boolean;

  // Workflow
  requireApprovalOver: number; // Amount threshold for approval
  requirePhotoProof: boolean;
  autoReconcile: boolean;

  updatedAt: Timestamp;
}

/**
 * Input for creating a deposit slip
 */
export interface CreateDepositSlipInput {
  schoolId: string;
  bankAccountId: string;
  depositDate: Date;
  paymentIds: string[];
  depositorId: string;
  depositorName: string;
  notes?: string;
}

// ============================================================================
// DEPOSIT BATCHING
// ============================================================================

/**
 * Daily deposit batch
 */
export interface DepositBatch {
  id: string;
  schoolId: string;
  batchDate: Date;

  // Totals
  totalCash: number;
  totalCheques: number;
  totalAmount: number;
  paymentCount: number;

  // Status
  status: "collecting" | "ready" | "in_transit" | "deposited" | "reconciled";

  // Slips
  depositSlips: string[]; // Slip IDs

  // Tracking
  preparedBy: string;
  preparedByName: string;
  preparedAt: Timestamp;

  carriedBy?: string;
  departedAt?: Timestamp;
  arrivedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// RECONCILIATION
// ============================================================================

/**
 * Deposit reconciliation record
 */
export interface DepositReconciliation {
  id: string;
  schoolId: string;

  // Period
  reconciliationDate: Date;
  periodStart: Date;
  periodEnd: Date;

  // Expected vs Actual
  expectedDeposits: number;
  actualDeposits: number;
  difference: number;

  // Breakdown
  cashDeposits: number;
  chequeDeposits: number;

  // Slip counts
  totalSlips: number;
  reconciledSlips: number;
  pendingSlips: number;
  discrepancySlips: number;

  // Status
  status: "in_progress" | "completed" | "has_discrepancies";

  // Details
  items: ReconciliationItem[];

  // Workflow
  reconciledBy: string;
  reconsiledByName: string;
  completedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Individual reconciliation item
 */
export interface ReconciliationItem {
  depositSlipId: string;
  slipNumber: string;
  depositDate: Date;
  expectedAmount: number;
  confirmedAmount: number;
  difference: number;
  status: "matched" | "discrepancy" | "pending";
  bankReference?: string;
  notes?: string;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface DepositSlipQuery {
  schoolId: string;
  status?: DepositStatus;
  bank?: UgandaBank;
  dateFrom?: Date;
  dateTo?: Date;
  depositorId?: string;
  hasDiscrepancy?: boolean;
  limit?: number;
}

export interface DepositSummaryQuery {
  schoolId: string;
  period: "daily" | "weekly" | "monthly";
  date: Date;
}

// ============================================================================
// SUMMARY TYPES
// ============================================================================

/**
 * Deposit summary for period
 */
export interface DepositSummary {
  schoolId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;

  // Totals
  totalDeposits: number;
  totalAmount: number;
  cashAmount: number;
  chequeAmount: number;

  // By status
  byStatus: Record<DepositStatus, { count: number; amount: number }>;

  // By bank
  byBank: {
    bank: UgandaBank;
    bankName: string;
    count: number;
    amount: number;
  }[];

  // Pending
  pendingDeposits: number;
  pendingAmount: number;

  // Discrepancies
  discrepancyCount: number;
  discrepancyAmount: number;
}

/**
 * Cash collection summary for a day
 */
export interface DailyCashCollection {
  date: Date;
  schoolId: string;

  // Collections
  totalCashCollected: number;
  totalChequeCollected: number;
  receiptCount: number;

  // Deposits
  totalDeposited: number;
  depositsCount: number;

  // Outstanding
  cashOnHand: number;
  cashAwaitingDeposit: number;

  // Denominations on hand
  denominations: CashDenominations;
}

// ============================================================================
// PRINT DATA
// ============================================================================

/**
 * Data for printing deposit slip
 */
export interface DepositSlipPrintData {
  slip: BankDepositSlip;
  school: {
    name: string;
    address: string;
    phone: string;
    logoUrl?: string;
  };
  bankAccount: SchoolBankAccount;
  paymentDetails: DepositPaymentReference[];
  denominationBreakdown?: {
    denomination: string;
    count: number;
    total: number;
  }[];
  printedAt: Date;
  printedBy: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Bank display info
 */
export function getBankInfo(bank: UgandaBank): {
  name: string;
  shortName: string;
  swiftCode?: string;
  color: string;
} {
  const banks: Record<
    UgandaBank,
    { name: string; shortName: string; swiftCode?: string; color: string }
  > = {
    stanbic: {
      name: "Stanbic Bank Uganda",
      shortName: "Stanbic",
      swiftCode: "SBICUGKX",
      color: "#0033A0",
    },
    centenary: {
      name: "Centenary Bank",
      shortName: "Centenary",
      swiftCode: "CEABORUX",
      color: "#00843D",
    },
    dfcu: {
      name: "dfcu Bank",
      shortName: "dfcu",
      swiftCode: "DFCUUGKA",
      color: "#E31937",
    },
    equity: {
      name: "Equity Bank Uganda",
      shortName: "Equity",
      swiftCode: "EABORUX",
      color: "#A02337",
    },
    absa: {
      name: "Absa Bank Uganda",
      shortName: "Absa",
      swiftCode: "BABORUG",
      color: "#AF0000",
    },
    kcb: {
      name: "KCB Bank Uganda",
      shortName: "KCB",
      swiftCode: "KCBLUGKA",
      color: "#00A650",
    },
    standard_chartered: {
      name: "Standard Chartered Bank Uganda",
      shortName: "StanChart",
      swiftCode: "SCBLUGKA",
      color: "#0066B3",
    },
    bank_of_africa: {
      name: "Bank of Africa Uganda",
      shortName: "BOA",
      swiftCode: "AFRIUGKA",
      color: "#E31837",
    },
    housing_finance: {
      name: "Housing Finance Bank",
      shortName: "HFB",
      swiftCode: "HABORUG",
      color: "#F58220",
    },
    ecobank: {
      name: "Ecobank Uganda",
      shortName: "Ecobank",
      swiftCode: "EABORUX",
      color: "#0072BC",
    },
    postbank: {
      name: "PostBank Uganda",
      shortName: "PostBank",
      swiftCode: "UABORUG",
      color: "#005BAA",
    },
    other: { name: "Other Bank", shortName: "Other", color: "#666666" },
  };
  return banks[bank];
}

/**
 * Get deposit status display
 */
export function getDepositStatusInfo(status: DepositStatus): {
  label: string;
  color: "gray" | "yellow" | "blue" | "green" | "red" | "purple";
  icon: string;
} {
  const info: Record<
    DepositStatus,
    {
      label: string;
      color: "gray" | "yellow" | "blue" | "green" | "red" | "purple";
      icon: string;
    }
  > = {
    draft: { label: "Draft", color: "gray", icon: "edit" },
    pending: {
      label: "Pending Deposit",
      color: "yellow",
      icon: "hourglass_empty",
    },
    deposited: { label: "Deposited", color: "blue", icon: "account_balance" },
    confirmed: { label: "Confirmed", color: "green", icon: "check_circle" },
    reconciled: { label: "Reconciled", color: "purple", icon: "done_all" },
    discrepancy: { label: "Discrepancy", color: "red", icon: "warning" },
    cancelled: { label: "Cancelled", color: "gray", icon: "cancel" },
  };
  return info[status];
}

/**
 * Calculate total from denominations
 */
export function calculateDenominationTotal(denom: CashDenominations): number {
  return (
    denom.notes_50000 * 50000 +
    denom.notes_20000 * 20000 +
    denom.notes_10000 * 10000 +
    denom.notes_5000 * 5000 +
    denom.notes_2000 * 2000 +
    denom.notes_1000 * 1000 +
    denom.coins_500 * 500 +
    denom.coins_200 * 200 +
    denom.coins_100 * 100 +
    denom.coins_50 * 50
  );
}

/**
 * Generate deposit slip number
 */
export function generateSlipNumber(
  prefix: string,
  year: number,
  sequence: number,
): string {
  const seq = sequence.toString().padStart(4, "0");
  return `${prefix}-${year}-${seq}`;
}

/**
 * Format denomination breakdown for display
 */
export function formatDenominationBreakdown(denom: CashDenominations): {
  denomination: string;
  count: number;
  total: number;
}[] {
  const items = [
    {
      denomination: "UGX 50,000",
      count: denom.notes_50000,
      total: denom.notes_50000 * 50000,
    },
    {
      denomination: "UGX 20,000",
      count: denom.notes_20000,
      total: denom.notes_20000 * 20000,
    },
    {
      denomination: "UGX 10,000",
      count: denom.notes_10000,
      total: denom.notes_10000 * 10000,
    },
    {
      denomination: "UGX 5,000",
      count: denom.notes_5000,
      total: denom.notes_5000 * 5000,
    },
    {
      denomination: "UGX 2,000",
      count: denom.notes_2000,
      total: denom.notes_2000 * 2000,
    },
    {
      denomination: "UGX 1,000",
      count: denom.notes_1000,
      total: denom.notes_1000 * 1000,
    },
    {
      denomination: "UGX 500",
      count: denom.coins_500,
      total: denom.coins_500 * 500,
    },
    {
      denomination: "UGX 200",
      count: denom.coins_200,
      total: denom.coins_200 * 200,
    },
    {
      denomination: "UGX 100",
      count: denom.coins_100,
      total: denom.coins_100 * 100,
    },
    {
      denomination: "UGX 50",
      count: denom.coins_50,
      total: denom.coins_50 * 50,
    },
  ];

  return items.filter((i) => i.count > 0);
}

/**
 * Empty denominations
 */
export function getEmptyDenominations(): CashDenominations {
  return {
    notes_50000: 0,
    notes_20000: 0,
    notes_10000: 0,
    notes_5000: 0,
    notes_2000: 0,
    notes_1000: 0,
    coins_500: 0,
    coins_200: 0,
    coins_100: 0,
    coins_50: 0,
  };
}

/**
 * Validate slip before deposit
 */
export function validateSlipForDeposit(slip: BankDepositSlip): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!slip.depositAmount || slip.depositAmount <= 0) {
    errors.push("Deposit amount must be greater than zero");
  }

  if (!slip.accountNumber) {
    errors.push("Bank account number is required");
  }

  if (!slip.depositorName) {
    errors.push("Depositor name is required");
  }

  if (slip.paymentType === "cash" && slip.denominations) {
    const calculatedTotal = calculateDenominationTotal(slip.denominations);
    if (calculatedTotal !== slip.depositAmount) {
      errors.push(
        `Denomination total (${calculatedTotal}) doesn't match deposit amount (${slip.depositAmount})`,
      );
    }
  }

  if (
    slip.paymentType === "cheque" &&
    (!slip.cheques || slip.cheques.length === 0)
  ) {
    errors.push("At least one cheque is required for cheque deposits");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
