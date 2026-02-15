/**
 * Term Comparison Hooks
 * React hooks for term-over-term performance analysis
 */

import { useState, useCallback, useMemo } from 'react';
import {
  TermHistoricalAnalysis,
  TermComparison,
  TermCollectionMetrics,
  TermPeriod,
  TermInsight,
  CategoryTermComparison,
  ClassTermComparison,
  GenerateComparisonInput,
  formatTermPeriod,
  calculateSequenceTrend,
  getTrendDisplayInfo,
  getInsightTypeInfo,
  formatDelta,
  getComparisonColor,
} from '@/types/term-comparison';
import {
  generateTermComparisonAnalysis,
  compareTerms,
  getCategoryComparison,
  getClassComparison,
  getMockTermComparison,
  getMockHistoricalAnalysis,
} from '@/lib/services/term-comparison.service';

// ============================================================================
// HISTORICAL ANALYSIS HOOK
// ============================================================================

interface UseTermAnalysisState {
  analysis: TermHistoricalAnalysis | null;
  loading: boolean;
  error: string | null;
}

interface UseTermAnalysisReturn extends UseTermAnalysisState {
  generateAnalysis: (numberOfTerms?: number) => Promise<TermHistoricalAnalysis>;
  loadMock: () => void;
  // Computed values
  collectionTrend: ReturnType<typeof getTrendDisplayInfo> | null;
  enrollmentTrend: ReturnType<typeof getTrendDisplayInfo> | null;
  formattedAvgRate: string;
  topInsights: TermInsight[];
}

export function useTermAnalysis(
  schoolId: string,
  currentTermId: string,
  userId: string
): UseTermAnalysisReturn {
  const [state, setState] = useState<UseTermAnalysisState>({
    analysis: null,
    loading: false,
    error: null,
  });

  const generateAnalysis = useCallback(async (
    numberOfTerms: number = 4
  ): Promise<TermHistoricalAnalysis> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const input: GenerateComparisonInput = {
        schoolId,
        currentTermId,
        numberOfTerms,
        includeProjections: true,
        generatedBy: userId,
      };
      const analysis = await generateTermComparisonAnalysis(input);
      setState(prev => ({ ...prev, analysis, loading: false }));
      return analysis;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to generate analysis';
      setState(prev => ({ ...prev, error, loading: false }));
      throw err;
    }
  }, [schoolId, currentTermId, userId]);

  const loadMock = useCallback(() => {
    setState({
      analysis: getMockHistoricalAnalysis(),
      loading: false,
      error: null,
    });
  }, []);

  const collectionTrend = useMemo(() => {
    if (!state.analysis) return null;
    const rates = state.analysis.termsAnalyzed.map(t => t.collectionRate);
    const trend = calculateSequenceTrend(rates);
    return getTrendDisplayInfo(trend);
  }, [state.analysis]);

  const enrollmentTrend = useMemo(() => {
    if (!state.analysis) return null;
    const enrollments = state.analysis.termsAnalyzed.map(t => t.totalStudents);
    const trend = calculateSequenceTrend(enrollments);
    const mappedTrend = trend === 'improving' ? 'improving' : trend === 'declining' ? 'declining' : 'stable';
    return getTrendDisplayInfo(mappedTrend);
  }, [state.analysis]);

  const formattedAvgRate = useMemo(() => {
    return state.analysis ? `${state.analysis.averageCollectionRate.toFixed(1)}%` : '0%';
  }, [state.analysis]);

  const topInsights = useMemo(() => {
    if (!state.analysis) return [];
    // Return top 3 high-impact insights
    return state.analysis.insights
      .filter(i => i.impact === 'high' || i.impact === 'medium')
      .slice(0, 3);
  }, [state.analysis]);

  return {
    ...state,
    generateAnalysis,
    loadMock,
    collectionTrend,
    enrollmentTrend,
    formattedAvgRate,
    topInsights,
  };
}

// ============================================================================
// TERM COMPARISON HOOK
// ============================================================================

interface UseTermComparisonState {
  comparison: TermComparison | null;
  loading: boolean;
  error: string | null;
}

