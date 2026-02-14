/**
 * Stellar Blockchain Integration for eBursar
 *
 * Production-grade implementation for anchoring payment proofs to the Stellar blockchain.
 *
 * ARCHITECTURE:
 * - Every payment generates a cryptographic proof (SHA-256 hash)
 * - The hash is anchored to Stellar as a transaction memo
 * - This creates an immutable, publicly verifiable audit trail
 *
 * IMPORTANT: We do NOT:
 * - Move money on Stellar
 * - Create tokens or assets
 * - Require end-user wallets
 *
 * We ONLY write:
 * - Payment proof hashes
 * - Timestamps
 * - Metadata for verification
 *
 * @author eBursar Team
 * @version 2.0.0
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import CryptoJS from "crypto-js";
import type {
  PaymentProof,
  PaymentProofWithHash,
  StellarAnchorResult,
  StellarAnchorStatus,
  StellarConfig,
  StellarErrorCode,
  StellarHealthStatus,
  StellarNetwork,
  StellarTransactionDetails,
  StellarVerificationResult,
  StellarStats,
  DBStellarAnchor,
  AnchorPriority,
  StellarQueueItem,
} from "@/types/stellar";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Stellar configuration derived from environment variables
 */
const getConfig = (): StellarConfig => {
  const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ||
    "TESTNET") as StellarNetwork;

  return {
    network,
    horizonUrl:
      network === "MAINNET"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org",
    anchorPublicKey: process.env.NEXT_PUBLIC_STELLAR_ANCHOR_PUBLIC_KEY || "",
    isEnabled: !!(
      process.env.STELLAR_ANCHOR_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STELLAR_ANCHOR_PUBLIC_KEY
    ),
    maxRetryAttempts: parseInt(process.env.STELLAR_MAX_RETRIES || "5", 10),
    retryDelayMs: parseInt(process.env.STELLAR_RETRY_DELAY_MS || "60000", 10),
    useExponentialBackoff:
      process.env.STELLAR_USE_EXPONENTIAL_BACKOFF !== "false",
    autoProcessIntervalMs: parseInt(
      process.env.STELLAR_AUTO_PROCESS_INTERVAL_MS || "300000",
      10,
    ), // 5 minutes
  };
};

// Get server-side secret key (never exposed to client)
const getSecretKey = (): string => process.env.STELLAR_ANCHOR_SECRET_KEY || "";

// Lazy-initialized Stellar server connection
let _server: StellarSdk.Horizon.Server | null = null;
const getServer = (): StellarSdk.Horizon.Server => {
  if (!_server) {
    const config = getConfig();
    _server = new StellarSdk.Horizon.Server(config.horizonUrl);
  }
  return _server;
};

// Current proof format version for future compatibility
const PROOF_VERSION = "2.0.0";

// ============================================================================
// HASH GENERATION & VERIFICATION
// ============================================================================

/**
 * Creates a deterministic SHA-256 hash of payment proof data.
 * The hash algorithm and data ordering MUST remain consistent for verification.
 *
 * @param proof - Payment proof data
 * @returns SHA-256 hash as hex string
 */
export function createPaymentHash(proof: PaymentProof): string {
  // Canonical JSON representation (sorted keys for determinism)
  const canonicalData = {
    paymentId: proof.paymentId,
    studentId: proof.studentId,
    schoolId: proof.schoolId,
    amount: proof.amount,
    currency: proof.currency,
    timestamp: proof.timestamp,
    transactionRef: proof.transactionRef,
    receiptNumber: proof.receiptNumber,
    // Optional fields included if present
    ...(proof.channel && { channel: proof.channel }),
    ...(proof.termId && { termId: proof.termId }),
    ...(proof.academicYear && { academicYear: proof.academicYear }),
  };

  // Sort keys for deterministic JSON
  const sortedData = JSON.stringify(
    canonicalData,
    Object.keys(canonicalData).sort(),
  );

  return CryptoJS.SHA256(sortedData).toString(CryptoJS.enc.Hex);
}

/**
 * Creates a payment proof with computed hash
 *
 * @param proof - Base payment proof
 * @returns Proof with hash and metadata
 */
export function createPaymentProofWithHash(
  proof: PaymentProof,
): PaymentProofWithHash {
  return {
    ...proof,
    proofHash: createPaymentHash(proof),
    hashAlgorithm: "SHA-256",
    proofVersion: PROOF_VERSION,
  };
}

/**
 * Verifies a payment hash against the original proof data
 *
 * @param proof - Original payment proof
 * @param storedHash - Hash to verify against
 * @returns Whether the hash matches
 */
