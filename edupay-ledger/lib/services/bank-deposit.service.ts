/**
 * Bank Deposit Slip Service
 * Handles deposit slip generation and management
 *
 * Features:
 * - Slip generation with auto-numbering
 * - Denomination tracking
 * - Multi-bank support
 * - Reconciliation
 */

import { Timestamp } from "firebase/firestore";
import {
  BankDepositSlip,
  DepositPaymentReference,
  CashDenominations,
  ChequeDetail,
  SchoolBankAccount,
  SlipSettings,
  CreateDepositSlipInput,
  DepositBatch,
  DepositReconciliation,
  DepositSlipQuery,
  DepositSummary,
  DailyCashCollection,
  DepositSlipPrintData,
  DepositStatus,
  UgandaBank,
  calculateDenominationTotal,
  generateSlipNumber,
  formatDenominationBreakdown,
  getEmptyDenominations,
  validateSlipForDeposit,
  getBankInfo,
} from "@/types/bank-deposit";

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

/**
 * Get school bank accounts
 */
export async function getBankAccounts(
  schoolId: string,
): Promise<SchoolBankAccount[]> {
  // Mock implementation
  return getMockBankAccounts(schoolId);
}

/**
 * Get default bank account
 */
export async function getDefaultBankAccount(
  schoolId: string,
): Promise<SchoolBankAccount | null> {
  const accounts = await getBankAccounts(schoolId);
  return accounts.find((a) => a.isDefault && a.isActive) || accounts[0] || null;
}

/**
 * Create bank account
 */
