export * from "./school";
export * from "./student";
export * from "./payment";
export * from "./user";
export * from "./stellar";
export * from "./receipt-book";
export * from "./carry-forward";
export * from "./daily-reports";
export * from "./term-comparison";
export * from "./bad-debt";
export * from "./escalation";
export * from "./whatsapp";
// Bank deposit types - selective export to avoid conflicts with receipt-book
export type {
  UgandaBank,
  DepositStatus,
  BankDepositSlip,
  CashDenominations as DepositCashDenominations,
  ChequeDetail,
  SchoolBankAccount,
  SlipSettings,
  DepositBatch,
  DepositReconciliation,
  DepositSlipQuery,
  DepositSummary,
  DailyCashCollection,
  DepositSlipPrintData,
} from "./bank-deposit";
export {
  getBankInfo,
  getDepositStatusInfo,
  calculateDenominationTotal as calculateDepositDenominationTotal,
  generateSlipNumber,
  formatDenominationBreakdown as formatDepositDenominationBreakdown,
  getEmptyDenominations as getEmptyDepositDenominations,
  validateSlipForDeposit,
} from "./bank-deposit";