export function verifyPaymentHash(
  proof: PaymentProof,
  storedHash: string,
): boolean {
  const computedHash = createPaymentHash(proof);
  // Use constant-time comparison to prevent timing attacks
  return (
    CryptoJS.SHA256(computedHash).toString() ===
    CryptoJS.SHA256(storedHash).toString()
  );
}

/**
 * Converts a hex hash to a format suitable for Stellar memo
 * Stellar hash memos require a 32-byte buffer
 *
 * @param hexHash - SHA-256 hash as hex string
 * @returns Buffer suitable for Stellar memo
 */
function hashToMemoBuffer(hexHash: string): Buffer {
  // SHA-256 produces 64 hex chars = 32 bytes, perfect for Stellar hash memo
  return Buffer.from(hexHash, "hex");
}

// ============================================================================
// STELLAR BLOCKCHAIN OPERATIONS
// ============================================================================

/**
 * Anchors a payment proof to the Stellar blockchain.
 *
 * This creates a minimal transaction (self-payment of 0.0000001 XLM)
 * with the payment hash as the transaction memo.
 *
 * The transaction is:
 * - Immutable once confirmed
 * - Publicly verifiable via Stellar explorer
 * - Timestamped by the Stellar network
 *
 * @param proof - Payment proof to anchor
 * @returns Result of the anchor operation
 */
export async function anchorPaymentToStellar(
  proof: PaymentProof,
): Promise<StellarAnchorResult> {
  const config = getConfig();
  const secretKey = getSecretKey();

  // Validate configuration
  if (!config.isEnabled || !secretKey || !config.anchorPublicKey) {
    console.warn(
      "[Stellar] Anchor keys not configured - blockchain write skipped",
    );
    return {
      success: false,
      error: "Stellar anchor not configured",
      errorCode: "NOT_CONFIGURED",
      network: config.network,
    };
  }

  const server = getServer();
  const paymentHash = createPaymentHash(proof);

  try {
    // Load the anchor account
    const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
    const sourceAccount = await server.loadAccount(config.anchorPublicKey);

    // Determine network passphrase
    const networkPassphrase =
      config.network === "MAINNET"
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    // Build the transaction
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: config.anchorPublicKey, // Self-payment
          asset: StellarSdk.Asset.native(),
          amount: "0.0000001", // Minimum amount (1 stroop)
        }),
      )
      .addMemo(StellarSdk.Memo.hash(hashToMemoBuffer(paymentHash)))
      .setTimeout(30) // 30 second timeout
      .build();

    // Sign the transaction
    transaction.sign(sourceKeypair);

    // Submit to Stellar network
    const result = await server.submitTransaction(transaction);

    console.log(
      `[Stellar] Successfully anchored payment ${proof.paymentId} - TX: ${result.hash}`,
    );

    return {
      success: true,
      txHash: result.hash,
      ledgerNumber: result.ledger,
      anchoredAt: new Date().toISOString(),
      network: config.network,
      feePaid: parseInt(StellarSdk.BASE_FEE, 10),
    };
  } catch (error: any) {
    // Parse Stellar-specific errors
    const errorResult = parseStellarError(error);

    console.error(
      `[Stellar] Failed to anchor payment ${proof.paymentId}:`,
      errorResult.error,
    );

    return {
      success: false,
      error: errorResult.error,
      errorCode: errorResult.errorCode,
      network: config.network,
    };
  }
}

/**
 * Parses Stellar SDK errors into user-friendly messages
 */
function parseStellarError(error: any): {
  error: string;
  errorCode: StellarErrorCode;
} {
  // Network errors
  if (error.message?.includes("Network") || error.code === "ECONNREFUSED") {
    return { error: "Network connection failed", errorCode: "NETWORK_ERROR" };
  }

  // Horizon-specific errors
  if (error.response?.data?.extras?.result_codes) {
    const codes = error.response.data.extras.result_codes;

    if (codes.transaction === "tx_insufficient_balance") {
      return {
        error: "Insufficient XLM balance for fees",
        errorCode: "INSUFFICIENT_FUNDS",
      };
    }
    if (codes.transaction === "tx_bad_seq") {
      return {
        error: "Invalid sequence number - retry needed",
        errorCode: "INVALID_SEQUENCE",
      };
    }
    if (codes.transaction === "tx_too_late") {
      return { error: "Transaction timeout", errorCode: "TIMEOUT" };
    }
  }

  // Rate limiting
  if (error.response?.status === 429) {
    return {
      error: "Rate limited by Stellar network",
      errorCode: "RATE_LIMITED",
    };
  }

  return {
    error: error.message || "Unknown Stellar error",
    errorCode: "UNKNOWN",
  };
}

