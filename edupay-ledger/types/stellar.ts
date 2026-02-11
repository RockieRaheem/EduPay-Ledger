/**
 * Stellar Blockchain Integration Types
 * 
 * eBursar uses Stellar as an immutable audit ledger for payment records.
 * We do NOT move money on Stellar - we only anchor cryptographic proof hashes.
 * 
 * This provides:
 * - Tamper-proof payment records
 * - Public verifiability
 * - Dispute resolution evidence
 * - Regulatory compliance trail
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Network configuration for Stellar
 */
export type StellarNetwork = 'TESTNET' | 'MAINNET';

/**
 * Status of a Stellar anchor operation
 */
export type StellarAnchorStatus = 
  | 'pending'      // Queued for anchoring
  | 'processing'   // Currently being submitted
  | 'anchored'     // Successfully written to blockchain
  | 'failed'       // Failed after max retries
  | 'verified';    // Independently verified on-chain

/**
 * Priority levels for anchor operations
 */
export type AnchorPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// PAYMENT PROOF TYPES
// ============================================================================

/**
 * Core payment proof data structure
 * This is what gets hashed and anchored to Stellar
 */
export interface PaymentProof {
  /** Unique payment identifier */
  paymentId: string;
  
  /** Student who made the payment */
  studentId: string;
  
  /** School receiving the payment */
  schoolId: string;
  
  /** Payment amount in smallest currency unit */
  amount: number;
  
  /** Currency code (e.g., 'UGX') */
  currency: string;
  
  /** ISO 8601 timestamp of payment */
  timestamp: string;
  
  /** External transaction reference (Mobile Money, Bank, etc.) */
  transactionRef: string;
  
  /** Generated receipt number */
  receiptNumber: string;
  
  /** Payment channel used */
  channel?: string;
  
  /** Academic term */
  termId?: string;
  
  /** Academic year */
  academicYear?: string;
}

/**
 * Extended proof with computed hash
 */
export interface PaymentProofWithHash extends PaymentProof {
  /** SHA-256 hash of the proof data */
  proofHash: string;
  
  /** Algorithm used for hashing */
  hashAlgorithm: 'SHA-256';
  
  /** Version of the proof format */
  proofVersion: string;
}

// ============================================================================
// STELLAR TRANSACTION TYPES
// ============================================================================

/**
 * Result of a Stellar anchor operation
 */
export interface StellarAnchorResult {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Stellar transaction hash (if successful) */
  txHash?: string;
  
  /** Ledger number where transaction was recorded */
  ledgerNumber?: number;
  
  /** Timestamp when anchored */
  anchoredAt?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Error code for programmatic handling */
  errorCode?: StellarErrorCode;
  
  /** Network where transaction was submitted */
  network?: StellarNetwork;
  
  /** Transaction fee paid (in stroops) */
  feePaid?: number;
}

/**
 * Error codes for Stellar operations
 */
export type StellarErrorCode = 
  | 'NOT_CONFIGURED'      // Keys not set up
  | 'NETWORK_ERROR'       // Connection issues
  | 'INSUFFICIENT_FUNDS'  // Account needs funding
  | 'INVALID_SEQUENCE'    // Sequence number mismatch
  | 'TIMEOUT'             // Transaction timeout
  | 'RATE_LIMITED'        // Too many requests
  | 'UNKNOWN';            // Unknown error

/**
 * Stellar transaction details retrieved from blockchain
 */
export interface StellarTransactionDetails {
  /** Transaction hash */
  hash: string;
  
  /** Ledger number */
  ledger: number;
  
  /** Timestamp when included in ledger */
  createdAt: string;
  
  /** Source account */
  sourceAccount: string;
  
  /** Fee paid in stroops */
  feeCharged: number;
  
  /** Operation count */
  operationCount: number;
  
  /** Memo type */
  memoType: string;
  
  /** Memo value (our payment hash) */
  memoValue?: string;
  
  /** Whether transaction was successful */
  successful: boolean;
  
  /** Result XDR */
  resultXdr?: string;
}

// ============================================================================
// DATABASE/STORAGE TYPES
// ============================================================================

/**
 * Stellar anchor record stored in database
 */
export interface DBStellarAnchor {
  /** Unique identifier */
  id: string;
  
  /** Associated payment ID */
  paymentId: string;
  
  /** Receipt number for quick lookup */
  receiptNumber: string;
  
  /** School identifier */
  schoolId: string;
  
  /** The proof that was anchored */
  proof: PaymentProof;
  
  /** Computed hash of the proof */
  proofHash: string;
  
  /** Current status */
  status: StellarAnchorStatus;
  
  /** Priority for processing */
  priority: AnchorPriority;
  
  /** Stellar transaction hash (when anchored) */
  txHash?: string;
  
  /** Ledger number (when anchored) */
  ledgerNumber?: number;
  
  /** Network used */
  network: StellarNetwork;
  
  /** Number of attempts made */
  attempts: number;
  
  /** Maximum allowed attempts */
  maxAttempts: number;
  
  /** Last attempt timestamp */
  lastAttemptAt?: string;
  
  /** Next retry scheduled time */
  nextRetryAt?: string;
  
  /** Last error message */
  lastError?: string;
  
  /** Last error code */
  lastErrorCode?: StellarErrorCode;
  
  /** When the anchor was created */
  createdAt: string;
  
  /** When anchored to blockchain */
  anchoredAt?: string;
  
  /** When last verified on-chain */
  verifiedAt?: string;
  
  /** Sync status for offline support */
  syncStatus: 'synced' | 'pending' | 'conflict';
}

/**
 * Stellar anchor queue item for retry processing
 */
export interface StellarQueueItem {
  /** Anchor record ID */
  anchorId: string;
  
  /** Payment ID */
  paymentId: string;
  
