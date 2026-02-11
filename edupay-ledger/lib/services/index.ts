/**
 * Services index file
 *
 * Export all services for easy importing
 *
 * Note: Both payment.service.ts and payments.service.ts export recordPayment.
 * Use recordPaymentWithInstallments from payment.service.ts for the main
 * payment recording with installment distribution.
 * Use recordPayment from payments.service.ts for simpler recording.
 */

// Payment service - explicit exports to avoid conflict
export {
  recordPayment as recordPaymentWithInstallments,
  getPaymentById,
  type PaymentRecordResult,
  type InstallmentApplicationResult,
} from "./payment.service";

// Payments service - all exports
export * from "./payments.service";

// Stellar blockchain service
export {
  createAnchorRecord,
  anchorPayment,
  processAnchor,
  processPendingAnchors,
  retryAnchor,
  getAnchor,
  getAnchorByPaymentId,
  getAnchorByReceiptNumber,
  getSchoolAnchors,
  getPendingAnchorCount,
  getFailedAnchorCount,
  verifyAnchor,
  verifyByReceiptNumber,
  getStellarStats,
  getFullHealthStatus,
  syncAnchorsToFirebase,
  createPaymentHash,
  formatTxHash,
  getStellarExplorerUrl,
  getStellarConfig,
  isStellarConfigured,
  getStellarHealthStatus,
} from "./stellar.service";

export * from "./notification.service";
export * from "./receipt.service";
export * from "./student.service";
export * from "./school.service";
export * from "./scheduler.service";
export * from "./export.service";
export * from "./dashboard.service";
export * from "./reports.service";
export * from "./settings.service";
