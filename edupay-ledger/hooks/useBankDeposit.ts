/**
 * Bank Deposit Slip Hooks
 * React hooks for managing bank deposits
 *
 * Features:
 * - Slip creation and management
 * - Denomination tracking
 * - Bank account management
 * - Reconciliation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BankDepositSlip,
  CashDenominations,
  ChequeDetail,
  SchoolBankAccount,
  SlipSettings,
  DepositBatch,
  DepositReconciliation,
  DepositSlipQuery,
  DepositSummary,
  DailyCashCollection,
  DepositSlipPrintData,
  DepositStatus,
  UgandaBank,
  calculateDenominationTotal,
  formatDenominationBreakdown,
  getEmptyDenominations,
  validateSlipForDeposit,
  getBankInfo,
  getDepositStatusInfo,
  generateSlipNumber,
} from '@/types/bank-deposit';
import {
  getBankAccounts,
  getDefaultBankAccount,
  createBankAccount,
  updateBankAccount,
  getSlipSettings,
  updateSlipSettings,
  createDepositSlip,
  getDepositSlip,
  queryDepositSlips,
  updateDepositSlip,
  updateDenominations,
  addCheques,
  markReadyForDeposit,
  markDeposited,
  confirmBankReceipt,
  resolveDiscrepancy,
  cancelDepositSlip,
  generatePrintData,
  createDepositBatch,
  getDepositSummary,
  getDailyCashCollection,
  startReconciliation,
  getMockDepositDashboard,
} from '@/lib/services/bank-deposit.service';

// Re-export helper functions
export {
  calculateDenominationTotal,
  formatDenominationBreakdown,
  getEmptyDenominations,
  validateSlipForDeposit,
  getBankInfo,
  getDepositStatusInfo,
  generateSlipNumber,
};

// ============================================================================
// DASHBOARD HOOK
// ============================================================================

/**
 * Hook for deposit dashboard summary
 */
export function useDepositDashboard(schoolId: string) {
  const [dashboard, setDashboard] = useState<ReturnType<typeof getMockDepositDashboard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = getMockDepositDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
  };
}

// ============================================================================
// BANK ACCOUNTS HOOK
// ============================================================================

/**
 * Hook for managing school bank accounts
 */
