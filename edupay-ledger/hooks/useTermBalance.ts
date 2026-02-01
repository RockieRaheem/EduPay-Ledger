/**
 * Term Balance Carryover Hooks
 * React hooks for managing term balance carryovers
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  TermBalanceCarryover,
  StudentCumulativeBalance,
  CarryoverOptions,
  CarryoverProcessingResult,
  ArrearsReport,
  AcademicPeriod,
  BalanceAdjustment,
} from "../types/term-balance";
import {
  getSchoolCarryovers,
  getStudentCarryovers,
  getStudentCumulativeBalance,
  processTermCarryovers,
  applyBalanceAdjustment,
  waiveCarryover,
  generateArrearsReport,
  getMockCarryovers,
  getMockStudentCarryovers,
  getMockStudentCumulativeBalance,
  getMockArrearsReport,
} from "../lib/services/term-balance.service";

const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// ============================================
// Hook: useTermCarryovers
// Get all carryovers for the school
// ============================================
export function useTermCarryovers(period?: AcademicPeriod) {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [carryovers, setCarryovers] = useState<TermBalanceCarryover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCarryovers = useCallback(async () => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (useMockData) {
        setCarryovers(getMockCarryovers(schoolId));
      } else {
        const data = await getSchoolCarryovers(schoolId, period);
        setCarryovers(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, period]);

  useEffect(() => {
    fetchCarryovers();
  }, [fetchCarryovers]);

  // Calculate summary statistics
  const summary = {
    totalCarryovers: carryovers.length,
    totalDebits: carryovers.filter((c) => c.carryoverType === "debit").length,
    totalCredits: carryovers.filter((c) => c.carryoverType === "credit").length,
    debitAmount: carryovers
      .filter((c) => c.carryoverType === "debit")
      .reduce((sum, c) => sum + c.adjustedAmount, 0),
    creditAmount: carryovers
      .filter((c) => c.carryoverType === "credit")
      .reduce((sum, c) => sum + c.adjustedAmount, 0),
    pendingCount: carryovers.filter((c) => c.status === "pending").length,
    appliedCount: carryovers.filter((c) => c.status === "applied").length,
    waivedCount: carryovers.filter((c) => c.status === "waived").length,
  };

  return {
    carryovers,
    summary,
    isLoading,
    error,
    refresh: fetchCarryovers,
  };
}

// ============================================
// Hook: useStudentTermBalance
// Get cumulative balance for a specific student
// ============================================
export function useStudentTermBalance(
  studentId: string,
  currentPeriod?: AcademicPeriod,
) {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [balance, setBalance] = useState<StudentCumulativeBalance | null>(null);
  const [carryovers, setCarryovers] = useState<TermBalanceCarryover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current period if not specified
  const period = currentPeriod || {
    year: new Date().getFullYear(),
    term: "term_2" as const,
  };

  const fetchBalance = useCallback(async () => {
    if (!schoolId || !studentId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (useMockData) {
        const mockBalance = getMockStudentCumulativeBalance(studentId);
        setBalance(mockBalance);
        setCarryovers(getMockStudentCarryovers(studentId));
      } else {
        const [balanceData, carryoverData] = await Promise.all([
          getStudentCumulativeBalance(schoolId, studentId, period),
          getStudentCarryovers(schoolId, studentId),
        ]);
        setBalance(balanceData);
        setCarryovers(carryoverData);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, studentId, period]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    carryovers,
    isLoading,
    error,
    refresh: fetchBalance,
  };
}

// ============================================
// Hook: useCarryoverProcessing
// Process term-end carryovers
// ============================================
export function useCarryoverProcessing() {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CarryoverProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processCarryovers = useCallback(
    async (
      fromPeriod: AcademicPeriod,
      toPeriod: AcademicPeriod,
      options?: Partial<CarryoverOptions>,
    ) => {
      if (!schoolId || !user?.uid) {
        setError("Not authenticated");
        return null;
      }

      setIsProcessing(true);
      setError(null);
      setResult(null);

      try {
        const fullOptions: CarryoverOptions = {
          schoolId: schoolId,
          fromPeriod,
          toPeriod,
          includeCredits: true,
          autoApply: true,
          generateReport: true,
          notifyParents: false,
          notifyTeachers: false,
          ...options,
        };

        if (useMockData) {
          // Return mock result
          const mockResult: CarryoverProcessingResult = {
            schoolId: schoolId,
            fromPeriod,
            toPeriod,
            processedAt: new Date(),
            processedBy: user.uid,
            totalStudentsProcessed: 150,
            studentsWithDebits: 45,
            studentsWithCredits: 8,
            studentsCleared: 97,
            totalDebitCarryover: 28500000,
            totalCreditCarryover: 1200000,
            netCarryover: 27300000,
            classBreakdown: [
              {
                className: "S.1",
                totalStudents: 45,
                studentsWithDebits: 12,
                studentsWithCredits: 2,
                totalDebit: 7200000,
                totalCredit: 300000,
                netBalance: 6900000,
              },
              {
                className: "S.2",
                totalStudents: 42,
                studentsWithDebits: 10,
                studentsWithCredits: 3,
                totalDebit: 6500000,
                totalCredit: 450000,
                netBalance: 6050000,
              },
              {
                className: "S.3",
                totalStudents: 38,
                studentsWithDebits: 8,
                studentsWithCredits: 1,
                totalDebit: 5800000,
                totalCredit: 150000,
                netBalance: 5650000,
              },
              {
                className: "S.4",
                totalStudents: 25,
                studentsWithDebits: 15,
                studentsWithCredits: 2,
                totalDebit: 9000000,
                totalCredit: 300000,
                netBalance: 8700000,
              },
            ],
            carryovers: [],
            errors: [],
          };
          setResult(mockResult);
          return mockResult;
        }

        const processingResult = await processTermCarryovers(
          fullOptions,
          user.uid,
        );
        setResult(processingResult);
        return processingResult;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [schoolId, user?.uid],
  );

  return {
    processCarryovers,
    isProcessing,
    result,
    error,
  };
}

// ============================================
// Hook: useCarryoverAdjustments
// Apply adjustments to carryovers
// ============================================
export function useCarryoverAdjustments() {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyAdjustment = useCallback(
    async (
      carryoverId: string,
      type: BalanceAdjustment["type"],
      amount: number,
      reason: string,
      notes?: string,
    ) => {
      if (!user?.uid) {
        setError("Not authenticated");
        return null;
      }

      setIsUpdating(true);
      setError(null);

      try {
        if (useMockData) {
          // Return mock success
          return { success: true };
        }

        const adjustment: Omit<BalanceAdjustment, "id"> = {
          type,
          amount,
          reason,
          approvedBy: user.uid,
          approvedAt: new Date(),
          notes,
        };

        const updated = await applyBalanceAdjustment(carryoverId, adjustment);
        return updated;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [user?.uid],
  );

  const waive = useCallback(
    async (carryoverId: string, reason: string) => {
      if (!user?.uid) {
        setError("Not authenticated");
        return null;
      }

      setIsUpdating(true);
      setError(null);

      try {
        if (useMockData) {
          return { success: true };
        }

        const updated = await waiveCarryover(carryoverId, reason, user.uid);
        return updated;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [user?.uid],
  );

  return {
    applyAdjustment,
    waive,
    isUpdating,
    error,
  };
}

// ============================================
// Hook: useOverdueReport
// Generate and view overdue report
// ============================================
export function useOverdueReport(asOfPeriod?: AcademicPeriod) {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [report, setReport] = useState<ArrearsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default period
  const period = asOfPeriod || {
    year: new Date().getFullYear(),
    term: "term_2" as const,
  };

  const generateReport = useCallback(async () => {
    if (!schoolId || !user?.uid) {
      setError("Not authenticated");
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (useMockData) {
        const mockReport = getMockArrearsReport();
        setReport(mockReport);
        return mockReport;
      }

      const newReport = await generateArrearsReport(schoolId, period, user.uid);
      setReport(newReport);
      return newReport;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [schoolId, user?.uid, period]);

  // Auto-load on mount
  useEffect(() => {
    if (schoolId) {
      setIsLoading(true);
      if (useMockData) {
        setReport(getMockArrearsReport());
        setIsLoading(false);
      } else {
        generateReport().finally(() => setIsLoading(false));
      }
    }
  }, [schoolId]);

  return {
    report,
    isLoading,
    isGenerating,
    error,
    generateReport,
    refresh: generateReport,
  };
}

// ============================================
// Wrapper Hooks (inject schoolId from context)
// ============================================

export function useFirebaseTermCarryovers(period?: AcademicPeriod) {
  return useTermCarryovers(period);
}

export function useFirebaseStudentTermBalance(
  studentId: string,
  currentPeriod?: AcademicPeriod,
) {
  return useStudentTermBalance(studentId, currentPeriod);
}

export function useFirebaseCarryoverProcessing() {
  return useCarryoverProcessing();
}

export function useFirebaseCarryoverAdjustments() {
  return useCarryoverAdjustments();
}

export function useFirebaseOverdueReport(asOfPeriod?: AcademicPeriod) {
  return useOverdueReport(asOfPeriod);
}