export async function createBankAccount(
  account: Omit<SchoolBankAccount, "id" | "createdAt" | "updatedAt">,
): Promise<SchoolBankAccount> {
  const newAccount: SchoolBankAccount = {
    ...account,
    id: `account-${Date.now()}`,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  // Would save to Firestore
  return newAccount;
}

/**
 * Update bank account
 */
export async function updateBankAccount(
  accountId: string,
  updates: Partial<SchoolBankAccount>,
): Promise<SchoolBankAccount> {
  const accounts = await getBankAccounts("mock-school");
  const existing = accounts.find((a) => a.id === accountId);

  if (!existing) {
    throw new Error("Bank account not found");
  }

  return {
    ...existing,
    ...updates,
    updatedAt: Timestamp.now(),
  };
}

// ============================================================================
// SLIP SETTINGS
// ============================================================================

/**
 * Get slip settings
 */
export async function getSlipSettings(schoolId: string): Promise<SlipSettings> {
  return {
    schoolId,
    slipPrefix: "DEP",
    currentYear: new Date().getFullYear(),
    lastSlipNumber: 156,
    resetYearly: true,
    paperSize: "A4",
    printInDuplicate: true,
    includeSchoolLogo: true,
    includeDenominations: true,
    requireApprovalOver: 5000000,
    requirePhotoProof: true,
    autoReconcile: false,
    updatedAt: Timestamp.now(),
  };
}

/**
 * Update slip settings
 */
export async function updateSlipSettings(
  schoolId: string,
  updates: Partial<SlipSettings>,
): Promise<SlipSettings> {
  const current = await getSlipSettings(schoolId);
  return {
    ...current,
    ...updates,
    updatedAt: Timestamp.now(),
  };
}

// ============================================================================
// DEPOSIT SLIP CRUD
// ============================================================================

/**
 * Create a new deposit slip
 */
export async function createDepositSlip(
  input: CreateDepositSlipInput,
): Promise<BankDepositSlip> {
  const settings = await getSlipSettings(input.schoolId);
  const accounts = await getBankAccounts(input.schoolId);
  const account = accounts.find((a) => a.id === input.bankAccountId);

  if (!account) {
    throw new Error("Bank account not found");
  }

  // Generate slip number
  const nextNumber = settings.lastSlipNumber + 1;
  const slipNumber = generateSlipNumber(
    settings.slipPrefix,
    settings.currentYear,
    nextNumber,
  );

  // Would fetch actual payment details
  const payments: DepositPaymentReference[] = input.paymentIds.map(
    (id, index) => ({
      paymentId: id,
      receiptNumber: `RCP-2024-${(100 + index).toString()}`,
      studentName: `Student ${index + 1}`,
      amount: 250000 + index * 50000,
      paymentDate: new Date(),
      paymentMethod: "cash",
    }),
  );

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const slip: BankDepositSlip = {
    id: `slip-${Date.now()}`,
    schoolId: input.schoolId,
    slipNumber,
    bank: account.bank,
    bankName: account.bankName,
    branchName: account.branchName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    depositDate: input.depositDate,
    depositAmount: totalAmount,
    currency: "UGX",
    paymentType: "cash",
    includesPayments: payments,
    denominations: getEmptyDenominations(),
    status: "draft",
    hasDiscrepancy: false,
    depositorName: input.depositorName,
    depositorId: input.depositorId,
    notes: input.notes,
    createdAt: Timestamp.now(),
    createdBy: input.depositorId,
    createdByName: input.depositorName,
    updatedAt: Timestamp.now(),
  };

  // Would update settings with new slip number
  // Would save to Firestore

  return slip;
}

/**
 * Get deposit slip by ID
 */
export async function getDepositSlip(
  slipId: string,
): Promise<BankDepositSlip | null> {
  const slips = getMockDepositSlips();
  return slips.find((s) => s.id === slipId) || null;
}

/**
 * Query deposit slips
 */
export async function queryDepositSlips(
  query: DepositSlipQuery,
): Promise<BankDepositSlip[]> {
  let slips = getMockDepositSlips();

  if (query.status) {
    slips = slips.filter((s) => s.status === query.status);
  }

  if (query.bank) {
    slips = slips.filter((s) => s.bank === query.bank);
  }

  if (query.depositorId) {
    slips = slips.filter((s) => s.depositorId === query.depositorId);
  }

  if (query.hasDiscrepancy !== undefined) {
    slips = slips.filter((s) => s.hasDiscrepancy === query.hasDiscrepancy);
  }

  if (query.dateFrom) {
    slips = slips.filter((s) => s.depositDate >= query.dateFrom!);
  }

  if (query.dateTo) {
    slips = slips.filter((s) => s.depositDate <= query.dateTo!);
  }

  if (query.limit) {
    slips = slips.slice(0, query.limit);
  }

  return slips;
}

/**
 * Update deposit slip
 */
export async function updateDepositSlip(
  slipId: string,
  updates: Partial<BankDepositSlip>,
): Promise<BankDepositSlip> {
  const slip = await getDepositSlip(slipId);

  if (!slip) {
    throw new Error("Deposit slip not found");
  }

  const updated: BankDepositSlip = {
    ...slip,
    ...updates,
    updatedAt: Timestamp.now(),
  };

  // Would save to Firestore
  return updated;
}

/**
 * Update denominations
 */
export async function updateDenominations(
  slipId: string,
  denominations: CashDenominations,
): Promise<BankDepositSlip> {
  const total = calculateDenominationTotal(denominations);

  return updateDepositSlip(slipId, {
    denominations,
    totalFromDenominations: total,
  });
}

/**
 * Add cheques to slip
 */
export async function addCheques(
  slipId: string,
  cheques: ChequeDetail[],
): Promise<BankDepositSlip> {
  const slip = await getDepositSlip(slipId);

  if (!slip) {
    throw new Error("Deposit slip not found");
  }

  const existingCheques = slip.cheques || [];
  const totalAmount = [...existingCheques, ...cheques].reduce(
    (sum, c) => sum + c.amount,
    0,
  );

  return updateDepositSlip(slipId, {
    cheques: [...existingCheques, ...cheques],
    depositAmount: totalAmount,
    paymentType: "cheque",
  });
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

/**
 * Mark slip as ready for deposit
 */
export async function markReadyForDeposit(
  slipId: string,
): Promise<BankDepositSlip> {
  const slip = await getDepositSlip(slipId);

  if (!slip) {
    throw new Error("Deposit slip not found");
  }

  const validation = validateSlipForDeposit(slip);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
  }

  return updateDepositSlip(slipId, { status: "pending" });
}

/**
 * Mark slip as deposited
 */
export async function markDeposited(
  slipId: string,
  bankReferenceNumber?: string,
): Promise<BankDepositSlip> {
  return updateDepositSlip(slipId, {
    status: "deposited",
    bankReferenceNumber,
  });
}

/**
 * Confirm bank receipt
 */
export async function confirmBankReceipt(
  slipId: string,
  confirmedAmount: number,
  bankReference: string,
): Promise<BankDepositSlip> {
  const slip = await getDepositSlip(slipId);

  if (!slip) {
    throw new Error("Deposit slip not found");
  }

  const hasDiscrepancy = confirmedAmount !== slip.depositAmount;

  return updateDepositSlip(slipId, {
    status: hasDiscrepancy ? "discrepancy" : "confirmed",
    bankConfirmedAt: Timestamp.now(),
    bankConfirmedAmount: confirmedAmount,
    bankReferenceNumber: bankReference,
    hasDiscrepancy,
    discrepancyAmount: hasDiscrepancy
      ? slip.depositAmount - confirmedAmount
      : undefined,
  });
}

/**
 * Resolve discrepancy
 */
export async function resolveDiscrepancy(
  slipId: string,
  reason: string,
  userId: string,
): Promise<BankDepositSlip> {
  return updateDepositSlip(slipId, {
    status: "reconciled",
    discrepancyReason: reason,
    discrepancyResolvedAt: Timestamp.now(),
    discrepancyResolvedBy: userId,
  });
}

/**
 * Cancel deposit slip
 */
export async function cancelDepositSlip(
  slipId: string,
  reason: string,
): Promise<BankDepositSlip> {
  return updateDepositSlip(slipId, {
    status: "cancelled",
    notes: `Cancelled: ${reason}`,
  });
}

// ============================================================================
// PRINTING
// ============================================================================

/**
 * Generate print data for slip
 */
export async function generatePrintData(
  slipId: string,
  printedBy: string,
): Promise<DepositSlipPrintData> {
  const slip = await getDepositSlip(slipId);

  if (!slip) {
    throw new Error("Deposit slip not found");
  }

  const accounts = await getBankAccounts(slip.schoolId);
  const account = accounts.find((a) => a.accountNumber === slip.accountNumber)!;

  // Mark as printed
  await updateDepositSlip(slipId, {
    printedAt: Timestamp.now(),
    printedBy,
  });

  return {
    slip,
    school: {
      name: "ABC Secondary School",
      address: "P.O. Box 1234, Kampala, Uganda",
      phone: "+256-700-123-456",
      logoUrl: "/logo.png",
    },
    bankAccount: account,
    paymentDetails: slip.includesPayments,
    denominationBreakdown: slip.denominations
      ? formatDenominationBreakdown(slip.denominations)
      : undefined,
    printedAt: new Date(),
    printedBy,
  };
}

// ============================================================================
// BATCHING
// ============================================================================

/**
 * Create deposit batch for a day
 */
export async function createDepositBatch(
  schoolId: string,
  batchDate: Date,
  userId: string,
  userName: string,
): Promise<DepositBatch> {
  // Get all pending slips for the day
  const slips = await queryDepositSlips({
    schoolId,
    status: "pending",
    dateFrom: new Date(batchDate.setHours(0, 0, 0, 0)),
    dateTo: new Date(batchDate.setHours(23, 59, 59, 999)),
  });

  const cashSlips = slips.filter((s) => s.paymentType === "cash");
  const chequeSlips = slips.filter((s) => s.paymentType === "cheque");

  const batch: DepositBatch = {
    id: `batch-${Date.now()}`,
    schoolId,
    batchDate,
    totalCash: cashSlips.reduce((sum, s) => sum + s.depositAmount, 0),
    totalCheques: chequeSlips.reduce((sum, s) => sum + s.depositAmount, 0),
    totalAmount: slips.reduce((sum, s) => sum + s.depositAmount, 0),
    paymentCount: slips.reduce((sum, s) => sum + s.includesPayments.length, 0),
    status: "ready",
    depositSlips: slips.map((s) => s.id),
    preparedBy: userId,
    preparedByName: userName,
    preparedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  return batch;
}

/**
 * Mark batch as in transit
 */
export async function markBatchInTransit(
  batchId: string,
  carriedBy: string,
): Promise<DepositBatch> {
  // Would update Firestore
  return {
    id: batchId,
    schoolId: "mock-school",
    batchDate: new Date(),
    totalCash: 0,
    totalCheques: 0,
    totalAmount: 0,
    paymentCount: 0,
    status: "in_transit",
    depositSlips: [],
    preparedBy: "user",
    preparedByName: "User",
    preparedAt: Timestamp.now(),
    carriedBy,
    departedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

// ============================================================================
// SUMMARIES
// ============================================================================

/**
 * Get deposit summary for period
 */
export async function getDepositSummary(
  schoolId: string,
  period: "daily" | "weekly" | "monthly",
  date: Date,
): Promise<DepositSummary> {
  return getMockDepositSummary(schoolId, period);
}

/**
 * Get daily cash collection status
 */
export async function getDailyCashCollection(
  schoolId: string,
  date: Date,
): Promise<DailyCashCollection> {
  return {
    date,
    schoolId,
    totalCashCollected: 2850000,
    totalChequeCollected: 1500000,
    receiptCount: 18,
    totalDeposited: 2500000,
    depositsCount: 2,
    cashOnHand: 350000,
    cashAwaitingDeposit: 1500000,
    denominations: {
      notes_50000: 4,
      notes_20000: 5,
      notes_10000: 8,
      notes_5000: 6,
      notes_2000: 5,
      notes_1000: 10,
      coins_500: 0,
      coins_200: 0,
      coins_100: 0,
      coins_50: 0,
    },
  };
}

// ============================================================================
// RECONCILIATION
// ============================================================================

/**
 * Start reconciliation for period
 */
export async function startReconciliation(
  schoolId: string,
  periodStart: Date,
  periodEnd: Date,
  userId: string,
  userName: string,
): Promise<DepositReconciliation> {
  const slips = await queryDepositSlips({
    schoolId,
    dateFrom: periodStart,
    dateTo: periodEnd,
  });

  const items = slips.map((slip) => ({
    depositSlipId: slip.id,
    slipNumber: slip.slipNumber,
    depositDate: slip.depositDate,
    expectedAmount: slip.depositAmount,
    confirmedAmount: slip.bankConfirmedAmount || 0,
    difference: slip.depositAmount - (slip.bankConfirmedAmount || 0),
    status:
      slip.status === "reconciled"
        ? ("matched" as const)
        : slip.hasDiscrepancy
          ? ("discrepancy" as const)
          : ("pending" as const),
    bankReference: slip.bankReferenceNumber,
  }));

  const reconciliation: DepositReconciliation = {
    id: `recon-${Date.now()}`,
    schoolId,
    reconciliationDate: new Date(),
    periodStart,
    periodEnd,
    expectedDeposits: items.reduce((sum, i) => sum + i.expectedAmount, 0),
    actualDeposits: items.reduce((sum, i) => sum + i.confirmedAmount, 0),
    difference: items.reduce((sum, i) => sum + i.difference, 0),
    cashDeposits: slips
      .filter((s) => s.paymentType === "cash")
      .reduce((sum, s) => sum + s.depositAmount, 0),
    chequeDeposits: slips
      .filter((s) => s.paymentType === "cheque")
      .reduce((sum, s) => sum + s.depositAmount, 0),
    totalSlips: items.length,
    reconciledSlips: items.filter((i) => i.status === "matched").length,
    pendingSlips: items.filter((i) => i.status === "pending").length,
    discrepancySlips: items.filter((i) => i.status === "discrepancy").length,
    status: "in_progress",
    items,
    reconciledBy: userId,
    reconsiledByName: userName,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  return reconciliation;
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockBankAccounts(schoolId: string): SchoolBankAccount[] {
  return [
    {
      id: "account-1",
      schoolId,
      bank: "stanbic",
      bankName: "Stanbic Bank Uganda",
      branchName: "Kampala Main",
      branchCode: "SBIC001",
      accountNumber: "9030012345678",
      accountName: "ABC Secondary School Fees Account",
      accountType: "current",
      relationshipManager: "John Kasozi",
      managerPhone: "+256-700-111-222",
      isDefault: true,
      isActive: true,
      acceptsCash: true,
      acceptsCheques: true,
      acceptsMobileMoney: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: "account-2",
      schoolId,
      bank: "centenary",
      bankName: "Centenary Bank",
      branchName: "Kireka Branch",
      accountNumber: "3100012345678",
      accountName: "ABC Secondary School Development",
      accountType: "savings",
      isDefault: false,
      isActive: true,
      acceptsCash: true,
      acceptsCheques: true,
      acceptsMobileMoney: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];
}

function getMockDepositSlips(): BankDepositSlip[] {
  const baseDate = new Date();

  return [
    {
      id: "slip-1",
      schoolId: "mock-school",
      slipNumber: "DEP-2024-0157",
      bank: "stanbic",
      bankName: "Stanbic Bank Uganda",
      branchName: "Kampala Main",
      accountNumber: "9030012345678",
      accountName: "ABC Secondary School",
      depositDate: baseDate,
      depositAmount: 2500000,
      currency: "UGX",
      paymentType: "cash",
      includesPayments: [
        {
          paymentId: "p1",
          receiptNumber: "RCP-001",
          studentName: "David Mugisha",
          amount: 500000,
          paymentDate: baseDate,
          paymentMethod: "cash",
        },
        {
          paymentId: "p2",
          receiptNumber: "RCP-002",
          studentName: "Grace Nakato",
          amount: 750000,
          paymentDate: baseDate,
          paymentMethod: "cash",
        },
        {
          paymentId: "p3",
          receiptNumber: "RCP-003",
          studentName: "Peter Ochen",
          amount: 1250000,
          paymentDate: baseDate,
          paymentMethod: "cash",
        },
      ],
      denominations: {
        notes_50000: 40,
        notes_20000: 20,
        notes_10000: 10,
        notes_5000: 0,
        notes_2000: 0,
        notes_1000: 0,
        coins_500: 0,
        coins_200: 0,
        coins_100: 0,
        coins_50: 0,
      },
      totalFromDenominations: 2500000,
      status: "pending",
      hasDiscrepancy: false,
      depositorName: "Mary Nambooze",
      depositorId: "bursar-1",
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      createdByName: "Mary Nambooze",
      updatedAt: Timestamp.now(),
    },
    {
      id: "slip-2",
      schoolId: "mock-school",
      slipNumber: "DEP-2024-0156",
      bank: "stanbic",
      bankName: "Stanbic Bank Uganda",
      branchName: "Kampala Main",
      accountNumber: "9030012345678",
      accountName: "ABC Secondary School",
      depositDate: new Date(baseDate.getTime() - 24 * 60 * 60 * 1000),
      depositAmount: 3200000,
      currency: "UGX",
      paymentType: "cash",
      includesPayments: [],
      status: "confirmed",
      hasDiscrepancy: false,
      bankReferenceNumber: "STN2024012345",
      bankConfirmedAt: Timestamp.now(),
      bankConfirmedAmount: 3200000,
      depositorName: "Mary Nambooze",
      depositorId: "bursar-1",
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      createdByName: "Mary Nambooze",
      updatedAt: Timestamp.now(),
    },
  ];
}

function getMockDepositSummary(
  schoolId: string,
  period: "daily" | "weekly" | "monthly",
): DepositSummary {
  const multiplier = period === "daily" ? 1 : period === "weekly" ? 5 : 22;

  return {
    schoolId,
    period,
    startDate: new Date(),
    endDate: new Date(),
    totalDeposits: 3 * multiplier,
    totalAmount: 5700000 * multiplier,
    cashAmount: 4200000 * multiplier,
    chequeAmount: 1500000 * multiplier,
    byStatus: {
      draft: { count: 1, amount: 350000 },
      pending: { count: 2, amount: 2850000 },
      deposited: { count: 1 * multiplier, amount: 1500000 * multiplier },
      confirmed: { count: 1 * multiplier, amount: 3200000 * multiplier },
      reconciled: { count: 0, amount: 0 },
      discrepancy: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    },
    byBank: [
      {
        bank: "stanbic",
        bankName: "Stanbic Bank",
        count: 2 * multiplier,
        amount: 4500000 * multiplier,
      },
      {
        bank: "centenary",
        bankName: "Centenary Bank",
        count: 1 * multiplier,
        amount: 1200000 * multiplier,
      },
    ],
    pendingDeposits: 2,
    pendingAmount: 2850000,
    discrepancyCount: 0,
    discrepancyAmount: 0,
  };
}

export function getMockDepositDashboard() {
  return {
    todayCashCollected: 2850000,
    todayChequeCollected: 1500000,
    cashOnHand: 350000,
    pendingDeposits: 2,
    pendingAmount: 2850000,
    lastDepositDate: new Date(),
    lastDepositAmount: 3200000,
    weeklyTotal: 28500000,
    unreconciledSlips: 3,
    bankAccounts: getMockBankAccounts("mock-school").length,
  };
}