export function useBankAccounts(schoolId: string) {
  const [accounts, setAccounts] = useState<SchoolBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getBankAccounts(schoolId);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Get default account
  const defaultAccount = useMemo(() => {
    return accounts.find(a => a.isDefault && a.isActive) || accounts[0];
  }, [accounts]);

  // Group by bank
  const byBank = useMemo(() => {
    const grouped: Record<UgandaBank, SchoolBankAccount[]> = {} as Record<UgandaBank, SchoolBankAccount[]>;
    
    for (const account of accounts) {
      if (!grouped[account.bank]) {
        grouped[account.bank] = [];
      }
      grouped[account.bank].push(account);
    }
    
    return grouped;
  }, [accounts]);

  // Create account
  const create = useCallback(async (
    account: Omit<SchoolBankAccount, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SchoolBankAccount | null> => {
    try {
      const newAccount = await createBankAccount(account);
      setAccounts(prev => [...prev, newAccount]);
      return newAccount;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      return null;
    }
  }, []);

  // Update account
  const update = useCallback(async (
    accountId: string,
    updates: Partial<SchoolBankAccount>
  ): Promise<boolean> => {
    try {
      const updated = await updateBankAccount(accountId, updates);
      setAccounts(prev => prev.map(a => a.id === accountId ? updated : a));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
      return false;
    }
  }, []);

  return {
    accounts,
    loading,
    error,
    defaultAccount,
    byBank,
    create,
    update,
    refresh: fetchAccounts,
  };
}

// ============================================================================
// DEPOSIT SLIPS LIST HOOK
// ============================================================================

/**
 * Hook for querying deposit slips
 */
export function useDepositSlips(query: DepositSlipQuery) {
  const [slips, setSlips] = useState<BankDepositSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await queryDepositSlips(query);
      setSlips(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposit slips');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(query)]);

  useEffect(() => {
    fetchSlips();
  }, [fetchSlips]);

  // Group by status
  const byStatus = useMemo(() => {
    const grouped: Record<DepositStatus, BankDepositSlip[]> = {
      draft: [],
      pending: [],
      deposited: [],
      confirmed: [],
      reconciled: [],
      discrepancy: [],
      cancelled: [],
    };
    
    for (const slip of slips) {
      grouped[slip.status].push(slip);
    }
    
    return grouped;
  }, [slips]);

  // Totals
  const totals = useMemo(() => ({
    count: slips.length,
    amount: slips.reduce((sum, s) => sum + s.depositAmount, 0),
    pending: slips.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.depositAmount, 0),
    discrepancies: slips.filter(s => s.hasDiscrepancy).length,
  }), [slips]);

  return {
    slips,
    loading,
    error,
    byStatus,
    totals,
    refresh: fetchSlips,
  };
}

// ============================================================================
// SINGLE DEPOSIT SLIP HOOK
// ============================================================================

/**
 * Hook for single deposit slip management
 */
export function useDepositSlip(slipId: string) {
  const [slip, setSlip] = useState<BankDepositSlip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlip = useCallback(async () => {
    if (!slipId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getDepositSlip(slipId);
      setSlip(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deposit slip');
    } finally {
      setLoading(false);
    }
  }, [slipId]);

  useEffect(() => {
    fetchSlip();
  }, [fetchSlip]);

  // Status info
  const statusInfo = useMemo(() => {
    if (!slip) return null;
    return getDepositStatusInfo(slip.status);
  }, [slip]);

  // Validation
  const validation = useMemo(() => {
    if (!slip) return { valid: false, errors: ['No slip loaded'] };
    return validateSlipForDeposit(slip);
  }, [slip]);

  // Denomination breakdown
  const denominationBreakdown = useMemo(() => {
    if (!slip?.denominations) return [];
    return formatDenominationBreakdown(slip.denominations);
  }, [slip]);

  return {
    slip,
    loading,
    error,
    statusInfo,
    validation,
    denominationBreakdown,
    refresh: fetchSlip,
  };
}

// ============================================================================
// DEPOSIT SLIP CREATION HOOK
// ============================================================================

/**
 * Hook for creating deposit slips
 */
export function useDepositSlipCreation(schoolId: string) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');

  // Create slip
  const create = useCallback(async (
    depositDate: Date,
    paymentIds: string[],
    depositorId: string,
    depositorName: string,
    bankAccountId: string,
    notes?: string
  ): Promise<BankDepositSlip | null> => {
    setCreating(true);
    setError(null);
    
    try {
      const slip = await createDepositSlip({
        schoolId,
        bankAccountId,
        depositDate,
        paymentIds,
        depositorId,
        depositorName,
        notes,
      });
      
      setSelectedPayments([]);
      return slip;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deposit slip');
      return null;
    } finally {
      setCreating(false);
    }
  }, [schoolId]);

  // Toggle payment selection
  const togglePayment = useCallback((paymentId: string) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  }, []);

  return {
    creating,
    error,
    selectedPayments,
    selectedBank,
    setSelectedBank,
    togglePayment,
    selectAll: (ids: string[]) => setSelectedPayments(ids),
    clearSelection: () => setSelectedPayments([]),
    create,
  };
}

// ============================================================================
// DENOMINATION CALCULATOR HOOK
// ============================================================================

/**
 * Hook for cash denomination calculator
 */
