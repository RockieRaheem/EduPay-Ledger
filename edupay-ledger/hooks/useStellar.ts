/**
 * useStellar Hook
 * 
 * Provides React state management for Stellar blockchain integration.
 * Handles anchor status, verification, statistics, and real-time updates.
 * 
 * @author eBursar Team
 * @version 2.0.0
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
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
  getStellarConfig,
  isStellarConfigured,
  getStellarExplorerUrl,
  formatTxHash,
  type PaymentProof,
  type StellarAnchorResult,
  type StellarAnchorStatus,
  type StellarVerificationResult,
  type StellarHealthStatus,
  type StellarStats,
  type AnchorPriority,
} from '@/lib/services/stellar.service';
import { DBStellarAnchor } from '@/lib/db';
import { useFirebaseAuth } from '@/contexts/AuthContext';

// ============================================================================
// TYPES
// ============================================================================

interface UseStellarOptions {
  /** Auto-refresh interval in milliseconds (0 to disable) */
  autoRefreshInterval?: number;
  
  /** Auto-process pending anchors */
  autoProcess?: boolean;
  
  /** Auto-process interval in milliseconds */
  autoProcessInterval?: number;
  
  /** Use real-time subscription for updates */
  realtime?: boolean;
}

interface UseStellarReturn {
  // Configuration
  isConfigured: boolean;
  config: ReturnType<typeof getStellarConfig>;
  
  // Health & Status
  healthStatus: StellarHealthStatus | null;
  stats: StellarStats | null;
  
  // Anchors
  anchors: DBStellarAnchor[];
  pendingCount: number;
  failedCount: number;
  
  // Actions
  anchorPayment: (proof: PaymentProof, priority?: AnchorPriority) => Promise<StellarAnchorResult>;
  retryAnchor: (anchorId: string) => Promise<StellarAnchorResult>;
  verifyAnchor: (anchorId: string) => Promise<StellarVerificationResult>;
  verifyByReceipt: (receiptNumber: string, amount?: number) => Promise<{
    isVerified: boolean;
    message: string;
    explorerUrl?: string;
  }>;
  processQueue: () => Promise<{ processed: number; succeeded: number; failed: number }>;
  syncToCloud: () => Promise<{ synced: number; errors: number }>;
  
  // Queries
  getAnchorByPayment: (paymentId: string) => Promise<DBStellarAnchor | undefined>;
  getAnchorByReceipt: (receiptNumber: string) => Promise<DBStellarAnchor | undefined>;
  
  // State
  isLoading: boolean;
  isProcessing: boolean;
  isSyncing: boolean;
  error: string | null;
  
  // Refresh
  refresh: () => Promise<void>;
  
  // Utilities
  getExplorerUrl: (txHash: string) => string;
  formatHash: (hash: string) => string;
}

interface UseStellarAnchorOptions {
  /** Payment ID to track */
  paymentId?: string;
  
  /** Receipt number to track */
  receiptNumber?: string;
  
  /** Auto-refresh while pending */
  autoRefresh?: boolean;
  
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
}