/**
 * Retrieves a transaction from Stellar by hash
 *
 * @param txHash - Stellar transaction hash
 * @returns Transaction details or null if not found
 */
export async function getTransactionByHash(
  txHash: string,
): Promise<StellarTransactionDetails | null> {
  if (!txHash) return null;

  const server = getServer();

  try {
    const tx = await server.transactions().transaction(txHash).call();

    // Parse ledger as number (Horizon returns it as number or ledger sequence)
    const ledgerNum =
      typeof tx.ledger === "number"
        ? tx.ledger
        : typeof tx.ledger_attr === "number"
          ? tx.ledger_attr
          : parseInt(String(tx.ledger), 10) || 0;

    return {
      hash: tx.hash,
      ledger: ledgerNum,
      createdAt: tx.created_at,
      sourceAccount: tx.source_account,
      feeCharged:
        typeof tx.fee_charged === "number"
          ? tx.fee_charged
          : parseInt(String(tx.fee_charged), 10),
      operationCount: tx.operation_count,
      memoType: tx.memo_type,
      memoValue: tx.memo_type === "hash" ? tx.memo : undefined,
      successful: tx.successful,
      resultXdr: tx.result_xdr,
    };
  } catch (error) {
    console.error("[Stellar] Failed to retrieve transaction:", txHash, error);
    return null;
  }
}

/**
 * Verifies a payment record exists on the Stellar blockchain
 *
 * @param proof - Original payment proof
 * @param txHash - Stellar transaction hash
 * @returns Verification result
 */
export async function verifyPaymentOnStellar(
  proof: PaymentProof,
  txHash: string,
): Promise<StellarVerificationResult> {
  const computedHash = createPaymentHash(proof);
  const now = new Date().toISOString();

  // Get transaction from blockchain
  const transaction = await getTransactionByHash(txHash);

  if (!transaction) {
    return {
      isValid: false,
      proofMatches: false,
      transactionExists: false,
      computedHash,
      verifiedAt: now,
      error: "Transaction not found on blockchain",
    };
  }

  // Compare memo hash with computed hash
  // Note: Stellar stores hash memos as base64-encoded hex
  const onChainHash = transaction.memoValue;
  const proofMatches = onChainHash === computedHash;

  return {
    isValid: proofMatches && transaction.successful,
    proofMatches,
    transactionExists: true,
    transaction,
    computedHash,
    onChainHash,
    verifiedAt: now,
  };
}

// ============================================================================
// ACCOUNT OPERATIONS
// ============================================================================

/**
 * Gets the health status of the Stellar integration
 */
export async function getStellarHealthStatus(): Promise<StellarHealthStatus> {
  const config = getConfig();

  const baseStatus: StellarHealthStatus = {
    isConfigured: config.isEnabled,
    isConnected: false,
    pendingAnchors: 0,
    failedAnchors: 0,
    network: config.network,
    horizonUrl: config.horizonUrl,
  };

  if (!config.isEnabled) {
    return baseStatus;
  }

  try {
    const server = getServer();
    const account = await server.loadAccount(config.anchorPublicKey);

    // Find XLM balance
    const xlmBalance = account.balances.find(
      (b: any) => b.asset_type === "native",
    );

    return {
      ...baseStatus,
      isConnected: true,
      accountBalance: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
    };
  } catch (error: any) {
    return {
      ...baseStatus,
      isConnected: false,
      lastError: error.message,
    };
  }
}

/**
 * Funds the anchor account on testnet using Friendbot
 * Only works on TESTNET!
 */