interface UseTermComparisonReturn extends UseTermComparisonState {
  compare: (termId1: string, termId2: string) => Promise<TermComparison>;
  loadMock: () => void;
  // Computed display values
  studentsDeltaDisplay: { value: string; color: 'green' | 'red' | 'gray' };
  collectionsDeltaDisplay: { value: string; color: 'green' | 'red' | 'gray' };
  rateDeltaDisplay: { value: string; color: 'green' | 'red' | 'gray' };
  overallTrendDisplay: ReturnType<typeof getTrendDisplayInfo> | null;
}

export function useTermComparison(schoolId: string): UseTermComparisonReturn {
  const [state, setState] = useState<UseTermComparisonState>({
    comparison: null,
    loading: false,
    error: null,
  });

  const compare = useCallback(async (
    termId1: string,
    termId2: string
  ): Promise<TermComparison> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const comparison = await compareTerms(termId1, termId2, schoolId);
      setState(prev => ({ ...prev, comparison, loading: false }));
      return comparison;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to compare terms';
      setState(prev => ({ ...prev, error, loading: false }));
      throw err;
    }
  }, [schoolId]);

  const loadMock = useCallback(() => {
    setState({
      comparison: getMockTermComparison(),
      loading: false,
      error: null,
    });
  }, []);

  const studentsDeltaDisplay = useMemo(() => {
    if (!state.comparison) return { value: '0', color: 'gray' as const };
    const delta = state.comparison.studentsDelta;
    return {
      value: `${delta >= 0 ? '+' : ''}${delta} students`,
      color: getComparisonColor(delta, true),
    };
  }, [state.comparison]);

  const collectionsDeltaDisplay = useMemo(() => {
    if (!state.comparison) return { value: 'UGX 0', color: 'gray' as const };
    const delta = state.comparison.collectionsDelta;
    return {
      value: formatDelta(delta),
      color: getComparisonColor(delta, true),
    };
  }, [state.comparison]);

  const rateDeltaDisplay = useMemo(() => {
    if (!state.comparison) return { value: '0%', color: 'gray' as const };
    const delta = state.comparison.collectionRateDelta;
    return {
      value: formatDelta(delta, true),
      color: getComparisonColor(delta, true),
    };
  }, [state.comparison]);

  const overallTrendDisplay = useMemo(() => {
    return state.comparison
      ? getTrendDisplayInfo(state.comparison.overallTrend)
      : null;
  }, [state.comparison]);

  return {
    ...state,
    compare,
    loadMock,
    studentsDeltaDisplay,
    collectionsDeltaDisplay,
    rateDeltaDisplay,
    overallTrendDisplay,
  };
}

// ============================================================================
// PROJECTION HOOK
// ============================================================================

interface UseTermProjectionReturn {
  projection: TermHistoricalAnalysis['projectedNextTerm'] | null;
  loading: boolean;
  formattedProjectedStudents: string;
  formattedProjectedCollections: string;
  confidenceInfo: { label: string; color: 'green' | 'yellow' | 'red' } | null;
}

export function useTermProjection(
  analysis: TermHistoricalAnalysis | null
): UseTermProjectionReturn {
  const projection = analysis?.projectedNextTerm || null;

  const formattedProjectedStudents = useMemo(() => {
    return projection ? projection.projectedStudents.toString() : '0';
  }, [projection]);

  const formattedProjectedCollections = useMemo(() => {
    if (!projection) return 'UGX 0';
    return `UGX ${projection.projectedCollections.toLocaleString('en-UG')}`;
  }, [projection]);

  const confidenceInfo = useMemo(() => {
    if (!projection) return null;
    const info = {
      high: { label: 'High Confidence', color: 'green' as const },
      medium: { label: 'Medium Confidence', color: 'yellow' as const },
      low: { label: 'Low Confidence', color: 'red' as const },
    };
    return info[projection.confidence];
  }, [projection]);

  return {
    projection,
    loading: false,
    formattedProjectedStudents,
    formattedProjectedCollections,
    confidenceInfo,
  };
}

// ============================================================================
// TREND CHART DATA HOOK
// ============================================================================

interface ChartDataPoint {
  label: string;
  value: number;
  change?: number;
}

interface UseTermChartDataReturn {
  collectionRateData: ChartDataPoint[];
  enrollmentData: ChartDataPoint[];
  outstandingData: ChartDataPoint[];
  hasData: boolean;
}

