/**
 * Bad Debt Write-off Hooks
 * React hooks for managing write-off requests and approvals
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  BadDebtWriteOff,
  WriteOffStatus,
  WriteOffReason,
  WriteOffPolicyConfig,
  CreateWriteOffInput,
  WriteOffQuery,
  WriteOffApprovalInput,
  WriteOffSummary,
  CollectionAttempt,
  WriteOffDocument,
  getWriteOffStatusInfo,
  getReasonDisplay,
  getRequiredDocuments,
  canSubmitWriteOff,
  formatWriteOffAmount,
  getDocumentTypeDisplay,
  getAttemptTypeDisplay,
  getOutcomeDisplay,
} from '@/types/bad-debt';
import {
  createWriteOffRequest,
  getWriteOff,
  queryWriteOffs,
  getPendingApprovals,
  submitWriteOff,
  processApproval,
  applyWriteOff,
  addCollectionAttempt,
  addSupportingDocument,
  getWriteOffPolicy,
  saveWriteOffPolicy,
  getWriteOffSummary,
  getMockWriteOff,
  getMockWriteOffSummary,
} from '@/lib/services/bad-debt.service';

// ============================================================================
// WRITE-OFF LIST HOOK
// ============================================================================

interface UseWriteOffsState {
  writeOffs: BadDebtWriteOff[];
  loading: boolean;
  error: string | null;
}

interface UseWriteOffsReturn extends UseWriteOffsState {
  loadWriteOffs: (query?: Partial<WriteOffQuery>) => Promise<void>;
  refresh: () => Promise<void>;
  // Filters
  filterByStatus: (status: WriteOffStatus | null) => BadDebtWriteOff[];
  filterByReason: (reason: WriteOffReason | null) => BadDebtWriteOff[];
  // Computed
  pendingCount: number;
  totalWriteOffAmount: number;
  formattedTotalAmount: string;
}

export function useWriteOffs(schoolId: string): UseWriteOffsReturn {
  const [state, setState] = useState<UseWriteOffsState>({
    writeOffs: [],
    loading: false,
    error: null,
  });

  const loadWriteOffs = useCallback(async (query?: Partial<WriteOffQuery>) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const writeOffs = await queryWriteOffs({ schoolId, ...query });
      setState(prev => ({ ...prev, writeOffs, loading: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load write-offs',
        loading: false,
      }));
    }
  }, [schoolId]);

  const refresh = useCallback(async () => {
    await loadWriteOffs();
  }, [loadWriteOffs]);

  const filterByStatus = useCallback((status: WriteOffStatus | null) => {
    if (!status) return state.writeOffs;
    return state.writeOffs.filter(w => w.status === status);
  }, [state.writeOffs]);

  const filterByReason = useCallback((reason: WriteOffReason | null) => {
    if (!reason) return state.writeOffs;
    return state.writeOffs.filter(w => w.reason === reason);
  }, [state.writeOffs]);

  const pendingCount = useMemo(() => {
    return state.writeOffs.filter(w => 
      ['pending_bursar', 'pending_head', 'pending_bog'].includes(w.status)
    ).length;
  }, [state.writeOffs]);

  const totalWriteOffAmount = useMemo(() => {
    return state.writeOffs
      .filter(w => w.status === 'applied')
      .reduce((sum, w) => sum + w.writeOffAmount, 0);
  }, [state.writeOffs]);

  return {
    ...state,
    loadWriteOffs,
    refresh,
    filterByStatus,
    filterByReason,
    pendingCount,
    totalWriteOffAmount,
    formattedTotalAmount: formatWriteOffAmount(totalWriteOffAmount),
  };
}

// ============================================================================
// SINGLE WRITE-OFF HOOK
// ============================================================================

interface UseWriteOffState {
  writeOff: BadDebtWriteOff | null;
  loading: boolean;
  error: string | null;
}

interface UseWriteOffReturn extends UseWriteOffState {
  loadWriteOff: (writeOffId: string) => Promise<void>;
  loadMock: () => void;
  // Computed
  statusInfo: ReturnType<typeof getWriteOffStatusInfo> | null;
  formattedAmount: string;
  requiredDocs: string[];
  canSubmit: { canSubmit: boolean; reasons: string[] };
}

export function useWriteOff(
  schoolId: string,
  initialWriteOffId?: string
): UseWriteOffReturn {
  const [state, setState] = useState<UseWriteOffState>({
    writeOff: null,
    loading: false,
    error: null,
  });
  const [policy, setPolicy] = useState<WriteOffPolicyConfig | null>(null);

  useEffect(() => {
    getWriteOffPolicy(schoolId).then(setPolicy);
  }, [schoolId]);

  useEffect(() => {
    if (initialWriteOffId) {
      loadWriteOff(initialWriteOffId);
    }
  }, [initialWriteOffId]);

  const loadWriteOff = useCallback(async (writeOffId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const writeOff = await getWriteOff(writeOffId);
      setState(prev => ({ ...prev, writeOff, loading: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load write-off',
        loading: false,
      }));
    }
  }, []);

  const loadMock = useCallback(() => {
    setState({
      writeOff: getMockWriteOff(),
      loading: false,
      error: null,
    });
  }, []);

  const statusInfo = useMemo(() => {
    return state.writeOff ? getWriteOffStatusInfo(state.writeOff.status) : null;
  }, [state.writeOff]);

  const formattedAmount = useMemo(() => {
    return state.writeOff ? formatWriteOffAmount(state.writeOff.writeOffAmount) : 'UGX 0';
  }, [state.writeOff]);

  const requiredDocs = useMemo(() => {
    return state.writeOff ? getRequiredDocuments(state.writeOff.reason) : [];
  }, [state.writeOff]);

  const canSubmitCheck = useMemo(() => {
    if (!state.writeOff || !policy) {
      return { canSubmit: false, reasons: ['Write-off or policy not loaded'] };
    }
    return canSubmitWriteOff(state.writeOff, policy);
  }, [state.writeOff, policy]);

  return {
    ...state,
    loadWriteOff,
    loadMock,
    statusInfo,
    formattedAmount,
    requiredDocs,
    canSubmit: canSubmitCheck,
  };
}

// ============================================================================
// WRITE-OFF ACTIONS HOOK
// ============================================================================

interface UseWriteOffActionsReturn {
  creating: boolean;
  submitting: boolean;
  approving: boolean;
  error: string | null;
  create: (input: CreateWriteOffInput) => Promise<BadDebtWriteOff>;
  submit: (writeOffId: string, userId: string, userName: string) => Promise<void>;
  approve: (input: WriteOffApprovalInput) => Promise<void>;
  reject: (input: Omit<WriteOffApprovalInput, 'decision'>) => Promise<void>;
  returnForRevision: (input: Omit<WriteOffApprovalInput, 'decision'>) => Promise<void>;
  apply: (writeOffId: string, userId: string) => Promise<void>;
}

export function useWriteOffActions(): UseWriteOffActionsReturn {
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateWriteOffInput): Promise<BadDebtWriteOff> => {
    setCreating(true);
    setError(null);
    try {
      return await createWriteOffRequest(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  const submit = useCallback(async (writeOffId: string, userId: string, userName: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await submitWriteOff(writeOffId, userId, userName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const approve = useCallback(async (input: WriteOffApprovalInput) => {
    setApproving(true);
    setError(null);
    try {
      await processApproval({ ...input, decision: 'approved' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
      throw err;
    } finally {
      setApproving(false);
    }
  }, []);

  const reject = useCallback(async (input: Omit<WriteOffApprovalInput, 'decision'>) => {
    setApproving(true);
    setError(null);
    try {
      await processApproval({ ...input, decision: 'rejected' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
      throw err;
    } finally {
      setApproving(false);
    }
  }, []);

  const returnForRevision = useCallback(async (input: Omit<WriteOffApprovalInput, 'decision'>) => {
    setApproving(true);
    setError(null);
    try {
      await processApproval({ ...input, decision: 'returned' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return');
      throw err;
    } finally {
      setApproving(false);
    }
  }, []);

  const apply = useCallback(async (writeOffId: string, userId: string) => {
    setApproving(true);
    setError(null);
    try {
      await applyWriteOff(writeOffId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply');
      throw err;
    } finally {
      setApproving(false);
    }
  }, []);

  return {
    creating,
    submitting,
    approving,
    error,
    create,
    submit,
    approve,
    reject,
    returnForRevision,
    apply,
  };
}

// ============================================================================
// PENDING APPROVALS HOOK
// ============================================================================

interface UsePendingApprovalsReturn {
  pendingWriteOffs: BadDebtWriteOff[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  count: number;
  totalPendingAmount: number;
  formattedPendingAmount: string;
}

export function usePendingApprovals(
  schoolId: string,
  userRole: 'bursar' | 'headteacher' | 'bog'
): UsePendingApprovalsReturn {
  const [pendingWriteOffs, setPendingWriteOffs] = useState<BadDebtWriteOff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pending = await getPendingApprovals(schoolId, userRole);
      setPendingWriteOffs(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [schoolId, userRole]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalPendingAmount = useMemo(() => {
    return pendingWriteOffs.reduce((sum, w) => sum + w.writeOffAmount, 0);
  }, [pendingWriteOffs]);

  return {
    pendingWriteOffs,
    loading,
    error,
    refresh,
    count: pendingWriteOffs.length,
    totalPendingAmount,
    formattedPendingAmount: formatWriteOffAmount(totalPendingAmount),
  };
}

// ============================================================================
// WRITE-OFF SUMMARY HOOK
// ============================================================================

interface UseWriteOffSummaryReturn {
  summary: WriteOffSummary | null;
  loading: boolean;
  error: string | null;
  loadSummary: (fiscalYear?: string) => Promise<void>;
  loadMock: () => void;
  // Computed
  budgetUsedPercent: number;
  isOverBudget: boolean;
  topReasons: { reason: string; amount: number }[];
}

export function useWriteOffSummary(schoolId: string): UseWriteOffSummaryReturn {
  const [summary, setSummary] = useState<WriteOffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (fiscalYear?: string) => {
    setLoading(true);
    setError(null);
    try {
      const year = fiscalYear || new Date().getFullYear().toString();
      const data = await getWriteOffSummary(schoolId, year);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const loadMock = useCallback(() => {
    setSummary(getMockWriteOffSummary());
  }, []);

  const budgetUsedPercent = useMemo(() => {
    return summary?.budgetUsedPercent || 0;
  }, [summary]);

  const isOverBudget = useMemo(() => {
    return budgetUsedPercent > 100;
  }, [budgetUsedPercent]);

  const topReasons = useMemo(() => {
    if (!summary) return [];
    return summary.byReason
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 3)
      .map(r => ({ reason: r.reasonDisplay, amount: r.totalAmount }));
  }, [summary]);

  return {
    summary,
    loading,
    error,
    loadSummary,
    loadMock,
    budgetUsedPercent,
    isOverBudget,
    topReasons,
  };
}

// ============================================================================
// COLLECTION ATTEMPTS HOOK
// ============================================================================

interface UseCollectionAttemptsReturn {
  attempts: CollectionAttempt[];
  adding: boolean;
  addAttempt: (attempt: Omit<CollectionAttempt, 'id'>) => Promise<void>;
  meetsMinimum: boolean;
  getAttemptDisplay: (attempt: CollectionAttempt) => {
    type: string;
    outcome: string;
  };
}

export function useCollectionAttempts(
  writeOff: BadDebtWriteOff | null,
  minimumRequired: number = 3
): UseCollectionAttemptsReturn {
  const [adding, setAdding] = useState(false);

  const addAttempt = useCallback(async (attempt: Omit<CollectionAttempt, 'id'>) => {
    if (!writeOff) return;
    setAdding(true);
    try {
      await addCollectionAttempt(writeOff.id, attempt);
    } finally {
      setAdding(false);
    }
  }, [writeOff]);

  const meetsMinimum = useMemo(() => {
    return (writeOff?.totalCollectionAttempts || 0) >= minimumRequired;
  }, [writeOff, minimumRequired]);

  const getAttemptDisplay = useCallback((attempt: CollectionAttempt) => ({
    type: getAttemptTypeDisplay(attempt.type),
    outcome: getOutcomeDisplay(attempt.outcome),
  }), []);

  return {
    attempts: writeOff?.collectionAttempts || [],
    adding,
    addAttempt,
    meetsMinimum,
    getAttemptDisplay,
  };
}

// ============================================================================
// SUPPORTING DOCUMENTS HOOK
// ============================================================================

interface UseSupportingDocsReturn {
  documents: WriteOffDocument[];
  adding: boolean;
  addDocument: (doc: Omit<WriteOffDocument, 'id'>) => Promise<void>;
  requiredTypes: string[];
  missingTypes: string[];
  allRequiredPresent: boolean;
  getDocTypeDisplay: (type: WriteOffDocument['type']) => string;
}

export function useSupportingDocs(
  writeOff: BadDebtWriteOff | null
): UseSupportingDocsReturn {
  const [adding, setAdding] = useState(false);

  const addDocument = useCallback(async (doc: Omit<WriteOffDocument, 'id'>) => {
    if (!writeOff) return;
    setAdding(true);
    try {
      await addSupportingDocument(writeOff.id, doc);
    } finally {
      setAdding(false);
    }
  }, [writeOff]);

  const requiredTypes = useMemo(() => {
    return writeOff ? getRequiredDocuments(writeOff.reason) : [];
  }, [writeOff]);

  const missingTypes = useMemo(() => {
    if (!writeOff) return [];
    const uploaded = writeOff.supportingDocuments.map(d => d.type);
    return requiredTypes.filter(t => !uploaded.includes(t as any));
  }, [writeOff, requiredTypes]);

  const allRequiredPresent = useMemo(() => {
    return missingTypes.length === 0;
  }, [missingTypes]);

  return {
    documents: writeOff?.supportingDocuments || [],
    adding,
    addDocument,
    requiredTypes,
    missingTypes,
    allRequiredPresent,
    getDocTypeDisplay: getDocumentTypeDisplay,
  };
}

// ============================================================================
// WRITE-OFF POLICY HOOK
// ============================================================================

interface UseWriteOffPolicyReturn {
  policy: WriteOffPolicyConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadPolicy: () => Promise<void>;
  savePolicy: (updates: Partial<WriteOffPolicyConfig>) => Promise<void>;
}

export function useWriteOffPolicy(schoolId: string): UseWriteOffPolicyReturn {
  const [policy, setPolicy] = useState<WriteOffPolicyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWriteOffPolicy(schoolId);
      setPolicy(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const savePolicyFn = useCallback(async (updates: Partial<WriteOffPolicyConfig>) => {
    if (!policy) return;
    setSaving(true);
    setError(null);
    try {
      const updated = { ...policy, ...updates };
      await saveWriteOffPolicy(updated);
      setPolicy(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [policy]);

  return {
    policy,
    loading,
    saving,
    error,
    loadPolicy,
    savePolicy: savePolicyFn,
  };
}

// Re-export helpers
export {
  getWriteOffStatusInfo,
  getReasonDisplay,
  getRequiredDocuments,
  formatWriteOffAmount,
  getDocumentTypeDisplay,
  getAttemptTypeDisplay,
  getOutcomeDisplay,
};
