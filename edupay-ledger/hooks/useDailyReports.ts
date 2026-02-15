/**
 * Daily Reports Hooks
 * React hooks for daily cash summary and related reports
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  DailyCashSummary,
  DailySummaryStatus,
  GenerateDailySummaryInput,
  DailySummaryQuery,
  GuardianArrearsSummary,
  CollectionVsBudgetReport,
  RiskLevel,
  formatDailySummaryDate,
  getTrendInfo,
  getStatusInfo,
  getRiskLevelInfo,
  formatUGX,
} from "@/types/daily-reports";
import {
  generateDailyCashSummary,
  getDailyCashSummary,
  getDailySummaries,
  submitDailySummary,
  approveDailySummary,
  getArrearsByGuardian,
  generateCollectionVsBudgetReport,
  getMockDailyCashSummary,
  getMockGuardianArrears,
  getMockCollectionVsBudget,
} from "@/lib/services/daily-reports.service";

// ============================================================================
// DAILY CASH SUMMARY HOOK
// ============================================================================

interface UseDailyCashSummaryState {
  summary: DailyCashSummary | null;
  summaries: DailyCashSummary[];
  loading: boolean;
  error: string | null;
}

interface UseDailyCashSummaryActions {
  loadSummary: (date: Date) => Promise<void>;
  loadSummaries: (query: DailySummaryQuery) => Promise<void>;
  generateSummary: (
    input: GenerateDailySummaryInput,
  ) => Promise<DailyCashSummary>;
  submitForApproval: (summaryId: string) => Promise<void>;
  approve: (summaryId: string, approverName: string) => Promise<void>;
  loadMock: () => void;
}

interface UseDailyCashSummaryReturn
  extends UseDailyCashSummaryState, UseDailyCashSummaryActions {
  // Computed values
  formattedTotal: string;
  trendInfo: ReturnType<typeof getTrendInfo> | null;
  statusInfo: ReturnType<typeof getStatusInfo> | null;
}

export function useDailyCashSummary(
  schoolId: string,
): UseDailyCashSummaryReturn {
  const [state, setState] = useState<UseDailyCashSummaryState>({
    summary: null,
    summaries: [],
    loading: false,
    error: null,
  });

  const loadSummary = useCallback(
    async (date: Date) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const summary = await getDailyCashSummary(schoolId, date);
        setState((prev) => ({ ...prev, summary, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to load summary",
          loading: false,
        }));
      }
    },
    [schoolId],
  );

  const loadSummaries = useCallback(
    async (query: DailySummaryQuery) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const summaries = await getDailySummaries({ ...query, schoolId });
        setState((prev) => ({ ...prev, summaries, loading: false }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error:
            err instanceof Error ? err.message : "Failed to load summaries",
          loading: false,
        }));
      }
    },
    [schoolId],
  );

  const generateSummary = useCallback(
    async (input: GenerateDailySummaryInput): Promise<DailyCashSummary> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const summary = await generateDailyCashSummary(input);
        setState((prev) => ({ ...prev, summary, loading: false }));
        return summary;
      } catch (err) {
        const error =
          err instanceof Error ? err.message : "Failed to generate summary";
        setState((prev) => ({ ...prev, error, loading: false }));
        throw err;
      }
    },
    [],
  );

  const submitForApproval = useCallback(async (summaryId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await submitDailySummary(summaryId);
      setState((prev) => ({
        ...prev,
        summary: prev.summary ? { ...prev.summary, status: "submitted" } : null,
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to submit",
        loading: false,
      }));
    }
  }, []);

  const approve = useCallback(
    async (summaryId: string, approverName: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        await approveDailySummary(summaryId, "user-id", approverName);
        setState((prev) => ({
          ...prev,
          summary: prev.summary
            ? { ...prev.summary, status: "approved" }
            : null,
          loading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to approve",
          loading: false,
        }));
      }
    },
    [],
  );

  const loadMock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      summary: getMockDailyCashSummary(),
      loading: false,
      error: null,
    }));
  }, []);

  const formattedTotal = useMemo(() => {
    return state.summary ? formatUGX(state.summary.totalCollections) : "UGX 0";
  }, [state.summary]);

  const trendInfo = useMemo(() => {
    return state.summary?.comparison
      ? getTrendInfo(state.summary.comparison.trend)
      : null;
  }, [state.summary]);

  const statusInfo = useMemo(() => {
    return state.summary ? getStatusInfo(state.summary.status) : null;
  }, [state.summary]);

  return {
    ...state,
    loadSummary,
    loadSummaries,
    generateSummary,
    submitForApproval,
    approve,
    loadMock,
    formattedTotal,
    trendInfo,
    statusInfo,
  };
}

// ============================================================================
// GUARDIAN ARREARS HOOK
// ============================================================================

interface UseGuardianArrearsState {
  arrears: GuardianArrearsSummary[];
  loading: boolean;
  error: string | null;
}

interface UseGuardianArrearsReturn extends UseGuardianArrearsState {
  loadArrears: () => Promise<void>;
  loadMock: () => void;
  // Computed values
  totalArrears: number;
  formattedTotalArrears: string;
  guardianCount: number;
  childCount: number;
  criticalCount: number;
  highRiskCount: number;
  byRiskLevel: Record<RiskLevel, GuardianArrearsSummary[]>;
}

export function useGuardianArrears(schoolId: string): UseGuardianArrearsReturn {
  const [state, setState] = useState<UseGuardianArrearsState>({
    arrears: [],
    loading: false,
    error: null,
  });

  const loadArrears = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const arrears = await getArrearsByGuardian(schoolId);
      setState((prev) => ({ ...prev, arrears, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to load arrears",
        loading: false,
      }));
    }
  }, [schoolId]);

  const loadMock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      arrears: getMockGuardianArrears(),
      loading: false,
      error: null,
    }));
  }, []);

  const totalArrears = useMemo(() => {
    return state.arrears.reduce((sum, g) => sum + g.totalArrears, 0);
  }, [state.arrears]);

  const guardianCount = useMemo(() => state.arrears.length, [state.arrears]);

  const childCount = useMemo(() => {
    return state.arrears.reduce((sum, g) => sum + g.childCount, 0);
  }, [state.arrears]);

  const byRiskLevel = useMemo(() => {
    const grouped: Record<RiskLevel, GuardianArrearsSummary[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const guardian of state.arrears) {
      grouped[guardian.riskLevel].push(guardian);
    }
    return grouped;
  }, [state.arrears]);

  const criticalCount = byRiskLevel.critical.length;
  const highRiskCount = byRiskLevel.high.length;

  return {
    ...state,
    loadArrears,
    loadMock,
    totalArrears,
    formattedTotalArrears: formatUGX(totalArrears),
    guardianCount,
    childCount,
    criticalCount,
    highRiskCount,
    byRiskLevel,
  };
}

// ============================================================================
// COLLECTION VS BUDGET HOOK (BOG REPORT)
// ============================================================================

interface UseBOGReportState {
  report: CollectionVsBudgetReport | null;
  loading: boolean;
  error: string | null;
}

interface UseBOGReportReturn extends UseBOGReportState {
  generateReport: (
    termId: string,
    preparedBy: string,
  ) => Promise<CollectionVsBudgetReport>;
  loadMock: () => void;
  // Computed values
  formattedCollected: string;
  formattedBudgeted: string;
  formattedOutstanding: string;
  onTrack: boolean;
  daysToTarget: number;
  lowPerformingCategories: string[];
}

export function useBOGReport(schoolId: string): UseBOGReportReturn {
  const [state, setState] = useState<UseBOGReportState>({
    report: null,
    loading: false,
    error: null,
  });

  const generateReport = useCallback(
    async (
      termId: string,
      preparedBy: string,
    ): Promise<CollectionVsBudgetReport> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const report = await generateCollectionVsBudgetReport(
          schoolId,
          termId,
          preparedBy,
        );
        setState((prev) => ({ ...prev, report, loading: false }));
        return report;
      } catch (err) {
        const error =
          err instanceof Error ? err.message : "Failed to generate report";
        setState((prev) => ({ ...prev, error, loading: false }));
        throw err;
      }
    },
    [schoolId],
  );

  const loadMock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      report: getMockCollectionVsBudget(),
      loading: false,
      error: null,
    }));
  }, []);

  const formattedCollected = useMemo(() => {
    return state.report ? formatUGX(state.report.totalCollected) : "UGX 0";
  }, [state.report]);

  const formattedBudgeted = useMemo(() => {
    return state.report ? formatUGX(state.report.totalBudgetedFees) : "UGX 0";
  }, [state.report]);

  const formattedOutstanding = useMemo(() => {
    if (!state.report) return "UGX 0";
    return formatUGX(
      state.report.totalBudgetedFees - state.report.totalCollected,
    );
  }, [state.report]);

  const onTrack = useMemo(() => {
    if (!state.report) return false;
    // 70%+ collection rate with 45+ days remaining is on track
    return state.report.collectionRate >= 70 || state.report.daysRemaining > 45;
  }, [state.report]);

  const daysToTarget = useMemo(() => {
    if (!state.report) return 0;
    const outstanding =
      state.report.totalBudgetedFees - state.report.totalCollected;
    if (state.report.requiredDailyCollection <= 0) return 0;
    return Math.ceil(outstanding / state.report.requiredDailyCollection);
  }, [state.report]);

  const lowPerformingCategories = useMemo(() => {
    if (!state.report) return [];
    return state.report.categoryBreakdown
      .filter((c) => c.collectionRate < 60)
      .map((c) => c.categoryName);
  }, [state.report]);

  return {
    ...state,
    generateReport,
    loadMock,
    formattedCollected,
    formattedBudgeted,
    formattedOutstanding,
    onTrack,
    daysToTarget,
    lowPerformingCategories,
  };
}

// ============================================================================
// DAILY REPORTS DASHBOARD HOOK
// ============================================================================

interface DailyReportsDashboard {
  todaySummary: DailyCashSummary | null;
  weekSummaries: DailyCashSummary[];
  weeklyTotal: number;
  averageDaily: number;
  bestDay: { date: Date; amount: number } | null;
  loading: boolean;
}

export function useDailyReportsDashboard(
  schoolId: string,
): DailyReportsDashboard & {
  refresh: () => Promise<void>;
  loadMock: () => void;
} {
  const [dashboard, setDashboard] = useState<DailyReportsDashboard>({
    todaySummary: null,
    weekSummaries: [],
    weeklyTotal: 0,
    averageDaily: 0,
    bestDay: null,
    loading: false,
  });

  const refresh = useCallback(async () => {
    setDashboard((prev) => ({ ...prev, loading: true }));

    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const summaries = await getDailySummaries({
        schoolId,
        dateFrom: weekAgo,
        dateTo: today,
        limit: 7,
      });

      const todaySummary =
        summaries.find((s) => s.date.toDateString() === today.toDateString()) ||
        null;

      const weeklyTotal = summaries.reduce(
        (sum, s) => sum + s.totalCollections,
        0,
      );
      const averageDaily =
        summaries.length > 0 ? weeklyTotal / summaries.length : 0;

      const bestDay =
        summaries.length > 0
          ? summaries.reduce(
              (best, s) =>
                s.totalCollections > (best?.amount || 0)
                  ? { date: s.date, amount: s.totalCollections }
                  : best,
              null as { date: Date; amount: number } | null,
            )
          : null;

      setDashboard({
        todaySummary,
        weekSummaries: summaries,
        weeklyTotal,
        averageDaily,
        bestDay,
        loading: false,
      });
    } catch (error) {
      setDashboard((prev) => ({ ...prev, loading: false }));
    }
  }, [schoolId]);

  const loadMock = useCallback(() => {
    const mock = getMockDailyCashSummary();
    const mockWeek = [mock];

    // Generate mock week data
    for (let i = 1; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const { dateString, displayDate } = formatDailySummaryDate(date);

      mockWeek.push({
        ...mock,
        id: `daily-00${i + 1}`,
        date,
        dateString,
        displayDate,
        totalCollections: mock.totalCollections * (0.6 + Math.random() * 0.8),
      });
    }

    const weeklyTotal = mockWeek.reduce(
      (sum, s) => sum + s.totalCollections,
      0,
    );

    setDashboard({
      todaySummary: mock,
      weekSummaries: mockWeek,
      weeklyTotal,
      averageDaily: weeklyTotal / mockWeek.length,
      bestDay: { date: mock.date, amount: mock.totalCollections },
      loading: false,
    });
  }, []);

  return {
    ...dashboard,
    refresh,
    loadMock,
  };
}

// ============================================================================
// REPORT EXPORT HOOK
// ============================================================================

interface UseReportExportReturn {
  exporting: boolean;
  exportToPDF: (summary: DailyCashSummary) => Promise<void>;
  exportToExcel: (summary: DailyCashSummary) => Promise<void>;
  printReport: (summary: DailyCashSummary) => void;
}

export function useReportExport(): UseReportExportReturn {
  const [exporting, setExporting] = useState(false);

  const exportToPDF = useCallback(async (summary: DailyCashSummary) => {
    setExporting(true);
    try {
      // PDF export logic would go here
      // Using a library like jspdf or react-pdf
      console.log("Exporting to PDF:", summary.displayDate);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate
    } finally {
      setExporting(false);
    }
  }, []);

  const exportToExcel = useCallback(async (summary: DailyCashSummary) => {
    setExporting(true);
    try {
      // Excel export logic would go here
      // Using a library like xlsx or exceljs
      console.log("Exporting to Excel:", summary.displayDate);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate
    } finally {
      setExporting(false);
    }
  }, []);

  const printReport = useCallback((summary: DailyCashSummary) => {
    // Print-friendly view logic
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Daily Cash Summary - ${summary.displayDate}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { font-size: 18px; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
              .total { font-weight: bold; font-size: 24px; }
            </style>
          </head>
          <body>
            <h1>Daily Cash Summary</h1>
            <p>Date: ${summary.displayDate}</p>
            <p>Prepared by: ${summary.preparedByName}</p>
            <p class="total">Total Collections: ${formatUGX(summary.totalCollections)}</p>
            <p>Transactions: ${summary.transactionCount}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, []);

  return {
    exporting,
    exportToPDF,
    exportToExcel,
    printReport,
  };
}
