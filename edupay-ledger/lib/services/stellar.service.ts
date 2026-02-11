/**
 * Stellar Anchor Service
 *
 * Provides database-backed management of Stellar blockchain anchors.
 * This service handles persistent storage, retry logic, and verification
 * for payment proofs anchored to the Stellar network.
 *
 * @author eBursar Team
 * @version 2.0.0
 */

import { db, DBStellarAnchor } from "@/lib/db";
import {
  anchorPaymentToStellar,
  createPaymentHash,
  verifyPaymentOnStellar,
  getStellarHealthStatus,
  getStellarConfig,
  getStellarExplorerUrl,
  formatTxHash,
  isStellarConfigured,
  generateAnchorId,
  type PaymentProof,
  type StellarAnchorResult,
  type StellarAnchorStatus,
  type StellarVerificationResult,
  type StellarHealthStatus,
  type StellarStats,
  type AnchorPriority,
} from "@/lib/stellar";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import {
  db as firebaseDb,
  initializeFirebase,
  COLLECTIONS,
} from "@/lib/firebase";

// ============================================================================
// CONSTANTS
// ============================================================================

const STELLAR_ANCHORS_COLLECTION = "stellarAnchors";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 60000; // 1 minute
const MAX_BATCH_SIZE = 10;

// ============================================================================
// ANCHOR CREATION
// ============================================================================

/**
 * Creates a new anchor record for a payment
 * The anchor will be processed asynchronously
 *
 * @param proof - Payment proof data
 * @param priority - Processing priority
 * @returns Created anchor record
 */
export async function createAnchorRecord(
  proof: PaymentProof,
  priority: AnchorPriority = "normal",
): Promise<DBStellarAnchor> {
  const config = getStellarConfig();
  const now = new Date().toISOString();

  const anchor: DBStellarAnchor = {
    id: generateAnchorId(),
    paymentId: proof.paymentId,
    receiptNumber: proof.receiptNumber,
    schoolId: proof.schoolId,
    proofHash: createPaymentHash(proof),
    status: "pending",
    priority,
    network: config.network,
    attempts: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    createdAt: now,
    syncStatus: "pending",
  };

  // Store in IndexedDB for offline support
  await db.stellarAnchors.add(anchor);

  // Also store proof data for later processing
  // We'll need this if processing happens after restart
  await storeProofData(anchor.id, proof);

  console.log(
    `[StellarService] Created anchor record ${anchor.id} for payment ${proof.paymentId}`,
  );

  return anchor;
}

/**
 * Stores proof data separately for retry processing
 */
async function storeProofData(
  anchorId: string,
  proof: PaymentProof,
): Promise<void> {
  // Store in localStorage as backup (IndexedDB primary)
  try {
    const key = `stellar_proof_${anchorId}`;
    localStorage.setItem(key, JSON.stringify(proof));
  } catch (error) {
    console.warn(
      "[StellarService] Failed to store proof in localStorage:",
      error,
    );
  }
}

/**
 * Retrieves stored proof data
 */