export function useDenominationCalculator(initialDenominations?: CashDenominations) {
  const [denominations, setDenominations] = useState<CashDenominations>(
    initialDenominations || getEmptyDenominations()
  );

  // Calculate total
  const total = useMemo(() => {
    return calculateDenominationTotal(denominations);
  }, [denominations]);

  // Breakdown for display
  const breakdown = useMemo(() => {
    return formatDenominationBreakdown(denominations);
  }, [denominations]);

  // Update single denomination
  const updateDenomination = useCallback((
    key: keyof CashDenominations,
    value: number
  ) => {
    setDenominations(prev => ({
      ...prev,
      [key]: Math.max(0, value),
    }));
  }, []);

  // Reset all
  const reset = useCallback(() => {
    setDenominations(getEmptyDenominations());
  }, []);

  // Smart fill to reach target amount
  const fillToTarget = useCallback((targetAmount: number) => {
    let remaining = targetAmount;
    const newDenom: CashDenominations = getEmptyDenominations();
    
    // Fill from largest to smallest
    const denomValues: [keyof CashDenominations, number][] = [
      ['notes_50000', 50000],
      ['notes_20000', 20000],
      ['notes_10000', 10000],
      ['notes_5000', 5000],
      ['notes_2000', 2000],
      ['notes_1000', 1000],
      ['coins_500', 500],
      ['coins_200', 200],
      ['coins_100', 100],
      ['coins_50', 50],
    ];
    
    for (const [key, value] of denomValues) {
      const count = Math.floor(remaining / value);
      newDenom[key] = count;
      remaining -= count * value;
    }
    
    setDenominations(newDenom);
    return remaining; // Returns any remainder that couldn't be filled
  }, []);

  return {
    denominations,
    total,
    breakdown,
    updateDenomination,
    setDenominations,
    reset,
    fillToTarget,
  };
}

// ============================================================================
// DEPOSIT SLIP ACTIONS HOOK
// ============================================================================

/**
 * Hook for deposit slip actions
 */
