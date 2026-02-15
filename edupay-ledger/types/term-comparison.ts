/**
 * Term Comparison Types
 * Compare fee collection performance across academic terms
 *
 * Features:
 * - Year-over-year comparison
 * - Term-over-term trends
 * - Category-level analysis
 * - Class performance tracking
 * - Predictive projections
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Academic term identifier
 */
export interface TermPeriod {
  term: 1 | 2 | 3;
  year: string;
  termId: string;
  displayName: string; // "Term 1, 2026"
  shortName: string; // "T1 2026"
  startDate: Date;
  endDate: Date;
}

/**
 * Collection metrics for a single term
 */
export interface TermCollectionMetrics {
  termId: string;
  term: TermPeriod;
  
  // Enrollment
  totalStudents: number;
  newStudents: number;
  withdrawnStudents: number;
  
  // Fee structure
  totalFeesExpected: number;
  averageFeePerStudent: number;
  
  // Collections
  totalCollected: number;
  collectionRate: number; // percentage
  
  // Payment methods
  cashCollections: number;
  momoCollections: number;
  bankCollections: number;
  otherCollections: number;
  
  // Timing
  collectionsWeek1: number;
  collectionsWeek2_4: number;
  collectionsAfterWeek4: number;
  
  // Bad debt
  totalWaivers: number;
  totalWriteOffs: number;
  
  // Outstanding
  totalOutstanding: number;
  studentsWithBalance: number;
  
  // Timestamps
  dataAsOf: Timestamp;
}

/**
 * Comparison between two terms
 */
export interface TermComparison {
  currentTerm: TermCollectionMetrics;
  previousTerm: TermCollectionMetrics;
  
  // Calculated deltas
  studentsDelta: number;
  studentsGrowthPercent: number;
  
  collectionsDelta: number;
  collectionsGrowthPercent: number;
  
  collectionRateDelta: number;
  
  outstandingDelta: number;
  outstandingChangePercent: number;
  
  // Trends
  overallTrend: 'improving' | 'declining' | 'stable';
  collectionTrend: 'improving' | 'declining' | 'stable';
  enrollmentTrend: 'growing' | 'shrinking' | 'stable';
}

/**
 * Multi-term historical analysis
 */
export interface TermHistoricalAnalysis {
  id: string;
  schoolId: string;
  generatedAt: Timestamp;
  generatedBy: string;
  
  // Terms included
  currentTerm: TermPeriod;
  termsAnalyzed: TermCollectionMetrics[];
  termCount: number;
  
  // Summary statistics
  averageCollectionRate: number;
  bestPerformingTerm: TermPeriod;
  worstPerformingTerm: TermPeriod;
  
  // Trends over time
  collectionRateTrend: TrendData[];
  enrollmentTrend: TrendData[];
  outstandingTrend: TrendData[];
  
  // Comparison with previous year
  yearOverYearComparison: YearOverYearComparison | null;
  
  // Projections
  projectedNextTerm: TermProjection;
  
  // Insights
  insights: TermInsight[];
}

/**
 * Trend data point
 */
export interface TrendData {
  termId: string;
  termLabel: string;
  value: number;
  change: number;
  changePercent: number;
}

/**
 * Year-over-year comparison (same term, different years)
 */
export interface YearOverYearComparison {
  currentYear: string;
  previousYear: string;
  term: 1 | 2 | 3;
  
  currentYearMetrics: TermCollectionMetrics;
  previousYearMetrics: TermCollectionMetrics;
  
  studentsDelta: number;
  collectionsDelta: number;
  collectionRateDelta: number;
  
  significantChanges: string[];
}

/**
 * Projected metrics for future term
 */
export interface TermProjection {
  term: TermPeriod;
  
  projectedStudents: number;
  projectedFees: number;
  projectedCollections: number;
  projectedCollectionRate: number;
  
  confidence: 'high' | 'medium' | 'low';
  assumptions: string[];
  
  methodology: string;
}

/**
 * Analytical insight
 */
export interface TermInsight {
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  category: 'enrollment' | 'collections' | 'payment_methods' | 'timing' | 'outstanding';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

// ============================================================================
// CATEGORY-LEVEL COMPARISON
// ============================================================================

/**
 * Fee category performance comparison
 */
export interface CategoryTermComparison {
  categoryId: string;
  categoryName: string;
  
  terms: CategoryTermData[];
  
  averageCollectionRate: number;
  trend: 'improving' | 'declining' | 'stable';
  
  bestTerm: string;
  worstTerm: string;
}

/**
 * Category data for one term
 */
export interface CategoryTermData {
  termId: string;
  termLabel: string;
  
  budgeted: number;
  collected: number;
  collectionRate: number;
  
  studentsPaid: number;
  studentsOwing: number;
}

// ============================================================================
// CLASS-LEVEL COMPARISON
// ============================================================================

/**
 * Class performance comparison
 */
export interface ClassTermComparison {
  classId: string;
  className: string;
  
  terms: ClassTermData[];
  
