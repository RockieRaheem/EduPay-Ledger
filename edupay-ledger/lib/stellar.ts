/**
 * Stellar Integration for eBursar
 *
 * This module handles writing payment proofs to the Stellar blockchain
 * as an immutable audit ledger.
 *
 * IMPORTANT: We do NOT:
 * - Move money on Stellar
 * - Create tokens
 * - Require wallets from users
 *
 * We ONLY write:
 * - Payment hashes
 * - Student ID
 * - School ID
 * - Timestamp
 * - Metadata
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import CryptoJS from "crypto-js";

// Stellar Network Configuration
const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET";
const HORIZON_URL =
  STELLAR_NETWORK === "MAINNET"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

// School's Stellar account for anchoring proofs
// In production, this would be a secure server-side key
const ANCHOR_SECRET_KEY = process.env.STELLAR_ANCHOR_SECRET_KEY || "";
const ANCHOR_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_STELLAR_ANCHOR_PUBLIC_KEY || "";

// Initialize Stellar server
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export interface PaymentProof {
  paymentId: string;
  studentId: string;
  schoolId: string;
  amount: number;
  currency: string;
  timestamp: string;
  transactionRef: string;
  receiptNumber: string;
}

export interface StellarAnchorResult {
  success: boolean;
  txHash?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Creates a SHA-256 hash of the payment data
 * This hash is what gets stored on Stellar
 */
export function createPaymentHash(proof: PaymentProof): string {
  const data = JSON.stringify({
    paymentId: proof.paymentId,
    studentId: proof.studentId,
    schoolId: proof.schoolId,
    amount: proof.amount,
    currency: proof.currency,
    timestamp: proof.timestamp,
    transactionRef: proof.transactionRef,
    receiptNumber: proof.receiptNumber,
  });

  return CryptoJS.SHA256(data).toString();
}

/**
 * Verifies a payment hash against Stellar records
 */
export function verifyPaymentHash(
  originalProof: PaymentProof,
  storedHash: string,
): boolean {
  const computedHash = createPaymentHash(originalProof);
  return computedHash === storedHash;
}

/**
 * Anchors a payment proof to Stellar as a memo in a transaction
 *
 * This is an async operation that should be:
 * - Queued for retry if it fails
 * - Logged regardless of outcome
 * - Non-blocking to the main payment flow
 */
export async function anchorPaymentToStellar(
  proof: PaymentProof,
): Promise<StellarAnchorResult> {
  // Skip if no anchor key configured (development mode)
  if (!ANCHOR_SECRET_KEY || !ANCHOR_PUBLIC_KEY) {
    console.warn(
      "Stellar anchor keys not configured - skipping blockchain write",
    );
    return {
      success: false,
      error: "Stellar anchor not configured",
    };
  }

  try {
    // Create the payment hash
    const paymentHash = createPaymentHash(proof);

    // Load the anchor account
    const sourceKeypair = StellarSdk.Keypair.fromSecret(ANCHOR_SECRET_KEY);
    const sourceAccount = await server.loadAccount(ANCHOR_PUBLIC_KEY);

    // Build the transaction with the hash as memo
    // We're doing a 0 XLM payment to self just to record the memo
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK === "MAINNET"
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: ANCHOR_PUBLIC_KEY, // Self-payment
          asset: StellarSdk.Asset.native(),
          amount: "0.0000001", // Minimum amount
        }),
      )
      .addMemo(StellarSdk.Memo.hash(paymentHash))
      .setTimeout(30)
      .build();

    // Sign the transaction
    transaction.sign(sourceKeypair);

    // Submit to Stellar
    const result = await server.submitTransaction(transaction);

    return {
      success: true,
      txHash: result.hash,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("Failed to anchor payment to Stellar:", error);

    return {
      success: false,
      error: error.message || "Unknown Stellar error",
    };
  }
}

/**
 * Retrieves a transaction from Stellar by hash
 * Used to verify audit trail
 */
export async function getTransactionByHash(txHash: string) {
  try {
    const transaction = await server.transactions().transaction(txHash).call();
    return transaction;
  } catch (error) {
    console.error("Failed to retrieve Stellar transaction:", error);
    return null;
  }
}

/**
 * Queue structure for retry logic
 */
interface QueuedAnchor {
  proof: PaymentProof;
  attempts: number;
  lastAttempt?: Date;
}

// In-memory queue for failed anchors (in production, use persistent storage)
const anchorQueue: QueuedAnchor[] = [];
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 60000; // 1 minute

/**
 * Adds a payment to the anchor queue for retry
 */
export function queueForRetry(proof: PaymentProof) {
  anchorQueue.push({
    proof,
    attempts: 0,
  });
}

/**
 * Processes the anchor queue
 * Should be called periodically (e.g., by a cron job or background worker)
 */
export async function processAnchorQueue(): Promise<void> {
  const now = new Date();

  for (let i = anchorQueue.length - 1; i >= 0; i--) {
    const item = anchorQueue[i];

    // Skip if not enough time has passed since last attempt
    if (item.lastAttempt) {
      const timeSinceLastAttempt = now.getTime() - item.lastAttempt.getTime();
      if (timeSinceLastAttempt < RETRY_DELAY_MS * (item.attempts + 1)) {
        continue;
      }
    }

    // Try to anchor
    const result = await anchorPaymentToStellar(item.proof);

    if (result.success) {
      // Remove from queue on success
      anchorQueue.splice(i, 1);
      console.log(
        `Successfully anchored queued payment ${item.proof.paymentId}`,
      );
    } else {
      item.attempts++;
      item.lastAttempt = now;

      if (item.attempts >= MAX_RETRY_ATTEMPTS) {
        // Max retries reached - log and remove
        console.error(
          `Max retries reached for payment ${item.proof.paymentId}`,
        );
        anchorQueue.splice(i, 1);
      }
    }
  }
}

/**
 * Format a Stellar transaction hash for display
 * Shows truncated version for UI
 */
export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Get the Stellar explorer URL for a transaction
 */
export function getStellarExplorerUrl(txHash: string): string {
  const baseUrl =
    STELLAR_NETWORK === "MAINNET"
      ? "https://stellar.expert/explorer/public/tx"
      : "https://stellar.expert/explorer/testnet/tx";
  return `${baseUrl}/${txHash}`;
}