async function getStoredProofData(
  anchorId: string,
): Promise<PaymentProof | null> {
  try {
    const key = `stellar_proof_${anchorId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(
      "[StellarService] Failed to retrieve proof from localStorage:",
      error,
    );
    return null;
  }
}

/**
 * Cleans up stored proof data after successful anchor
 */
async function cleanupProofData(anchorId: string): Promise<void> {
  try {
    const key = `stellar_proof_${anchorId}`;
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// ANCHOR PROCESSING
// ============================================================================

/**
 * Anchors a payment to Stellar and creates a database record
 * This is the main entry point for the payment flow
 *
 * @param proof - Payment proof data
 * @param priority - Processing priority
 * @returns Anchor result
 */
export async function anchorPayment(
  proof: PaymentProof,
  priority: AnchorPriority = "normal",
): Promise<{ anchor: DBStellarAnchor; result: StellarAnchorResult }> {
  // Create the anchor record first
  const anchor = await createAnchorRecord(proof, priority);

  // Attempt immediate anchoring
  const result = await processAnchor(anchor, proof);

  return { anchor, result };
}

/**
 * Processes a single anchor attempt
 *
 * @param anchor - Anchor record
 * @param proof - Payment proof (optional, will be retrieved if not provided)
 * @returns Anchor result
 */
export async function processAnchor(
  anchor: DBStellarAnchor,
  proof?: PaymentProof,
): Promise<StellarAnchorResult> {
  const now = new Date().toISOString();

  // Get proof data if not provided
  if (!proof) {
    const storedProof = await getStoredProofData(anchor.id);
    if (!storedProof) {
      const errorResult: StellarAnchorResult = {
        success: false,
        error: "Proof data not found",
        errorCode: "UNKNOWN",
      };
      await updateAnchorStatus(anchor.id, "failed", {
        lastError: "Proof data not found",
        lastAttemptAt: now,
      });
      return errorResult;
    }
    proof = storedProof;
  }

  // Update status to processing
  await updateAnchorStatus(anchor.id, "processing", {
    attempts: anchor.attempts + 1,
    lastAttemptAt: now,
  });

  // Attempt to anchor
  const result = await anchorPaymentToStellar(proof);

  if (result.success && result.txHash) {
    // Success! Update the record
    await updateAnchorStatus(anchor.id, "anchored", {
      txHash: result.txHash,
      ledgerNumber: result.ledgerNumber,
      anchoredAt: result.anchoredAt || now,
      lastError: undefined,
      lastErrorCode: undefined,
    });

    // Cleanup stored proof
    await cleanupProofData(anchor.id);

    console.log(
      `[StellarService] Successfully anchored ${anchor.id} - TX: ${result.txHash}`,
    );
  } else {
    // Failed - schedule retry or mark as failed
    const newAttempts = anchor.attempts + 1;

    if (newAttempts >= anchor.maxAttempts) {
      await updateAnchorStatus(anchor.id, "failed", {
        lastError: result.error,
        lastErrorCode: result.errorCode,
      });
      console.error(`[StellarService] Max retries reached for ${anchor.id}`);
    } else {
      // Calculate next retry time with exponential backoff
      const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, newAttempts - 1);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      await updateAnchorStatus(anchor.id, "pending", {
        lastError: result.error,
        lastErrorCode: result.errorCode,
        nextRetryAt,
      });
      console.log(
        `[StellarService] Scheduled retry for ${anchor.id} at ${nextRetryAt}`,
      );
    }
  }

  return result;
}

/**
 * Updates an anchor's status and fields
 */
async function updateAnchorStatus(
  anchorId: string,
  status: StellarAnchorStatus,
  updates: Partial<DBStellarAnchor> = {},
): Promise<void> {
  await db.stellarAnchors.update(anchorId, {
    status,
    ...updates,
    syncStatus: "pending",
  });
}

// ============================================================================
// QUEUE PROCESSING
// ============================================================================

/**
 * Processes pending anchors in the queue
 * Should be called periodically by a background worker
 *
 * @param batchSize - Maximum number of anchors to process
 * @returns Results summary
 */
export async function processPendingAnchors(
  batchSize: number = MAX_BATCH_SIZE,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Get pending anchors ready for processing
  const pendingAnchors = await db.stellarAnchors
    .where("status")
    .equals("pending")
    .and((anchor) => {
      // Check if ready for retry
      if (!anchor.nextRetryAt) return true;
      return new Date(anchor.nextRetryAt) <= now;
    })
    .limit(batchSize)
    .sortBy("priority");

  // Sort by priority (critical first)
  const priorityOrder: Record<AnchorPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  pendingAnchors.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  console.log(
    `[StellarService] Processing ${pendingAnchors.length} pending anchors`,
  );

  for (const anchor of pendingAnchors) {
    const result = await processAnchor(anchor);
    processed++;

    if (result.success) {
      succeeded++;
    } else if (anchor.attempts + 1 >= anchor.maxAttempts) {
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Retries a specific failed anchor
 */
export async function retryAnchor(
  anchorId: string,
): Promise<StellarAnchorResult> {
  const anchor = await db.stellarAnchors.get(anchorId);

  if (!anchor) {
    return { success: false, error: "Anchor not found", errorCode: "UNKNOWN" };
  }

  // Reset attempts and status for retry
  await updateAnchorStatus(anchorId, "pending", {
    attempts: 0,
    lastError: undefined,
    lastErrorCode: undefined,
    nextRetryAt: undefined,
  });

  return processAnchor({ ...anchor, attempts: 0 });
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Gets an anchor record by ID
 */
export async function getAnchor(
  anchorId: string,
): Promise<DBStellarAnchor | undefined> {
  return db.stellarAnchors.get(anchorId);
}

/**
 * Gets an anchor by payment ID
 */
export async function getAnchorByPaymentId(
  paymentId: string,
): Promise<DBStellarAnchor | undefined> {
  return db.stellarAnchors.where("paymentId").equals(paymentId).first();
}

/**
 * Gets an anchor by receipt number
 */
export async function getAnchorByReceiptNumber(
  receiptNumber: string,
): Promise<DBStellarAnchor | undefined> {
  return db.stellarAnchors.where("receiptNumber").equals(receiptNumber).first();
}

/**
 * Gets all anchors for a school
 */
export async function getSchoolAnchors(
  schoolId: string,
  options: {
    status?: StellarAnchorStatus;
    limit?: number;
    offset?: number;
  } = {},
): Promise<DBStellarAnchor[]> {
  let query = db.stellarAnchors.where("schoolId").equals(schoolId);

  if (options.status) {
    query = query.and((anchor) => anchor.status === options.status);
  }

  let results = await query.toArray();

  // Sort by creation date descending
  results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Apply pagination
  if (options.offset) {
    results = results.slice(options.offset);
  }
  if (options.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Gets pending anchor count
 */
export async function getPendingAnchorCount(): Promise<number> {
  return db.stellarAnchors.where("status").equals("pending").count();
}

/**
 * Gets failed anchor count
 */
export async function getFailedAnchorCount(): Promise<number> {
  return db.stellarAnchors.where("status").equals("failed").count();
}

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Verifies an anchor on the Stellar blockchain
 */
export async function verifyAnchor(
  anchorId: string,
): Promise<StellarVerificationResult> {
  const anchor = await db.stellarAnchors.get(anchorId);

  if (!anchor) {
    return {
      isValid: false,
      proofMatches: false,
      transactionExists: false,
      verifiedAt: new Date().toISOString(),
      error: "Anchor not found",
    };
  }

  if (!anchor.txHash) {
    return {
      isValid: false,
      proofMatches: false,
      transactionExists: false,
      verifiedAt: new Date().toISOString(),
      error: "Anchor not yet processed",
    };
  }

  // Get stored proof data
  const proof = await getStoredProofData(anchorId);

  if (!proof) {
    // Reconstruct minimal proof for hash verification
    return {
      isValid: false,
      proofMatches: false,
      transactionExists: true,
      verifiedAt: new Date().toISOString(),
      error: "Proof data not available for verification",
    };
  }

  const result = await verifyPaymentOnStellar(proof, anchor.txHash);

  // Update anchor with verification status
  if (result.isValid) {
    await updateAnchorStatus(anchorId, "verified", {
      verifiedAt: result.verifiedAt,
    });
  }

  return result;
}

/**
 * Public verification by receipt number
 * This is safe to expose as it only returns non-sensitive information
 */
export async function verifyByReceiptNumber(
  receiptNumber: string,
  amount?: number,
): Promise<{
  isVerified: boolean;
  message: string;
  explorerUrl?: string;
  anchoredAt?: string;
}> {
  const anchor = await getAnchorByReceiptNumber(receiptNumber);

  if (!anchor) {
    return {
      isVerified: false,
      message: "Receipt not found in blockchain records",
    };
  }

  if (anchor.status !== "anchored" && anchor.status !== "verified") {
    return {
      isVerified: false,
      message:
        anchor.status === "pending"
          ? "Payment is being processed for blockchain verification"
          : "Blockchain verification failed",
    };
  }

  if (!anchor.txHash) {
    return {
      isVerified: false,
      message: "Transaction hash not available",
    };
  }

  return {
    isVerified: true,
    message: "Payment verified on Stellar blockchain",
    explorerUrl: getStellarExplorerUrl(anchor.txHash),
    anchoredAt: anchor.anchoredAt,
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Gets Stellar anchoring statistics for a school
 */
export async function getStellarStats(
  schoolId?: string,
): Promise<StellarStats> {
  let anchors: DBStellarAnchor[];

  if (schoolId) {
    anchors = await db.stellarAnchors
      .where("schoolId")
      .equals(schoolId)
      .toArray();
  } else {
    anchors = await db.stellarAnchors.toArray();
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const anchored = anchors.filter(
    (a) => a.status === "anchored" || a.status === "verified",
  );
  const pending = anchors.filter(
    (a) => a.status === "pending" || a.status === "processing",
  );
  const failed = anchors.filter((a) => a.status === "failed");

  // Calculate time-based metrics
  const anchorsToday = anchored.filter(
    (a) => a.anchoredAt && new Date(a.anchoredAt) >= todayStart,
  ).length;

  const anchorsThisWeek = anchored.filter(
    (a) => a.anchoredAt && new Date(a.anchoredAt) >= weekStart,
  ).length;

  const anchorsThisMonth = anchored.filter(
    (a) => a.anchoredAt && new Date(a.anchoredAt) >= monthStart,
  ).length;

  // Calculate average anchor time (for anchored records that have both timestamps)
  const anchorTimes = anchored
    .filter((a) => a.anchoredAt && a.createdAt)
    .map(
      (a) =>
        new Date(a.anchoredAt!).getTime() - new Date(a.createdAt).getTime(),
    );

  const avgAnchorTimeMs =
    anchorTimes.length > 0
      ? anchorTimes.reduce((sum, t) => sum + t, 0) / anchorTimes.length
      : 0;

  const totalAnchored = anchored.length;
  const total = anchors.length;
  const successRate = total > 0 ? (totalAnchored / total) * 100 : 0;

  return {
    totalAnchored,
    totalPending: pending.length,
    totalFailed: failed.length,
    successRate: Math.round(successRate * 100) / 100,
    avgAnchorTimeMs: Math.round(avgAnchorTimeMs),
    totalFeesPaid: totalAnchored * 100, // 100 stroops per transaction
    anchorsToday,
    anchorsThisWeek,
    anchorsThisMonth,
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Gets comprehensive Stellar health status
 */
export async function getFullHealthStatus(): Promise<
  StellarHealthStatus & {
    stats: StellarStats;
  }
> {
  const [healthStatus, stats, pendingCount, failedCount] = await Promise.all([
    getStellarHealthStatus(),
    getStellarStats(),
    getPendingAnchorCount(),
    getFailedAnchorCount(),
  ]);

  return {
    ...healthStatus,
    pendingAnchors: pendingCount,
    failedAnchors: failedCount,
    stats,
  };
}

// ============================================================================
// SYNC WITH FIREBASE
// ============================================================================

/**
 * Syncs local anchor records to Firebase
 */
export async function syncAnchorsToFirebase(schoolId: string): Promise<{
  synced: number;
  errors: number;
}> {
  initializeFirebase();

  const pendingAnchors = await db.stellarAnchors
    .where("syncStatus")
    .equals("pending")
    .and((a) => a.schoolId === schoolId)
    .toArray();

  let synced = 0;
  let errors = 0;

  const batch = writeBatch(firebaseDb);
  const batchSize = 500; // Firestore batch limit

  for (let i = 0; i < pendingAnchors.length; i += batchSize) {
    const chunk = pendingAnchors.slice(i, i + batchSize);

    for (const anchor of chunk) {
      try {
        const anchorRef = doc(
          firebaseDb,
          COLLECTIONS.SCHOOLS,
          schoolId,
          STELLAR_ANCHORS_COLLECTION,
          anchor.id,
        );

        // Prepare data for Firebase (convert dates, remove local fields)
        const firebaseData = {
          ...anchor,
          createdAt: Timestamp.fromDate(new Date(anchor.createdAt)),
          anchoredAt: anchor.anchoredAt
            ? Timestamp.fromDate(new Date(anchor.anchoredAt))
            : null,
          verifiedAt: anchor.verifiedAt
            ? Timestamp.fromDate(new Date(anchor.verifiedAt))
            : null,
          lastAttemptAt: anchor.lastAttemptAt
            ? Timestamp.fromDate(new Date(anchor.lastAttemptAt))
            : null,
          nextRetryAt: anchor.nextRetryAt
            ? Timestamp.fromDate(new Date(anchor.nextRetryAt))
            : null,
        };

        batch.set(anchorRef, firebaseData, { merge: true });
        synced++;
      } catch (error) {
        console.error(
          `[StellarService] Failed to sync anchor ${anchor.id}:`,
          error,
        );
        errors++;
      }
    }

    // Commit the batch
    try {
      await batch.commit();

      // Mark as synced in local DB
      await Promise.all(
        chunk.map((a) =>
          db.stellarAnchors.update(a.id, { syncStatus: "synced" }),
        ),
      );
    } catch (error) {
      console.error("[StellarService] Batch commit failed:", error);
      errors += chunk.length;
      synced -= chunk.length;
    }
  }

  return { synced, errors };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // From stellar.ts
  createPaymentHash,
  formatTxHash,
  getStellarExplorerUrl,
  getStellarConfig,
  isStellarConfigured,
  getStellarHealthStatus,
};

export type {
  PaymentProof,
  StellarAnchorResult,
  StellarAnchorStatus,
  StellarVerificationResult,
  StellarHealthStatus,
  StellarStats,
  AnchorPriority,
};