  /** Priority */
  priority: AnchorPriority;
  
  /** Scheduled retry time */
  scheduledAt: string;
  
  /** Number of previous attempts */
  attempts: number;
}

// ============================================================================
// VERIFICATION TYPES
// ============================================================================

/**
 * Result of verifying a payment on Stellar
 */
export interface StellarVerificationResult {
  /** Whether verification was successful */
  isValid: boolean;
  
  /** Whether the proof matches blockchain data */
  proofMatches: boolean;
  
  /** Whether the transaction exists */
  transactionExists: boolean;
  
  /** Current blockchain transaction details */
  transaction?: StellarTransactionDetails;
  
  /** Computed hash from provided data */
  computedHash?: string;
  
  /** Hash stored on blockchain */
  onChainHash?: string;
  
  /** Verification timestamp */
  verifiedAt: string;
  
  /** Error message if verification failed */
  error?: string;
}

/**
 * Public verification request (for parents/auditors)
 */
export interface PublicVerificationRequest {
  /** Receipt number */
  receiptNumber: string;
  
  /** Payment amount (for additional validation) */
  amount: number;
  
  /** Student ID (partial, for privacy) */
  studentIdLast4?: string;
}

/**
 * Public verification response
 */
export interface PublicVerificationResponse {
  /** Whether the payment is verified */
  isVerified: boolean;
  
  /** Verification status message */
  message: string;
  
  /** Stellar transaction URL */
  explorerUrl?: string;
  
  /** When anchored (if verified) */
  anchoredAt?: string;
  
  /** Masked student name */
  studentNameMasked?: string;
  
  /** Payment channel */
  channel?: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Stellar configuration for the application
 */
export interface StellarConfig {
  /** Network to use */
  network: StellarNetwork;
  
  /** Horizon server URL */
  horizonUrl: string;
  
  /** Anchor account public key */
  anchorPublicKey: string;
  
  /** Whether Stellar integration is enabled */
  isEnabled: boolean;
  
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  
  /** Base retry delay in milliseconds */
  retryDelayMs: number;
  
  /** Whether to use exponential backoff */
  useExponentialBackoff: boolean;
  
  /** Auto-process interval in milliseconds */
  autoProcessIntervalMs: number;
}

/**
 * Stellar health status
 */
export interface StellarHealthStatus {
  /** Whether Stellar is configured */
  isConfigured: boolean;
  
  /** Whether connection to Horizon is working */
  isConnected: boolean;
  
  /** Anchor account balance in XLM */
  accountBalance?: number;
  
  /** Number of pending anchors */
  pendingAnchors: number;
  
  /** Number of failed anchors */
  failedAnchors: number;
  
  /** Last successful anchor timestamp */
  lastAnchoredAt?: string;
  
  /** Last error encountered */
  lastError?: string;
  
  /** Current network */
  network: StellarNetwork;
  
  /** Horizon server URL */
  horizonUrl: string;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Stellar anchoring statistics
 */
export interface StellarStats {
  /** Total anchored payments */
  totalAnchored: number;
  
  /** Total pending */
  totalPending: number;
  
  /** Total failed */
  totalFailed: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Average time to anchor (milliseconds) */
  avgAnchorTimeMs: number;
  
  /** Total fees paid (in stroops) */
  totalFeesPaid: number;
  
  /** Anchors today */
  anchorsToday: number;
  
  /** Anchors this week */
  anchorsThisWeek: number;
  
  /** Anchors this month */
  anchorsThisMonth: number;
}

/**
 * Anchor activity for charts
 */
export interface StellarAnchorActivity {
  /** Date (ISO string, date only) */
  date: string;
  
  /** Number of successful anchors */
  anchored: number;
  
  /** Number of failed anchors */
  failed: number;
  
  /** Total fees paid that day */
  fees: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display text for anchor status
 */
export function getAnchorStatusDisplay(status: StellarAnchorStatus): string {
  const displays: Record<StellarAnchorStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    anchored: 'Anchored',
    failed: 'Failed',
    verified: 'Verified',
  };
  return displays[status];
}

/**
 * Get color class for anchor status
 */
export function getAnchorStatusColor(status: StellarAnchorStatus): string {
  const colors: Record<StellarAnchorStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    anchored: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    verified: 'bg-emerald-100 text-emerald-800',
  };
  return colors[status];
}

/**
 * Get icon for anchor status
 */
export function getAnchorStatusIcon(status: StellarAnchorStatus): string {
  const icons: Record<StellarAnchorStatus, string> = {
    pending: 'schedule',
    processing: 'sync',
    anchored: 'verified',
    failed: 'error',
    verified: 'verified_user',
  };
  return icons[status];
}

/**
 * Format Stellar amount (stroops to XLM)
 */
export function formatStellarAmount(stroops: number): string {
  return (stroops / 10000000).toFixed(7);
}

/**
 * Format transaction hash for display
 */
export function formatTxHashDisplay(hash: string): string {
  if (!hash || hash.length < 12) return hash || 'N/A';
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * Get Stellar explorer URL for a transaction
 */
export function getStellarExplorerUrl(txHash: string, network: StellarNetwork = 'TESTNET'): string {
  const baseUrl = network === 'MAINNET'
    ? 'https://stellar.expert/explorer/public/tx'
    : 'https://stellar.expert/explorer/testnet/tx';
  return `${baseUrl}/${txHash}`;
}

/**
 * Get Stellar explorer URL for an account
 */
export function getStellarAccountUrl(publicKey: string, network: StellarNetwork = 'TESTNET'): string {
  const baseUrl = network === 'MAINNET'
    ? 'https://stellar.expert/explorer/public/account'
    : 'https://stellar.expert/explorer/testnet/account';
  return `${baseUrl}/${publicKey}`;
}
