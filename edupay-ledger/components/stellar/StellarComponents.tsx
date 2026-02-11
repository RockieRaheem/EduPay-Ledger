/**
 * Stellar Blockchain UI Components
 * 
 * Reusable components for displaying Stellar anchor status,
 * verification badges, and blockchain transaction links.
 * 
 * @author eBursar Team
 * @version 2.0.0
 */

'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  useStellar, 
  useStellarAnchor, 
  useStellarVerification 
} from '@/hooks/useStellar';
import {
  getAnchorStatusDisplay,
  getAnchorStatusColor,
  getAnchorStatusIcon,
  formatTxHashDisplay,
  getStellarExplorerUrl,
} from '@/types/stellar';
import type { StellarAnchorStatus, StellarNetwork } from '@/types/stellar';
import type { DBStellarAnchor } from '@/lib/db';

// ============================================================================
// STATUS BADGE
// ============================================================================

interface StellarStatusBadgeProps {
  status: StellarAnchorStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Badge showing Stellar anchor status
 */
export function StellarStatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: StellarStatusBadgeProps) {
  const colorClass = getAnchorStatusColor(status);
  const icon = getAnchorStatusIcon(status);
  const label = getAnchorStatusDisplay(status);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colorClass} ${sizeClasses[size]}`}>
      {showIcon && (
        <span className="material-symbols-outlined text-sm">{icon}</span>
      )}
      {label}
    </span>
  );
}

// ============================================================================
// TRANSACTION LINK
// ============================================================================

interface StellarTxLinkProps {
  txHash: string;
  network?: StellarNetwork;
  showIcon?: boolean;
  truncate?: boolean;
  className?: string;
}

/**
 * Link to Stellar explorer for transaction
 */
export function StellarTxLink({
  txHash,
  network = 'TESTNET',
  showIcon = true,
  truncate = true,
  className = '',
}: StellarTxLinkProps) {
  const url = getStellarExplorerUrl(txHash, network);
  const displayHash = truncate ? formatTxHashDisplay(txHash) : txHash;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline ${className}`}
      title={`View on Stellar: ${txHash}`}
    >
      {showIcon && (
        <span className="material-symbols-outlined text-sm">open_in_new</span>
      )}
      <code className="text-sm font-mono">{displayHash}</code>
    </a>
  );
}

// ============================================================================
// ANCHOR INDICATOR
// ============================================================================

interface StellarAnchorIndicatorProps {
  paymentId?: string;
  receiptNumber?: string;
  showDetails?: boolean;
  compact?: boolean;
}

/**
 * Real-time indicator showing payment's blockchain status
 */
