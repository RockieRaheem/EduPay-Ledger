/**
 * useCarryForward Hook
 * React hooks for carry-forward balance management
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CarryForwardRecord,
  CarryForwardStatus,
  CarryForwardSummary,
  StudentTermBalance,
  TermTransitionConfig,
  ProcessCarryForwardInput,
  ManualCarryForwardInput,
  RefundRequest,
  getCarryForwardType,
  getCarryForwardStatusInfo,
  formatCarryForward,
  formatTerm,
  getNextTerm,
} from "@/types/carry-forward";
import {
  getTermTransitions,
  createTermTransition,
  getStudentTermBalances,
  getStudentsWithCredits,
  getStudentsWithArrears,
  processCarryForwards,
  applyCarryForward,
  voidCarryForward,
  createManualCarryForward,
  getCarryForwards,
  getStudentCarryForwards,
  getCarryForwardSummary,
  createRefundRequest,
  approveRefundRequest,
  completeRefundRequest,
  getMockStudentTermBalances,
  getMockCarryForwardSummary,
} from "@/lib/services/carry-forward.service";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// ============================================================================
// TERM TRANSITION HOOK
// ============================================================================

interface UseTermTransitionsOptions {
  schoolId: string;
}

interface UseTermTransitionsReturn {
  transitions: TermTransitionConfig[];
  isLoading: boolean;
  error: string | null;
  refreshTransitions: () => Promise<void>;
  createTransition: (
    fromTermId: string,
    fromTerm: number,
    fromYear: string,
    toTermId: string,
    toTerm: number,
    toYear: string,
  ) => Promise<TermTransitionConfig>;
}

export function useTermTransitions(
  options: UseTermTransitionsOptions,
): UseTermTransitionsReturn {
  const { schoolId } = options;

  const [transitions, setTransitions] = useState<TermTransitionConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransitions = useCallback(async () => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setTransitions([]);
      } else {
        const data = await getTermTransitions(schoolId);
        setTransitions(data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transitions",
      );
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  const handleCreateTransition = useCallback(
    async (
      fromTermId: string,
      fromTerm: number,
      fromYear: string,
      toTermId: string,
      toTerm: number,
      toYear: string,
    ): Promise<TermTransitionConfig> => {
      const transition = await createTermTransition(
        schoolId,
        fromTermId,
        fromTerm,
        fromYear,
        toTermId,
        toTerm,
        toYear,
        "current-user", // TODO: Get from auth context
      );
      await loadTransitions();
      return transition;
    },
    [schoolId, loadTransitions],
  );

  return {
    transitions,
    isLoading,
    error,
    refreshTransitions: loadTransitions,
    createTransition: handleCreateTransition,
  };
}

// ============================================================================
// STUDENT BALANCES HOOK
// ============================================================================

interface UseStudentBalancesOptions {
  schoolId: string;
  termId: string;
  filterType?: "all" | "credits" | "arrears" | "cleared";
}

interface UseStudentBalancesReturn {
  balances: StudentTermBalance[];
  credits: StudentTermBalance[];
  arrears: StudentTermBalance[];
  cleared: StudentTermBalance[];
  totalCredits: number;
  totalArrears: number;
  isLoading: boolean;
  error: string | null;
  refreshBalances: () => Promise<void>;
}

export function useStudentBalances(
  options: UseStudentBalancesOptions,
): UseStudentBalancesReturn {
  const { schoolId, termId, filterType = "all" } = options;

  const [balances, setBalances] = useState<StudentTermBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    if (!schoolId || !termId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setBalances(getMockStudentTermBalances());
      } else {
        const data = await getStudentTermBalances(schoolId, termId);
        setBalances(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load balances");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, termId]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const filteredBalances = useMemo(() => {
    switch (filterType) {
      case "credits":
        return balances.filter((b) => b.balanceType === "credit");
      case "arrears":
        return balances.filter((b) => b.balanceType === "arrears");
      case "cleared":
        return balances.filter((b) => b.balanceType === "cleared");
      default:
        return balances;
    }
  }, [balances, filterType]);

  const credits = useMemo(
    () => balances.filter((b) => b.balanceType === "credit"),
    [balances],
  );
  const arrears = useMemo(
    () => balances.filter((b) => b.balanceType === "arrears"),
    [balances],
  );
  const cleared = useMemo(
    () => balances.filter((b) => b.balanceType === "cleared"),
    [balances],
  );

  const totalCredits = useMemo(
    () => credits.reduce((sum, b) => sum + b.carryForwardAmount, 0),
    [credits],
  );
  const totalArrears = useMemo(
    () => arrears.reduce((sum, b) => sum + b.carryForwardAmount, 0),
    [arrears],
  );

  return {
    balances: filteredBalances,
    credits,
    arrears,
    cleared,
    totalCredits,
    totalArrears,
    isLoading,
    error,
    refreshBalances: loadBalances,
  };
}

// ============================================================================
// CARRY-FORWARD PROCESSING HOOK
// ============================================================================

interface UseCarryForwardProcessingOptions {
  schoolId: string;
  fromTermId: string;
  toTermId: string;
}

interface UseCarryForwardProcessingReturn {
  summary: CarryForwardSummary | null;
  carryForwards: CarryForwardRecord[];
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  processAll: (
    processCredits: boolean,
    processArrears: boolean,
  ) => Promise<{ processed: number; errors: string[] }>;
  applyOne: (carryForwardId: string) => Promise<void>;
  applyAll: () => Promise<{ applied: number; errors: string[] }>;
  voidOne: (carryForwardId: string, reason: string) => Promise<void>;
  createManual: (
    input: Omit<ManualCarryForwardInput, "fromTermId" | "toTermId">,
  ) => Promise<CarryForwardRecord>;
}

export function useCarryForwardProcessing(
  options: UseCarryForwardProcessingOptions,
): UseCarryForwardProcessingReturn {
  const { schoolId, fromTermId, toTermId } = options;

  const [summary, setSummary] = useState<CarryForwardSummary | null>(null);
  const [carryForwards, setCarryForwards] = useState<CarryForwardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!schoolId || !fromTermId || !toTermId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSummary(getMockCarryForwardSummary());
        setCarryForwards([]);
      } else {
        const [summaryData, cfData] = await Promise.all([
          getCarryForwardSummary(schoolId, fromTermId, toTermId),
          getCarryForwards(schoolId, fromTermId),
        ]);
        setSummary(summaryData);
        setCarryForwards(cfData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, fromTermId, toTermId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const processAll = useCallback(
    async (
      processCredits: boolean,
      processArrears: boolean,
    ): Promise<{ processed: number; errors: string[] }> => {
      setIsProcessing(true);
      try {
        const result = await processCarryForwards(
          {
            schoolId,
            fromTermId,
            toTermId,
            processCredits,
            processArrears,
          },
          "current-user",
        );
        await loadData();
        return result;
      } finally {
        setIsProcessing(false);
      }
    },
    [schoolId, fromTermId, toTermId, loadData],
  );

  const applyOne = useCallback(
    async (carryForwardId: string): Promise<void> => {
      setIsProcessing(true);
      try {
        await applyCarryForward(carryForwardId, "current-user");
        await loadData();
      } finally {
        setIsProcessing(false);
      }
    },
    [loadData],
  );

  const applyAll = useCallback(async (): Promise<{
    applied: number;
    errors: string[];
  }> => {
    setIsProcessing(true);
    const errors: string[] = [];
    let applied = 0;

    try {
      const pendingCfs = carryForwards.filter((cf) => cf.status === "pending");

      for (const cf of pendingCfs) {
        try {
          await applyCarryForward(cf.id, "current-user");
          applied++;
        } catch (err) {
          errors.push(`Failed to apply ${cf.studentName}: ${err}`);
        }
      }

      await loadData();
      return { applied, errors };
    } finally {
      setIsProcessing(false);
    }
  }, [carryForwards, loadData]);

  const voidOne = useCallback(
    async (carryForwardId: string, reason: string): Promise<void> => {
      setIsProcessing(true);
      try {
        await voidCarryForward(carryForwardId, reason, "current-user");
        await loadData();
      } finally {
        setIsProcessing(false);
      }
    },
    [loadData],
  );

  const createManual = useCallback(
    async (
      input: Omit<ManualCarryForwardInput, "fromTermId" | "toTermId">,
    ): Promise<CarryForwardRecord> => {
      const cf = await createManualCarryForward(
        { ...input, fromTermId, toTermId },
        "current-user",
      );
      await loadData();
      return cf;
    },
    [fromTermId, toTermId, loadData],
  );

  return {
    summary,
    carryForwards,
    isLoading,
    isProcessing,
    error,
    refreshData: loadData,
    processAll,
    applyOne,
    applyAll,
    voidOne,
    createManual,
  };
}

// ============================================================================
// STUDENT CARRY-FORWARD HISTORY HOOK
// ============================================================================

interface UseStudentCarryForwardHistoryReturn {
  records: CarryForwardRecord[];
  totalCreditsApplied: number;
  totalArrearsApplied: number;
  isLoading: boolean;
  error: string | null;
  refreshHistory: () => Promise<void>;
}

export function useStudentCarryForwardHistory(
  studentId: string,
): UseStudentCarryForwardHistoryReturn {
  const [records, setRecords] = useState<CarryForwardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!studentId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setRecords([]);
      } else {
        const data = await getStudentCarryForwards(studentId);
        setRecords(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totalCreditsApplied = useMemo(
    () =>
      records
        .filter((r) => r.balanceType === "credit" && r.status === "applied")
        .reduce((sum, r) => sum + r.amount, 0),
    [records],
  );

  const totalArrearsApplied = useMemo(
    () =>
      records
        .filter((r) => r.balanceType === "arrears" && r.status === "applied")
        .reduce((sum, r) => sum + r.amount, 0),
    [records],
  );

  return {
    records,
    totalCreditsApplied,
    totalArrearsApplied,
    isLoading,
    error,
    refreshHistory: loadHistory,
  };
}

// ============================================================================
// REFUND REQUEST HOOK
// ============================================================================

interface UseRefundRequestReturn {
  createRequest: (
    studentId: string,
    amount: number,
    reason: string,
    refundMethod: RefundRequest["refundMethod"],
    refundDetails: string,
  ) => Promise<RefundRequest>;
  approveRequest: (requestId: string) => Promise<void>;
  completeRequest: (
    requestId: string,
    transactionReference: string,
  ) => Promise<void>;
  isProcessing: boolean;
}

export function useRefundRequest(): UseRefundRequestReturn {
  const [isProcessing, setIsProcessing] = useState(false);

  const create = useCallback(
    async (
      studentId: string,
      amount: number,
      reason: string,
      refundMethod: RefundRequest["refundMethod"],
      refundDetails: string,
    ): Promise<RefundRequest> => {
      setIsProcessing(true);
      try {
        return await createRefundRequest(
          studentId,
          amount,
          reason,
          refundMethod,
          refundDetails,
          "current-user",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const approve = useCallback(async (requestId: string): Promise<void> => {
    setIsProcessing(true);
    try {
      await approveRefundRequest(requestId, "current-user");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const complete = useCallback(
    async (requestId: string, transactionReference: string): Promise<void> => {
      setIsProcessing(true);
      try {
        await completeRefundRequest(
          requestId,
          transactionReference,
          "current-user",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  return {
    createRequest: create,
    approveRequest: approve,
    completeRequest: complete,
    isProcessing,
  };
}

// Re-export helpers
export {
  getCarryForwardStatusInfo,
  formatCarryForward,
  formatTerm,
  getNextTerm,
  getCarryForwardType,
};