export function useTermChartData(
  analysis: TermHistoricalAnalysis | null
): UseTermChartDataReturn {
  const collectionRateData = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.collectionRateTrend].reverse().map(t => ({
      label: t.termLabel,
      value: t.value,
      change: t.changePercent,
    }));
  }, [analysis]);

  const enrollmentData = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.enrollmentTrend].reverse().map(t => ({
      label: t.termLabel,
      value: t.value,
      change: t.changePercent,
    }));
  }, [analysis]);

  const outstandingData = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.outstandingTrend].reverse().map(t => ({
      label: t.termLabel,
      value: t.value / 1000000, // Convert to millions for display
      change: t.changePercent,
    }));
  }, [analysis]);

  return {
    collectionRateData,
    enrollmentData,
    outstandingData,
    hasData: !!analysis && analysis.termsAnalyzed.length > 0,
  };
}

// ============================================================================
// CATEGORY COMPARISON HOOK
// ============================================================================

interface UseCategoryComparisonReturn {
  categoryComparisons: CategoryTermComparison[];
  loading: boolean;
  error: string | null;
  loadComparison: (categoryId: string) => Promise<void>;
}

export function useCategoryComparison(
  schoolId: string
): UseCategoryComparisonReturn {
  const [comparisons, setComparisons] = useState<CategoryTermComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async (categoryId: string) => {
    setLoading(true);
    setError(null);
    try {
      const comparison = await getCategoryComparison(schoolId, categoryId);
      setComparisons(prev => {
        const existing = prev.findIndex(c => c.categoryId === categoryId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = comparison;
          return updated;
        }
        return [...prev, comparison];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  return {
    categoryComparisons: comparisons,
    loading,
    error,
    loadComparison,
  };
}

// ============================================================================
// CLASS COMPARISON HOOK
// ============================================================================

interface UseClassComparisonReturn {
  classComparisons: ClassTermComparison[];
  loading: boolean;
  error: string | null;
  loadComparison: (classId: string) => Promise<void>;
  needsAttentionClasses: ClassTermComparison[];
}

export function useClassComparison(
  schoolId: string
): UseClassComparisonReturn {
  const [comparisons, setComparisons] = useState<ClassTermComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async (classId: string) => {
    setLoading(true);
    setError(null);
    try {
      const comparison = await getClassComparison(schoolId, classId);
      setComparisons(prev => {
        const existing = prev.findIndex(c => c.classId === classId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = comparison;
          return updated;
        }
        return [...prev, comparison];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const needsAttentionClasses = useMemo(() => {
    return comparisons.filter(c => c.needsAttention);
  }, [comparisons]);

  return {
    classComparisons: comparisons,
    loading,
    error,
    loadComparison,
    needsAttentionClasses,
  };
}

// ============================================================================
// YEAR OVER YEAR HOOK
// ============================================================================

interface UseYearOverYearReturn {
  comparison: TermHistoricalAnalysis['yearOverYearComparison'];
  hasComparison: boolean;
  studentsDeltaDisplay: { value: string; direction: 'up' | 'down' | 'same' };
  collectionsDeltaDisplay: { value: string; direction: 'up' | 'down' | 'same' };
  significantChanges: string[];
}

export function useYearOverYear(
  analysis: TermHistoricalAnalysis | null
): UseYearOverYearReturn {
  const comparison = analysis?.yearOverYearComparison || null;

  const studentsDeltaDisplay = useMemo(() => {
    if (!comparison) return { value: '0', direction: 'same' as const };
    const delta = comparison.studentsDelta;
    return {
      value: `${Math.abs(delta)} students`,
      direction: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'same' as const,
    };
  }, [comparison]);

  const collectionsDeltaDisplay = useMemo(() => {
    if (!comparison) return { value: 'UGX 0', direction: 'same' as const };
    const delta = comparison.collectionsDelta;
    return {
      value: `UGX ${Math.abs(delta).toLocaleString('en-UG')}`,
      direction: delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'same' as const,
    };
  }, [comparison]);

  return {
    comparison,
    hasComparison: !!comparison,
    studentsDeltaDisplay,
    collectionsDeltaDisplay,
    significantChanges: comparison?.significantChanges || [],
  };
}

// Re-export helper functions for component use
export {
  formatTermPeriod,
  getTrendDisplayInfo,
  getInsightTypeInfo,
  formatDelta,
  getComparisonColor,
};