export function StellarAnchorIndicator({
  paymentId,
  receiptNumber,
  showDetails = false,
  compact = false,
}: StellarAnchorIndicatorProps) {
  const { 
    anchor, 
    status, 
    isAnchored, 
    isPending, 
    isFailed, 
    txHash,
    explorerUrl,
    isLoading,
    retry,
  } = useStellarAnchor({ paymentId, receiptNumber });

  const [isRetrying, setIsRetrying] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-6 w-24" />;
  }

  if (!anchor) {
    return (
      <span className="text-sm text-slate-400 italic">
        Not on blockchain
      </span>
    );
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retry();
    } finally {
      setIsRetrying(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StellarStatusBadge status={status!} size="sm" />
        {txHash && <StellarTxLink txHash={txHash} network={anchor.network} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <StellarStatusBadge status={status!} />
        
        {txHash && (
          <StellarTxLink txHash={txHash} network={anchor.network} />
        )}

        {isFailed && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            isLoading={isRetrying}
          >
            Retry
          </Button>
        )}
      </div>

      {showDetails && anchor && (
        <div className="text-xs text-slate-500 space-y-1">
          <p>Attempts: {anchor.attempts}/{anchor.maxAttempts}</p>
          {anchor.anchoredAt && (
            <p>Anchored: {new Date(anchor.anchoredAt).toLocaleString()}</p>
          )}
          {anchor.lastError && (
            <p className="text-red-500">Error: {anchor.lastError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VERIFICATION BADGE
// ============================================================================

interface StellarVerificationBadgeProps {
  receiptNumber: string;
  amount?: number;
  showExplorerLink?: boolean;
}

/**
 * Badge for public payment verification
 */
export function StellarVerificationBadge({
  receiptNumber,
  amount,
  showExplorerLink = true,
}: StellarVerificationBadgeProps) {
  const { isVerified, message, explorerUrl, isLoading, verify } = 
    useStellarVerification({ receiptNumber, amount });

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isVerified ? (
        <>
          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
            <span className="material-symbols-outlined text-sm">verified</span>
            Blockchain Verified
          </span>
          {showExplorerLink && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              View on Stellar
            </a>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          <span className="material-symbols-outlined text-sm">pending</span>
          {message || 'Verification pending'}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// HEALTH STATUS CARD
// ============================================================================

interface StellarHealthCardProps {
  className?: string;
}

/**
 * Card showing overall Stellar integration health
 */
export function StellarHealthCard({ className = '' }: StellarHealthCardProps) {
  const { 
    isConfigured, 
    healthStatus, 
    stats, 
    pendingCount, 
    failedCount,
    processQueue,
    isProcessing,
    isLoading,
    error,
    refresh,
  } = useStellar();

  if (isLoading) {
    return (
      <Card className={className}>
        <CardTitle>Stellar Blockchain</CardTitle>
        <div className="space-y-3 mt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card className={className}>
        <CardTitle>Stellar Blockchain</CardTitle>
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="material-symbols-outlined">warning</span>
            <span className="font-medium">Not Configured</span>
          </div>
          <p className="mt-2 text-sm text-yellow-700">
            Stellar blockchain integration is not configured. 
            Add STELLAR_ANCHOR_SECRET_KEY and NEXT_PUBLIC_STELLAR_ANCHOR_PUBLIC_KEY 
            environment variables to enable payment proof anchoring.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <CardTitle>Stellar Blockchain</CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <span className="material-symbols-outlined text-sm">refresh</span>
        </Button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-3 h-3 rounded-full ${healthStatus?.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium">
          {healthStatus?.isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="text-xs text-slate-500">
          ({healthStatus?.network || 'Unknown'})
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-600">{stats?.totalAnchored || 0}</p>
          <p className="text-xs text-slate-500">Anchored</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          <p className="text-xs text-slate-500">Failed</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-blue-600">
            {stats?.successRate?.toFixed(1) || 0}%
          </p>
          <p className="text-xs text-slate-500">Success Rate</p>
        </div>
      </div>

      {/* Account Balance */}
      {healthStatus?.accountBalance !== undefined && (
        <div className="text-sm text-slate-600 mb-4">
          Account Balance: <span className="font-mono font-medium">{healthStatus.accountBalance.toFixed(2)} XLM</span>
        </div>
      )}

      {/* Actions */}
      {pendingCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={processQueue}
          isLoading={isProcessing}
        >
          Process Pending ({pendingCount})
        </Button>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// ANCHOR LIST
// ============================================================================

interface StellarAnchorListProps {
  anchors: DBStellarAnchor[];
  onRetry?: (anchorId: string) => Promise<void>;
  onVerify?: (anchorId: string) => Promise<void>;
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * List of Stellar anchors with actions
 */
export function StellarAnchorList({
  anchors,
  onRetry,
  onVerify,
  isLoading = false,
  emptyMessage = 'No blockchain records found',
}: StellarAnchorListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (anchors.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <span className="material-symbols-outlined text-4xl mb-2">link_off</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const handleAction = async (anchorId: string, action: 'retry' | 'verify') => {
    setActionLoading(anchorId);
    try {
      if (action === 'retry' && onRetry) {
        await onRetry(anchorId);
      } else if (action === 'verify' && onVerify) {
        await onVerify(anchorId);
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {anchors.map((anchor) => (
        <div
          key={anchor.id}
          className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-medium truncate">
                {anchor.receiptNumber}
              </span>
              <StellarStatusBadge status={anchor.status} size="sm" />
            </div>
            <div className="text-xs text-slate-500 space-x-3">
              <span>Payment: {anchor.paymentId}</span>
              <span>{new Date(anchor.createdAt).toLocaleDateString()}</span>
            </div>
            {anchor.txHash && (
              <div className="mt-1">
                <StellarTxLink txHash={anchor.txHash} network={anchor.network} />
              </div>
            )}
            {anchor.lastError && anchor.status === 'failed' && (
              <p className="mt-1 text-xs text-red-500 truncate">{anchor.lastError}</p>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {anchor.status === 'failed' && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(anchor.id, 'retry')}
                disabled={actionLoading === anchor.id}
              >
                {actionLoading === anchor.id ? (
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                  'Retry'
                )}
              </Button>
            )}
            {(anchor.status === 'anchored') && onVerify && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(anchor.id, 'verify')}
                disabled={actionLoading === anchor.id}
              >
                Verify
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// VERIFICATION MODAL
// ============================================================================

interface StellarVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptNumber: string;
  amount?: number;
  studentName?: string;
  paymentDate?: string;
}

/**
 * Modal for verifying and displaying blockchain proof
 */
export function StellarVerificationModal({
  isOpen,
  onClose,
  receiptNumber,
  amount,
  studentName,
  paymentDate,
}: StellarVerificationModalProps) {
  const { isVerified, message, explorerUrl, anchoredAt, isLoading } = 
    useStellarVerification({ receiptNumber, amount });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blockchain Verification">
      <div className="space-y-4">
        {/* Receipt Info */}
        <div className="bg-slate-50 rounded-lg p-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Receipt Number</dt>
              <dd className="font-mono font-medium">{receiptNumber}</dd>
            </div>
            {amount && (
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-medium">UGX {amount.toLocaleString()}</dd>
              </div>
            )}
            {studentName && (
              <div>
                <dt className="text-slate-500">Student</dt>
                <dd className="font-medium">{studentName}</dd>
              </div>
            )}
            {paymentDate && (
              <div>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium">{paymentDate}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span>
          </div>
        )}

        {/* Verification Result */}
        {!isLoading && (
          <div className={`rounded-lg p-6 text-center ${
            isVerified 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <span className={`material-symbols-outlined text-5xl ${
              isVerified ? 'text-green-500' : 'text-yellow-500'
            }`}>
              {isVerified ? 'verified' : 'pending'}
            </span>
            <h3 className={`mt-3 font-semibold text-lg ${
              isVerified ? 'text-green-800' : 'text-yellow-800'
            }`}>
              {isVerified ? 'Verified on Blockchain' : 'Pending Verification'}
            </h3>
            <p className={`mt-1 text-sm ${
              isVerified ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {message}
            </p>

            {isVerified && anchoredAt && (
              <p className="mt-2 text-xs text-slate-500">
                Recorded on {new Date(anchoredAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Explorer Link */}
        {!isLoading && isVerified && explorerUrl && (
          <div className="text-center">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="material-symbols-outlined">open_in_new</span>
              View on Stellar Explorer
            </a>
          </div>
        )}

        {/* Explainer */}
        <div className="text-xs text-slate-500 text-center">
          <p>
            This payment record is cryptographically secured on the Stellar blockchain,
            providing an immutable, tamper-proof audit trail.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SIMPLE VERIFIED ICON
// ============================================================================

interface StellarVerifiedIconProps {
  paymentId?: string;
  receiptNumber?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

/**
 * Simple icon indicating blockchain verification status
 */
export function StellarVerifiedIcon({
  paymentId,
  receiptNumber,
  size = 'md',
  showTooltip = true,
}: StellarVerifiedIconProps) {
  const { isAnchored, isVerified, isPending, isFailed, isLoading } = 
    useStellarAnchor({ paymentId, receiptNumber });

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  if (isLoading) {
    return null;
  }

  if (!isAnchored && !isPending && !isFailed) {
    return null;
  }

  const getIcon = () => {
    if (isVerified) return { icon: 'verified_user', color: 'text-emerald-500', title: 'Verified on blockchain' };
    if (isAnchored) return { icon: 'verified', color: 'text-green-500', title: 'Recorded on blockchain' };
    if (isPending) return { icon: 'schedule', color: 'text-yellow-500', title: 'Pending blockchain record' };
    if (isFailed) return { icon: 'error', color: 'text-red-500', title: 'Blockchain record failed' };
    return null;
  };

  const iconData = getIcon();
  if (!iconData) return null;

  return (
    <span 
      className={`material-symbols-outlined ${iconData.color} ${sizeClasses[size]}`}
      title={showTooltip ? iconData.title : undefined}
    >
      {iconData.icon}
    </span>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  StellarStatusBadgeProps,
  StellarTxLinkProps,
  StellarAnchorIndicatorProps,
  StellarVerificationBadgeProps,
  StellarHealthCardProps,
  StellarAnchorListProps,
  StellarVerificationModalProps,
  StellarVerifiedIconProps,
};