interface UseStellarAnchorReturn {
  anchor: DBStellarAnchor | null;
  status: StellarAnchorStatus | null;
  isAnchored: boolean;
  isVerified: boolean;
  isPending: boolean;
  isFailed: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  isLoading: boolean;
  error: string | null;
  retry: () => Promise<StellarAnchorResult>;
  verify: () => Promise<StellarVerificationResult>;
  refresh: () => Promise<void>;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Main hook for Stellar blockchain integration
 * Provides comprehensive access to anchoring functionality
 */
export function useStellar(options: UseStellarOptions = {}): UseStellarReturn {
  const {
    autoRefreshInterval = 60000, // 1 minute
    autoProcess = false,
    autoProcessInterval = 300000, // 5 minutes
  } = options;

  const { user } = useFirebaseAuth();
  const schoolId = user?.schoolId;

  // State
  const [healthStatus, setHealthStatus] = useState<StellarHealthStatus | null>(null);
  const [stats, setStats] = useState<StellarStats | null>(null);
  const [anchors, setAnchors] = useState<DBStellarAnchor[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for intervals
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const config = useMemo(() => getStellarConfig(), []);
  const isConfigured = useMemo(() => isStellarConfigured(), []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [health, statsData, pending, failed, anchorList] = await Promise.all([
        getFullHealthStatus(),
        getStellarStats(schoolId),
        getPendingAnchorCount(),
        getFailedAnchorCount(),
        schoolId ? getSchoolAnchors(schoolId, { limit: 50 }) : Promise.resolve([]),
      ]);

      setHealthStatus(health);
      setStats(statsData);
      setPendingCount(pending);
      setFailedCount(failed);
      setAnchors(anchorList);
    } catch (err: any) {
      console.error('[useStellar] Failed to fetch data:', err);
      setError(err.message || 'Failed to load Stellar data');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(fetchData, autoRefreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshInterval, fetchData]);

  // Auto-process pending anchors
  useEffect(() => {
    if (autoProcess && isConfigured && autoProcessInterval > 0) {
      processIntervalRef.current = setInterval(async () => {
        if (!isProcessing) {
          await handleProcessQueue();
        }
      }, autoProcessInterval);
    }

    return () => {
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
      }
    };
  }, [autoProcess, isConfigured, autoProcessInterval]);

  // Anchor a payment
  const handleAnchorPayment = useCallback(async (
    proof: PaymentProof,
    priority: AnchorPriority = 'normal'
  ): Promise<StellarAnchorResult> => {
    try {
      const { result } = await anchorPayment(proof, priority);
      
      // Refresh data after anchoring
      await fetchData();
      
      return result;
    } catch (err: any) {
      console.error('[useStellar] Anchor failed:', err);
      throw err;
    }
  }, [fetchData]);

  // Retry an anchor
  const handleRetryAnchor = useCallback(async (anchorId: string): Promise<StellarAnchorResult> => {
    try {
      const result = await retryAnchor(anchorId);
      await fetchData();
      return result;
    } catch (err: any) {
      console.error('[useStellar] Retry failed:', err);
      throw err;
    }
  }, [fetchData]);

  // Verify an anchor
  const handleVerifyAnchor = useCallback(async (anchorId: string): Promise<StellarVerificationResult> => {
    try {
      const result = await verifyAnchor(anchorId);
      await fetchData();
      return result;
    } catch (err: any) {
      console.error('[useStellar] Verify failed:', err);
      throw err;
    }
  }, [fetchData]);

  // Verify by receipt
  const handleVerifyByReceipt = useCallback(async (
    receiptNumber: string,
    amount?: number
  ) => {
    return verifyByReceiptNumber(receiptNumber, amount);
  }, []);

  // Process queue
  const handleProcessQueue = useCallback(async () => {
    if (isProcessing) return { processed: 0, succeeded: 0, failed: 0 };
    
    try {
      setIsProcessing(true);
      const result = await processPendingAnchors();
      await fetchData();
      return result;
    } catch (err: any) {
      console.error('[useStellar] Queue processing failed:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, fetchData]);

  // Sync to Firebase
  const handleSyncToCloud = useCallback(async () => {
    if (!schoolId || isSyncing) return { synced: 0, errors: 0 };
    
    try {
      setIsSyncing(true);
      const result = await syncAnchorsToFirebase(schoolId);
      await fetchData();
      return result;
    } catch (err: any) {
      console.error('[useStellar] Sync failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [schoolId, isSyncing, fetchData]);

  return {
    // Configuration
    isConfigured,
    config,
    
    // Health & Status
    healthStatus,
    stats,
    
    // Anchors
    anchors,
    pendingCount,
    failedCount,
    
    // Actions
    anchorPayment: handleAnchorPayment,
    retryAnchor: handleRetryAnchor,
    verifyAnchor: handleVerifyAnchor,
    verifyByReceipt: handleVerifyByReceipt,
    processQueue: handleProcessQueue,
    syncToCloud: handleSyncToCloud,
    
    // Queries
    getAnchorByPayment: getAnchorByPaymentId,
    getAnchorByReceipt: getAnchorByReceiptNumber,
    
    // State
    isLoading,
    isProcessing,
    isSyncing,
    error,
    
    // Refresh
    refresh: fetchData,
    
    // Utilities
    getExplorerUrl: getStellarExplorerUrl,
    formatHash: formatTxHash,
  };
}

// ============================================================================
// SINGLE ANCHOR HOOK
// ============================================================================

/**
 * Hook for tracking a single anchor's status
 * Useful for payment receipts and verification displays
 */
export function useStellarAnchor(options: UseStellarAnchorOptions = {}): UseStellarAnchorReturn {
  const {
    paymentId,
    receiptNumber,
    autoRefresh = true,
    refreshInterval = 5000, // 5 seconds
  } = options;

  const [anchor, setAnchor] = useState<DBStellarAnchor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch anchor
  const fetchAnchor = useCallback(async () => {
    if (!paymentId && !receiptNumber) {
      setAnchor(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let result: DBStellarAnchor | undefined;

      if (paymentId) {
        result = await getAnchorByPaymentId(paymentId);
      } else if (receiptNumber) {
        result = await getAnchorByReceiptNumber(receiptNumber);
      }

      setAnchor(result || null);
    } catch (err: any) {
      console.error('[useStellarAnchor] Failed to fetch:', err);
      setError(err.message || 'Failed to load anchor');
    } finally {
      setIsLoading(false);
    }
  }, [paymentId, receiptNumber]);

  // Initial load
  useEffect(() => {
    fetchAnchor();
  }, [fetchAnchor]);

  // Auto-refresh while pending
  useEffect(() => {
    const shouldRefresh = autoRefresh && anchor && 
      (anchor.status === 'pending' || anchor.status === 'processing');

    if (shouldRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(fetchAnchor, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, anchor?.status, refreshInterval, fetchAnchor]);

  // Derived state
  const status = anchor?.status || null;
  const isAnchored = status === 'anchored' || status === 'verified';
  const isVerified = status === 'verified';
  const isPending = status === 'pending' || status === 'processing';
  const isFailed = status === 'failed';
  const txHash = anchor?.txHash || null;
  const explorerUrl = txHash ? getStellarExplorerUrl(txHash) : null;

  // Retry
  const handleRetry = useCallback(async (): Promise<StellarAnchorResult> => {
    if (!anchor) {
      return { success: false, error: 'No anchor to retry' };
    }
    const result = await retryAnchor(anchor.id);
    await fetchAnchor();
    return result;
  }, [anchor, fetchAnchor]);

  // Verify
  const handleVerify = useCallback(async (): Promise<StellarVerificationResult> => {
    if (!anchor) {
      return {
        isValid: false,
        proofMatches: false,
        transactionExists: false,
        verifiedAt: new Date().toISOString(),
        error: 'No anchor to verify',
      };
    }
    const result = await verifyAnchor(anchor.id);
    await fetchAnchor();
    return result;
  }, [anchor, fetchAnchor]);

  return {
    anchor,
    status,
    isAnchored,
    isVerified,
    isPending,
    isFailed,
    txHash,
    explorerUrl,
    isLoading,
    error,
    retry: handleRetry,
    verify: handleVerify,
    refresh: fetchAnchor,
  };
}

// ============================================================================
// VERIFICATION HOOK
// ============================================================================

interface UseStellarVerificationOptions {
  receiptNumber: string;
  amount?: number;
}

interface UseStellarVerificationReturn {
  isVerified: boolean;
  message: string;
  explorerUrl: string | null;
  anchoredAt: string | null;
  isLoading: boolean;
  error: string | null;
  verify: () => Promise<void>;
}

/**
 * Hook for public verification of payments
 * Safe for use in parent portal and public verification pages
 */
export function useStellarVerification(
  options: UseStellarVerificationOptions
): UseStellarVerificationReturn {
  const { receiptNumber, amount } = options;

  const [isVerified, setIsVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [anchoredAt, setAnchoredAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    if (!receiptNumber) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await verifyByReceiptNumber(receiptNumber, amount);

      setIsVerified(result.isVerified);
      setMessage(result.message);
      setExplorerUrl(result.explorerUrl || null);
      setAnchoredAt(result.anchoredAt || null);
    } catch (err: any) {
      console.error('[useStellarVerification] Failed:', err);
      setError(err.message || 'Verification failed');
      setIsVerified(false);
      setMessage('Verification failed');
    } finally {
      setIsLoading(false);
    }
  }, [receiptNumber, amount]);

  // Auto-verify on mount
  useEffect(() => {
    if (receiptNumber) {
      verify();
    }
  }, [receiptNumber, verify]);

  return {
    isVerified,
    message,
    explorerUrl,
    anchoredAt,
    isLoading,
    error,
    verify,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  UseStellarOptions,
  UseStellarReturn,
  UseStellarAnchorOptions,
  UseStellarAnchorReturn,
  UseStellarVerificationOptions,
  UseStellarVerificationReturn,
};