export function useDepositSlipActions() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Update denominations
  const saveDenominations = useCallback(async (
    slipId: string,
    denominations: CashDenominations
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await updateDenominations(slipId, denominations);
      setLastAction('Denominations saved');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save denominations');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Add cheques
  const saveCheques = useCallback(async (
    slipId: string,
    cheques: ChequeDetail[]
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await addCheques(slipId, cheques);
      setLastAction('Cheques added');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cheques');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Mark ready for deposit
  const markReady = useCallback(async (slipId: string): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await markReadyForDeposit(slipId);
      setLastAction('Slip marked ready for deposit');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Mark deposited
  const deposit = useCallback(async (
    slipId: string,
    bankReference?: string
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await markDeposited(slipId, bankReference);
      setLastAction('Deposit recorded');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record deposit');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Confirm receipt
  const confirm = useCallback(async (
    slipId: string,
    confirmedAmount: number,
    bankReference: string
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await confirmBankReceipt(slipId, confirmedAmount, bankReference);
      setLastAction('Bank confirmation recorded');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Resolve discrepancy
  const resolve = useCallback(async (
    slipId: string,
    reason: string,
    userId: string
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await resolveDiscrepancy(slipId, reason, userId);
      setLastAction('Discrepancy resolved');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Cancel slip
  const cancel = useCallback(async (
    slipId: string,
    reason: string
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);
    
    try {
      await cancelDepositSlip(slipId, reason);
      setLastAction('Deposit slip cancelled');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    processing,
    error,
    lastAction,
    saveDenominations,
    saveCheques,
    markReady,
    deposit,
    confirm,
    resolve,
    cancel,
    clearError: () => setError(null),
    clearLastAction: () => setLastAction(null),
  };
}

// ============================================================================
// PRINT HOOK
// ============================================================================

/**
 * Hook for printing deposit slips
 */
export function useDepositSlipPrint() {
  const [printData, setPrintData] = useState<DepositSlipPrintData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preparePrint = useCallback(async (
    slipId: string,
    printedBy: string
  ): Promise<DepositSlipPrintData | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await generatePrintData(slipId, printedBy);
      setPrintData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare print');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const print = useCallback(() => {
    if (!printData) return;
    window.print();
  }, [printData]);

  return {
    printData,
    loading,
    error,
    preparePrint,
    print,
    clearPrintData: () => setPrintData(null),
  };
}

// ============================================================================
// SETTINGS HOOK
// ============================================================================

/**
 * Hook for slip settings
 */
export function useSlipSettings(schoolId: string) {
  const [settings, setSettings] = useState<SlipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getSlipSettings(schoolId);
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Update settings
  const update = useCallback(async (
    updates: Partial<SlipSettings>
  ): Promise<boolean> => {
    if (!schoolId) return false;
    
    setSaving(true);
    setError(null);
    
    try {
      const updated = await updateSlipSettings(schoolId, updates);
      setSettings(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      return false;
    } finally {
      setSaving(false);
    }
  }, [schoolId]);

  return {
    settings,
    loading,
    saving,
    error,
    update,
    refresh: fetchSettings,
  };
}

// ============================================================================
// SUMMARY HOOK
// ============================================================================

/**
 * Hook for deposit summary
 */
export function useDepositSummary(
  schoolId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
) {
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const fetchSummary = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getDepositSummary(schoolId, selectedPeriod, new Date());
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedPeriod]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Chart data
  const chartData = useMemo(() => {
    if (!summary) return null;
    
    return {
      byBank: summary.byBank.map(b => ({
        name: getBankInfo(b.bank).shortName,
        amount: b.amount,
        count: b.count,
      })),
      byStatus: Object.entries(summary.byStatus)
        .filter(([_, v]) => v.count > 0)
        .map(([status, data]) => ({
          name: getDepositStatusInfo(status as DepositStatus).label,
          amount: data.amount,
          count: data.count,
        })),
    };
  }, [summary]);

  return {
    summary,
    loading,
    error,
    chartData,
    selectedPeriod,
    setSelectedPeriod,
    refresh: fetchSummary,
  };
}

// ============================================================================
// DAILY CASH HOOK
// ============================================================================

/**
 * Hook for daily cash collection status
 */
export function useDailyCash(schoolId: string, date: Date = new Date()) {
  const [collection, setCollection] = useState<DailyCashCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getDailyCashCollection(schoolId, date);
      setCollection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }, [schoolId, date.toDateString()]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  // Denomination breakdown
  const denominationBreakdown = useMemo(() => {
    if (!collection?.denominations) return [];
    return formatDenominationBreakdown(collection.denominations);
  }, [collection]);

  return {
    collection,
    loading,
    error,
    denominationBreakdown,
    refresh: fetchCollection,
  };
}

// ============================================================================
// BATCH HOOK
// ============================================================================

/**
 * Hook for deposit batching
 */
export function useDepositBatch(schoolId: string) {
  const [batch, setBatch] = useState<DepositBatch | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create batch
  const createBatch = useCallback(async (
    batchDate: Date,
    userId: string,
    userName: string
  ): Promise<DepositBatch | null> => {
    setCreating(true);
    setError(null);
    
    try {
      const newBatch = await createDepositBatch(schoolId, batchDate, userId, userName);
      setBatch(newBatch);
      return newBatch;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
      return null;
    } finally {
      setCreating(false);
    }
  }, [schoolId]);

  return {
    batch,
    creating,
    error,
    createBatch,
    clearBatch: () => setBatch(null),
  };
}

// ============================================================================
// RECONCILIATION HOOK
// ============================================================================

/**
 * Hook for deposit reconciliation
 */
export function useDepositReconciliation(schoolId: string) {
  const [reconciliation, setReconciliation] = useState<DepositReconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start reconciliation
  const start = useCallback(async (
    periodStart: Date,
    periodEnd: Date,
    userId: string,
    userName: string
  ): Promise<DepositReconciliation | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const recon = await startReconciliation(schoolId, periodStart, periodEnd, userId, userName);
      setReconciliation(recon);
      return recon;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reconciliation');
      return null;
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  // Summary stats
  const stats = useMemo(() => {
    if (!reconciliation) return null;
    
    return {
      matchRate: reconciliation.totalSlips > 0
        ? (reconciliation.reconciledSlips / reconciliation.totalSlips) * 100
        : 0,
      discrepancyRate: reconciliation.totalSlips > 0
        ? (reconciliation.discrepancySlips / reconciliation.totalSlips) * 100
        : 0,
      variance: reconciliation.difference,
      variancePercent: reconciliation.expectedDeposits > 0
        ? (reconciliation.difference / reconciliation.expectedDeposits) * 100
        : 0,
    };
  }, [reconciliation]);

  return {
    reconciliation,
    loading,
    error,
    stats,
    start,
    clearReconciliation: () => setReconciliation(null),
  };
}