export async function fundTestnetAccount(): Promise<boolean> {
  const config = getConfig();

  if (config.network !== "TESTNET" || !config.anchorPublicKey) {
    console.error("[Stellar] Can only fund accounts on testnet");
    return false;
  }

  try {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(config.anchorPublicKey)}`,
    );

    if (response.ok) {
      console.log("[Stellar] Successfully funded testnet account");
      return true;
    }

    return false;
  } catch (error) {
    console.error("[Stellar] Failed to fund testnet account:", error);
    return false;
  }
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * In-memory queue for pending anchors (production should use persistent storage)
 * This is a fallback - primary queue should be in IndexedDB
 */
interface MemoryQueueItem {
  proof: PaymentProof;
  attempts: number;
  priority: AnchorPriority;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  createdAt: Date;
}

const memoryQueue: Map<string, MemoryQueueItem> = new Map();

/**
 * Adds a payment to the anchor retry queue
 */
export function queueForRetry(
  proof: PaymentProof,
  priority: AnchorPriority = "normal",
): void {
  const config = getConfig();
  const now = new Date();

  memoryQueue.set(proof.paymentId, {
    proof,
    attempts: 0,
    priority,
    createdAt: now,
    nextRetryAt: new Date(now.getTime() + config.retryDelayMs),
  });

  console.log(`[Stellar] Queued payment ${proof.paymentId} for retry`);
}

/**
 * Processes the anchor retry queue
 * Should be called periodically by a background worker
 *
 * @returns Number of successfully processed items
 */
export async function processAnchorQueue(): Promise<number> {
  const config = getConfig();
  const now = new Date();
  let successCount = 0;

  // Sort by priority and scheduled time
  const sortedQueue = Array.from(memoryQueue.entries())
    .filter(([_, item]) => !item.nextRetryAt || item.nextRetryAt <= now)
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
    });

  for (const [paymentId, item] of sortedQueue) {
    // Check max attempts
    if (item.attempts >= config.maxRetryAttempts) {
      console.error(`[Stellar] Max retries reached for payment ${paymentId}`);
      memoryQueue.delete(paymentId);
      continue;
    }

    // Attempt to anchor
    const result = await anchorPaymentToStellar(item.proof);

    if (result.success) {
      memoryQueue.delete(paymentId);
      successCount++;
      console.log(
        `[Stellar] Successfully anchored queued payment ${paymentId}`,
      );
    } else {
      // Update retry info
      const delay = config.useExponentialBackoff
        ? config.retryDelayMs * Math.pow(2, item.attempts)
        : config.retryDelayMs;

      item.attempts++;
      item.lastAttemptAt = now;
      item.nextRetryAt = new Date(now.getTime() + delay);
    }
  }

  return successCount;
}

/**
 * Gets the current queue status
 */
export function getQueueStatus(): {
  total: number;
  pending: number;
  byPriority: Record<AnchorPriority, number>;
} {
  const byPriority: Record<AnchorPriority, number> = {
    critical: 0,
    high: 0,
    normal: 0,
    low: 0,
  };

  // Use Array.from to avoid downlevelIteration requirement
  Array.from(memoryQueue.values()).forEach((item) => {
    byPriority[item.priority]++;
  });

  return {
    total: memoryQueue.size,
    pending: memoryQueue.size,
    byPriority,
  };
}

/**
 * Clears the retry queue (use with caution!)
 */
export function clearQueue(): void {
  memoryQueue.clear();
  console.warn("[Stellar] Anchor queue cleared");
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats a Stellar transaction hash for display
 */
export function formatTxHash(
  hash: string,
  prefixLen: number = 8,
  suffixLen: number = 6,
): string {
  if (!hash || hash.length < prefixLen + suffixLen) return hash || "N/A";
  return `${hash.slice(0, prefixLen)}...${hash.slice(-suffixLen)}`;
}

/**
 * Gets the Stellar explorer URL for a transaction
 */
export function getStellarExplorerUrl(txHash: string): string {
  const config = getConfig();
  const baseUrl =
    config.network === "MAINNET"
      ? "https://stellar.expert/explorer/public/tx"
      : "https://stellar.expert/explorer/testnet/tx";
  return `${baseUrl}/${txHash}`;
}

/**
 * Gets the Stellar explorer URL for an account
 */
export function getStellarAccountExplorerUrl(publicKey?: string): string {
  const config = getConfig();
  const key = publicKey || config.anchorPublicKey;
  const baseUrl =
    config.network === "MAINNET"
      ? "https://stellar.expert/explorer/public/account"
      : "https://stellar.expert/explorer/testnet/account";
  return `${baseUrl}/${key}`;
}

/**
 * Gets the current Stellar configuration (safe for client-side)
 */
export function getStellarConfig(): Omit<StellarConfig, "anchorSecretKey"> {
  return getConfig();
}

/**
 * Checks if Stellar integration is properly configured
 */
export function isStellarConfigured(): boolean {
  return getConfig().isEnabled;
}

/**
 * Generates a unique anchor ID
 */
export function generateAnchorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `SA-${timestamp}${random}`.toUpperCase();
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types for convenience
export type {
  PaymentProof,
  PaymentProofWithHash,
  StellarAnchorResult,
  StellarAnchorStatus,
  StellarConfig,
  StellarErrorCode,
  StellarHealthStatus,
  StellarNetwork,
  StellarTransactionDetails,
  StellarVerificationResult,
  StellarStats,
  DBStellarAnchor,
  AnchorPriority,
  StellarQueueItem,
};