  averageCollectionRate: number;
  trend: 'improving' | 'declining' | 'stable';
  
  consistentPerformer: boolean;
  needsAttention: boolean;
}

/**
 * Class data for one term
 */
export interface ClassTermData {
  termId: string;
  termLabel: string;
  
  studentCount: number;
  totalFees: number;
  totalCollected: number;
  collectionRate: number;
  
  fullyPaidCount: number;
  partiallyPaidCount: number;
  noPaidCount: number;
}

// ============================================================================
// INPUT/QUERY TYPES
// ============================================================================

export interface GenerateComparisonInput {
  schoolId: string;
  currentTermId: string;
  numberOfTerms: number; // How many terms to compare (default: 4)
  includeProjections: boolean;
  generatedBy: string;
}

export interface TermComparisonQuery {
  schoolId: string;
  fromYear?: string;
  toYear?: string;
  terms?: (1 | 2 | 3)[];
  limit?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format term period for display
 */
export function formatTermPeriod(period: TermPeriod): string {
  return `${getTermName(period.term)}, ${period.year}`;
}

/**
 * Get term name
 */
export function getTermName(term: 1 | 2 | 3): string {
  const names = {
    1: 'Term One',
    2: 'Term Two',
    3: 'Term Three',
  };
  return names[term];
}

/**
 * Get short term name
 */
export function getTermShortName(term: 1 | 2 | 3, year: string): string {
  return `T${term} ${year}`;
}

/**
 * Calculate trend from sequence of values
 */
export function calculateSequenceTrend(
  values: number[]
): 'improving' | 'declining' | 'stable' {
  if (values.length < 2) return 'stable';
  
  // Simple linear regression slope
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
  const sumX2 = Array.from({ length: n }, (_, i) => i * i).reduce((a, b) => a + b, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Threshold: 2% change per term considered significant
  const avgValue = sumY / n;
  const slopePercent = (slope / avgValue) * 100;
  
  if (slopePercent > 2) return 'improving';
  if (slopePercent < -2) return 'declining';
  return 'stable';
}

/**
 * Get insight type info
 */
export function getInsightTypeInfo(type: TermInsight['type']): {
  icon: string;
  color: 'green' | 'red' | 'blue' | 'yellow';
} {
  const info = {
    positive: { icon: 'trending_up', color: 'green' as const },
    negative: { icon: 'trending_down', color: 'red' as const },
    neutral: { icon: 'info', color: 'blue' as const },
    warning: { icon: 'warning', color: 'yellow' as const },
  };
  return info[type];
}

/**
 * Get trend display info
 */
export function getTrendDisplayInfo(trend: 'improving' | 'declining' | 'stable'): {
  icon: string;
  color: 'green' | 'red' | 'gray';
  label: string;
} {
  const info = {
    improving: { icon: 'trending_up', color: 'green' as const, label: 'Improving' },
    declining: { icon: 'trending_down', color: 'red' as const, label: 'Declining' },
    stable: { icon: 'trending_flat', color: 'gray' as const, label: 'Stable' },
  };
  return info[trend];
}

/**
 * Format comparison delta
 */
export function formatDelta(delta: number, isPercentage: boolean = false): string {
  const sign = delta >= 0 ? '+' : '';
  if (isPercentage) {
    return `${sign}${delta.toFixed(1)}%`;
  }
  return `${sign}${delta.toLocaleString('en-UG')} UGX`;
}

/**
 * Get comparison badge color
 */
export function getComparisonColor(
  delta: number,
  positiveIsGood: boolean = true
): 'green' | 'red' | 'gray' {
  if (delta === 0) return 'gray';
  const isPositive = delta > 0;
  return (isPositive === positiveIsGood) ? 'green' : 'red';
}

/**
 * Generate term periods for a range
 */
export function generateTermPeriods(
  startYear: number,
  endYear: number
): TermPeriod[] {
  const periods: TermPeriod[] = [];
  
  for (let year = startYear; year <= endYear; year++) {
    for (const term of [1, 2, 3] as const) {
      const termId = `${year}-T${term}`;
      periods.push({
        term,
        year: year.toString(),
        termId,
        displayName: formatTermPeriod({ term, year: year.toString() } as TermPeriod),
        shortName: getTermShortName(term, year.toString()),
        startDate: getTermStartDate(term, year),
        endDate: getTermEndDate(term, year),
      });
    }
  }
  
  return periods;
}

/**
 * Get term start date (Uganda academic calendar)
 */
function getTermStartDate(term: 1 | 2 | 3, year: number): Date {
  const starts = {
    1: new Date(year, 1, 1), // February 1
    2: new Date(year, 4, 1), // May 1
    3: new Date(year, 8, 1), // September 1
  };
  return starts[term];
}

/**
 * Get term end date (Uganda academic calendar)
 */
function getTermEndDate(term: 1 | 2 | 3, year: number): Date {
  const ends = {
    1: new Date(year, 3, 30), // April 30
    2: new Date(year, 7, 31), // August 31
    3: new Date(year, 11, 15), // December 15
  };
  return ends[term];
}
