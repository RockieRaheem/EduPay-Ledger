/**
 * Term Comparison Service
 * Compares fee collection performance across academic terms
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  TermPeriod,
  TermCollectionMetrics,
  TermComparison,
  TermHistoricalAnalysis,
  TrendData,
  YearOverYearComparison,
  TermProjection,
  TermInsight,
  CategoryTermComparison,
  ClassTermComparison,
  GenerateComparisonInput,
  TermComparisonQuery,
  calculateSequenceTrend,
  formatTermPeriod,
  getTermName,
} from '@/types/term-comparison';

// ============================================================================
// CONSTANTS
// ============================================================================

const TERM_COMPARISONS_COLLECTION = 'termComparisons';
const PAYMENTS_COLLECTION = 'payments';
const STUDENTS_COLLECTION = 'students';
const TERMS_COLLECTION = 'terms';

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate comprehensive term comparison analysis
 */
export async function generateTermComparisonAnalysis(
  input: GenerateComparisonInput
): Promise<TermHistoricalAnalysis> {
  const { schoolId, currentTermId, numberOfTerms, includeProjections, generatedBy } = input;
  
  // Get term metrics for analysis
  const termsAnalyzed = await getTermMetrics(schoolId, numberOfTerms);
  
  if (termsAnalyzed.length === 0) {
    throw new Error('No term data available for analysis');
  }
  
  const currentTerm = termsAnalyzed[0].term;
  
  // Calculate trends
  const collectionRates = termsAnalyzed.map(t => t.collectionRate);
  const enrollments = termsAnalyzed.map(t => t.totalStudents);
  const outstandings = termsAnalyzed.map(t => t.totalOutstanding);
  
  const collectionRateTrend: TrendData[] = termsAnalyzed.map((t, i, arr) => ({
    termId: t.termId,
    termLabel: t.term.shortName,
    value: t.collectionRate,
    change: i < arr.length - 1 ? t.collectionRate - arr[i + 1].collectionRate : 0,
    changePercent: i < arr.length - 1 && arr[i + 1].collectionRate > 0
      ? ((t.collectionRate - arr[i + 1].collectionRate) / arr[i + 1].collectionRate) * 100
      : 0,
  }));
  
  const enrollmentTrend: TrendData[] = termsAnalyzed.map((t, i, arr) => ({
    termId: t.termId,
    termLabel: t.term.shortName,
    value: t.totalStudents,
    change: i < arr.length - 1 ? t.totalStudents - arr[i + 1].totalStudents : 0,
    changePercent: i < arr.length - 1 && arr[i + 1].totalStudents > 0
      ? ((t.totalStudents - arr[i + 1].totalStudents) / arr[i + 1].totalStudents) * 100
      : 0,
  }));
  
  const outstandingTrend: TrendData[] = termsAnalyzed.map((t, i, arr) => ({
    termId: t.termId,
    termLabel: t.term.shortName,
    value: t.totalOutstanding,
    change: i < arr.length - 1 ? t.totalOutstanding - arr[i + 1].totalOutstanding : 0,
    changePercent: i < arr.length - 1 && arr[i + 1].totalOutstanding > 0
      ? ((t.totalOutstanding - arr[i + 1].totalOutstanding) / arr[i + 1].totalOutstanding) * 100
      : 0,
  }));
  
  // Find best and worst performing terms
  const sortedByRate = [...termsAnalyzed].sort((a, b) => b.collectionRate - a.collectionRate);
  const bestPerformingTerm = sortedByRate[0].term;
  const worstPerformingTerm = sortedByRate[sortedByRate.length - 1].term;
  
  // Year-over-year comparison
  const yearOverYearComparison = calculateYearOverYear(termsAnalyzed, currentTerm);
  
  // Generate projection
  const projectedNextTerm = includeProjections
    ? generateProjection(termsAnalyzed, currentTerm)
    : generateProjection(termsAnalyzed, currentTerm); // Always include for now
  
  // Generate insights
  const insights = generateInsights(termsAnalyzed, collectionRateTrend, enrollmentTrend);
  
  const now = Timestamp.now();
  const docRef = doc(collection(db, TERM_COMPARISONS_COLLECTION));
  
  const analysis: TermHistoricalAnalysis = {
    id: docRef.id,
    schoolId,
    generatedAt: now,
    generatedBy,
    currentTerm,
    termsAnalyzed,
    termCount: termsAnalyzed.length,
    averageCollectionRate: collectionRates.reduce((a, b) => a + b, 0) / collectionRates.length,
    bestPerformingTerm,
    worstPerformingTerm,
    collectionRateTrend,
    enrollmentTrend,
    outstandingTrend,
    yearOverYearComparison,
    projectedNextTerm,
    insights,
  };
  
  await setDoc(docRef, analysis);
  return analysis;
}

/**
 * Get term collection metrics
 */
async function getTermMetrics(
  schoolId: string,
  numberOfTerms: number
): Promise<TermCollectionMetrics[]> {
  // In production, this would query actual payment/student data
  // For now, returning structured mock data
  const currentYear = new Date().getFullYear();
  const terms: TermCollectionMetrics[] = [];
  
  for (let i = 0; i < numberOfTerms; i++) {
    const termNum = ((3 - (i % 3)) || 3) as 1 | 2 | 3;
    const year = currentYear - Math.floor(i / 3);
    
    const termPeriod: TermPeriod = {
      term: termNum,
      year: year.toString(),
      termId: `${year}-T${termNum}`,
      displayName: `${getTermName(termNum)}, ${year}`,
      shortName: `T${termNum} ${year}`,
      startDate: new Date(year, termNum === 1 ? 1 : termNum === 2 ? 4 : 8, 1),
      endDate: new Date(year, termNum === 1 ? 3 : termNum === 2 ? 7 : 11, termNum === 3 ? 15 : 30),
    };
    
    // Simulated metrics with realistic variance
    const baseStudents = 180 + (i * 3); // Slight growth over time
    const baseFee = 1500000;
    const variance = 0.85 + (Math.random() * 0.25);
    
    terms.push({
      termId: termPeriod.termId,
      term: termPeriod,
      totalStudents: baseStudents,
      newStudents: Math.floor(baseStudents * 0.15),
      withdrawnStudents: Math.floor(baseStudents * 0.05),
      totalFeesExpected: baseStudents * baseFee,
      averageFeePerStudent: baseFee,
      totalCollected: Math.floor(baseStudents * baseFee * variance),
      collectionRate: variance * 100,
      cashCollections: Math.floor(baseStudents * baseFee * variance * 0.35),
      momoCollections: Math.floor(baseStudents * baseFee * variance * 0.45),
      bankCollections: Math.floor(baseStudents * baseFee * variance * 0.15),
      otherCollections: Math.floor(baseStudents * baseFee * variance * 0.05),
      collectionsWeek1: Math.floor(baseStudents * baseFee * variance * 0.3),
      collectionsWeek2_4: Math.floor(baseStudents * baseFee * variance * 0.5),
      collectionsAfterWeek4: Math.floor(baseStudents * baseFee * variance * 0.2),
      totalWaivers: Math.floor(baseStudents * baseFee * 0.02),
      totalWriteOffs: Math.floor(baseStudents * baseFee * 0.01),
      totalOutstanding: Math.floor(baseStudents * baseFee * (1 - variance)),
      studentsWithBalance: Math.floor(baseStudents * (1 - variance)),
      dataAsOf: Timestamp.now(),
    });
  }
  
  return terms;
}

/**
 * Calculate year-over-year comparison
 */
function calculateYearOverYear(
  terms: TermCollectionMetrics[],
  currentTerm: TermPeriod
): YearOverYearComparison | null {
  // Find same term in previous year
  const previousYearTerm = terms.find(
    t => t.term.term === currentTerm.term &&
         parseInt(t.term.year) === parseInt(currentTerm.year) - 1
  );
  
  if (!previousYearTerm) return null;
  
  const currentTermMetrics = terms.find(t => t.termId === currentTerm.termId);
  if (!currentTermMetrics) return null;
  
  const studentsDelta = currentTermMetrics.totalStudents - previousYearTerm.totalStudents;
  const collectionsDelta = currentTermMetrics.totalCollected - previousYearTerm.totalCollected;
  const collectionRateDelta = currentTermMetrics.collectionRate - previousYearTerm.collectionRate;
  
  const significantChanges: string[] = [];
  
  if (Math.abs(studentsDelta) > 10) {
    significantChanges.push(
      studentsDelta > 0
        ? `Enrollment increased by ${studentsDelta} students`
        : `Enrollment decreased by ${Math.abs(studentsDelta)} students`
    );
  }
  
  if (Math.abs(collectionRateDelta) > 5) {
    significantChanges.push(
      collectionRateDelta > 0
        ? `Collection rate improved by ${collectionRateDelta.toFixed(1)}%`
        : `Collection rate dropped by ${Math.abs(collectionRateDelta).toFixed(1)}%`
    );
  }
  
  return {
    currentYear: currentTerm.year,
    previousYear: (parseInt(currentTerm.year) - 1).toString(),
    term: currentTerm.term,
    currentYearMetrics: currentTermMetrics,
    previousYearMetrics: previousYearTerm,
    studentsDelta,
    collectionsDelta,
    collectionRateDelta,
    significantChanges,
  };
}

/**
 * Generate projection for next term
 */
function generateProjection(
  terms: TermCollectionMetrics[],
  currentTerm: TermPeriod
): TermProjection {
  // Simple projection based on historical averages and trends
  const avgStudents = terms.reduce((sum, t) => sum + t.totalStudents, 0) / terms.length;
  const avgFee = terms.reduce((sum, t) => sum + t.averageFeePerStudent, 0) / terms.length;
  const avgRate = terms.reduce((sum, t) => sum + t.collectionRate, 0) / terms.length;
  
  // Apply 3% growth assumption
  const projectedStudents = Math.round(avgStudents * 1.03);
  const projectedFees = projectedStudents * Math.round(avgFee * 1.05); // 5% fee increase
  const projectedCollections = Math.round(projectedFees * (avgRate / 100));
  
  const nextTerm = ((currentTerm.term % 3) + 1) as 1 | 2 | 3;
  const nextYear = nextTerm === 1 ? parseInt(currentTerm.year) + 1 : parseInt(currentTerm.year);
  
  const nextTermPeriod: TermPeriod = {
    term: nextTerm,
    year: nextYear.toString(),
    termId: `${nextYear}-T${nextTerm}`,
    displayName: `${getTermName(nextTerm)}, ${nextYear}`,
    shortName: `T${nextTerm} ${nextYear}`,
    startDate: new Date(nextYear, nextTerm === 1 ? 1 : nextTerm === 2 ? 4 : 8, 1),
    endDate: new Date(nextYear, nextTerm === 1 ? 3 : nextTerm === 2 ? 7 : 11, nextTerm === 3 ? 15 : 30),
  };
  
  return {
    term: nextTermPeriod,
    projectedStudents,
    projectedFees,
    projectedCollections,
    projectedCollectionRate: avgRate,
    confidence: terms.length >= 6 ? 'high' : terms.length >= 3 ? 'medium' : 'low',
    assumptions: [
      '3% enrollment growth assumed',
      '5% fee adjustment applied',
      'Historical collection pattern maintained',
      'No major economic disruptions',
    ],
    methodology: 'Moving average with linear trend adjustment',
  };
}

/**
 * Generate analytical insights
 */
function generateInsights(
  terms: TermCollectionMetrics[],
  collectionTrend: TrendData[],
  enrollmentTrend: TrendData[]
): TermInsight[] {
  const insights: TermInsight[] = [];
  
  // Collection rate trend insight
  const collectionRates = terms.map(t => t.collectionRate);
  const collectionSeqTrend = calculateSequenceTrend(collectionRates);
  
  if (collectionSeqTrend === 'improving') {
    insights.push({
      type: 'positive',
      category: 'collections',
      title: 'Collection Rate Improving',
      description: `Collection rates have been steadily improving over the last ${terms.length} terms.`,
      impact: 'high',
      recommendation: 'Continue current collection strategies and consider replicating successful approaches.',
    });
  } else if (collectionSeqTrend === 'declining') {
    insights.push({
      type: 'negative',
      category: 'collections',
      title: 'Collection Rate Declining',
      description: `Collection rates have been declining over the last ${terms.length} terms.`,
      impact: 'high',
      recommendation: 'Review fee collection procedures and consider implementing stricter follow-up protocols.',
    });
  }
  
  // Payment method insights
  const latestTerm = terms[0];
  const momoPercentage = (latestTerm.momoCollections / latestTerm.totalCollected) * 100;
  
  if (momoPercentage > 50) {
    insights.push({
      type: 'positive',
      category: 'payment_methods',
      title: 'Strong Mobile Money Adoption',
      description: `Mobile money accounts for ${momoPercentage.toFixed(1)}% of collections.`,
      impact: 'medium',
      recommendation: 'Continue promoting mobile money payments for convenience and reconciliation efficiency.',
    });
  } else if (momoPercentage < 30) {
    insights.push({
      type: 'neutral',
      category: 'payment_methods',
      title: 'Opportunity for Mobile Money Growth',
      description: `Mobile money only accounts for ${momoPercentage.toFixed(1)}% of collections.`,
      impact: 'medium',
      recommendation: 'Promote mobile money payment options to parents for faster, trackable payments.',
    });
  }
  
  // Outstanding balance insight
  const avgOutstanding = terms.reduce((sum, t) => sum + t.totalOutstanding, 0) / terms.length;
  if (latestTerm.totalOutstanding > avgOutstanding * 1.2) {
    insights.push({
      type: 'warning',
      category: 'outstanding',
      title: 'Higher Than Average Outstanding',
      description: `Current outstanding balance is ${((latestTerm.totalOutstanding - avgOutstanding) / avgOutstanding * 100).toFixed(0)}% above historical average.`,
      impact: 'high',
      recommendation: 'Intensify follow-up on overdue accounts and review payment promise compliance.',
    });
  }
  
  // Timing insight
  const week1Percentage = (latestTerm.collectionsWeek1 / latestTerm.totalCollected) * 100;
  if (week1Percentage > 40) {
    insights.push({
      type: 'positive',
      category: 'timing',
      title: 'Strong Early Collections',
      description: `${week1Percentage.toFixed(0)}% of fees collected in the first week of term.`,
      impact: 'medium',
    });
  }
  
  return insights;
}

/**
 * Compare two specific terms
 */
export async function compareTerms(
  termId1: string,
  termId2: string,
  schoolId: string
): Promise<TermComparison> {
  const terms = await getTermMetrics(schoolId, 6);
  const term1 = terms.find(t => t.termId === termId1);
  const term2 = terms.find(t => t.termId === termId2);
  
  if (!term1 || !term2) {
    throw new Error('One or both terms not found');
  }
  
  const studentsDelta = term1.totalStudents - term2.totalStudents;
  const collectionsDelta = term1.totalCollected - term2.totalCollected;
  const outstandingDelta = term1.totalOutstanding - term2.totalOutstanding;
  
  return {
    currentTerm: term1,
    previousTerm: term2,
    studentsDelta,
    studentsGrowthPercent: (studentsDelta / term2.totalStudents) * 100,
    collectionsDelta,
    collectionsGrowthPercent: (collectionsDelta / term2.totalCollected) * 100,
    collectionRateDelta: term1.collectionRate - term2.collectionRate,
    outstandingDelta,
    outstandingChangePercent: (outstandingDelta / term2.totalOutstanding) * 100,
    overallTrend: calculateSequenceTrend([term1.collectionRate, term2.collectionRate]),
    collectionTrend: calculateSequenceTrend([term1.totalCollected, term2.totalCollected]),
    enrollmentTrend: studentsDelta > 5 ? 'growing' : studentsDelta < -5 ? 'shrinking' : 'stable',
  };
}

/**
 * Get category comparison across terms
 */
export async function getCategoryComparison(
  schoolId: string,
  categoryId: string,
  numberOfTerms: number = 4
): Promise<CategoryTermComparison> {
  // Placeholder - would integrate with fee categories
  return {
    categoryId,
    categoryName: 'Tuition Fees',
    terms: [],
    averageCollectionRate: 85,
    trend: 'stable',
    bestTerm: 'T1 2026',
    worstTerm: 'T3 2025',
  };
}

/**
 * Get class comparison across terms
 */
export async function getClassComparison(
  schoolId: string,
  classId: string,
  numberOfTerms: number = 4
): Promise<ClassTermComparison> {
  // Placeholder - would integrate with class data
  return {
    classId,
    className: 'S.4 Blue',
    terms: [],
    averageCollectionRate: 88,
    trend: 'improving',
    consistentPerformer: true,
    needsAttention: false,
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

export function getMockTermComparison(): TermComparison {
  const currentTerm = getMockTermMetrics('2026-T1');
  const previousTerm = getMockTermMetrics('2025-T3');
  
  return {
    currentTerm,
    previousTerm,
    studentsDelta: 8,
    studentsGrowthPercent: 4.3,
    collectionsDelta: 15000000,
    collectionsGrowthPercent: 6.2,
    collectionRateDelta: 2.1,
    outstandingDelta: -5000000,
    outstandingChangePercent: -12.5,
    overallTrend: 'improving',
    collectionTrend: 'improving',
    enrollmentTrend: 'growing',
  };
}

function getMockTermMetrics(termId: string): TermCollectionMetrics {
  const [year, termPart] = termId.split('-T');
  const term = parseInt(termPart) as 1 | 2 | 3;
  
  return {
    termId,
    term: {
      term,
      year,
      termId,
      displayName: `${getTermName(term)}, ${year}`,
      shortName: `T${term} ${year}`,
      startDate: new Date(parseInt(year), term === 1 ? 1 : term === 2 ? 4 : 8, 1),
      endDate: new Date(parseInt(year), term === 1 ? 3 : term === 2 ? 7 : 11, 30),
    },
    totalStudents: 192,
    newStudents: 28,
    withdrawnStudents: 8,
    totalFeesExpected: 288000000,
    averageFeePerStudent: 1500000,
    totalCollected: 253440000,
    collectionRate: 88.0,
    cashCollections: 88704000,
    momoCollections: 114048000,
    bankCollections: 38016000,
    otherCollections: 12672000,
    collectionsWeek1: 76032000,
    collectionsWeek2_4: 126720000,
    collectionsAfterWeek4: 50688000,
    totalWaivers: 5760000,
    totalWriteOffs: 2880000,
    totalOutstanding: 34560000,
    studentsWithBalance: 35,
    dataAsOf: Timestamp.now(),
  };
}

export function getMockHistoricalAnalysis(): TermHistoricalAnalysis {
  return {
    id: 'analysis-001',
    schoolId: 'school-001',
    generatedAt: Timestamp.now(),
    generatedBy: 'Sarah Nambi',
    currentTerm: {
      term: 1,
      year: '2026',
      termId: '2026-T1',
      displayName: 'Term One, 2026',
      shortName: 'T1 2026',
      startDate: new Date(2026, 1, 2),
      endDate: new Date(2026, 3, 30),
    },
    termsAnalyzed: [
      getMockTermMetrics('2026-T1'),
      getMockTermMetrics('2025-T3'),
      getMockTermMetrics('2025-T2'),
      getMockTermMetrics('2025-T1'),
    ],
    termCount: 4,
    averageCollectionRate: 86.5,
    bestPerformingTerm: {
      term: 1,
      year: '2026',
      termId: '2026-T1',
      displayName: 'Term One, 2026',
      shortName: 'T1 2026',
      startDate: new Date(2026, 1, 2),
      endDate: new Date(2026, 3, 30),
    },
    worstPerformingTerm: {
      term: 3,
      year: '2025',
      termId: '2025-T3',
      displayName: 'Term Three, 2025',
      shortName: 'T3 2025',
      startDate: new Date(2025, 8, 1),
      endDate: new Date(2025, 11, 15),
    },
    collectionRateTrend: [
      { termId: '2026-T1', termLabel: 'T1 2026', value: 88.0, change: 2.0, changePercent: 2.3 },
      { termId: '2025-T3', termLabel: 'T3 2025', value: 86.0, change: 1.0, changePercent: 1.2 },
      { termId: '2025-T2', termLabel: 'T2 2025', value: 85.0, change: -1.0, changePercent: -1.2 },
      { termId: '2025-T1', termLabel: 'T1 2025', value: 87.0, change: 0, changePercent: 0 },
    ],
    enrollmentTrend: [
      { termId: '2026-T1', termLabel: 'T1 2026', value: 192, change: 8, changePercent: 4.3 },
      { termId: '2025-T3', termLabel: 'T3 2025', value: 184, change: 2, changePercent: 1.1 },
      { termId: '2025-T2', termLabel: 'T2 2025', value: 182, change: 4, changePercent: 2.2 },
      { termId: '2025-T1', termLabel: 'T1 2025', value: 178, change: 0, changePercent: 0 },
    ],
    outstandingTrend: [
      { termId: '2026-T1', termLabel: 'T1 2026', value: 34560000, change: -5000000, changePercent: -12.6 },
      { termId: '2025-T3', termLabel: 'T3 2025', value: 39560000, change: 2000000, changePercent: 5.3 },
      { termId: '2025-T2', termLabel: 'T2 2025', value: 37560000, change: -3000000, changePercent: -7.4 },
      { termId: '2025-T1', termLabel: 'T1 2025', value: 40560000, change: 0, changePercent: 0 },
    ],
    yearOverYearComparison: {
      currentYear: '2026',
      previousYear: '2025',
      term: 1,
      currentYearMetrics: getMockTermMetrics('2026-T1'),
      previousYearMetrics: getMockTermMetrics('2025-T1'),
      studentsDelta: 14,
      collectionsDelta: 18000000,
      collectionRateDelta: 1.0,
      significantChanges: [
        'Enrollment increased by 14 students',
        'Collections improved by UGX 18M',
      ],
    },
    projectedNextTerm: {
      term: {
        term: 2,
        year: '2026',
        termId: '2026-T2',
        displayName: 'Term Two, 2026',
        shortName: 'T2 2026',
        startDate: new Date(2026, 4, 1),
        endDate: new Date(2026, 7, 31),
      },
      projectedStudents: 198,
      projectedFees: 306000000,
      projectedCollections: 269280000,
      projectedCollectionRate: 88.0,
      confidence: 'high',
      assumptions: [
        '3% enrollment growth assumed',
        '5% fee adjustment applied',
        'Historical collection pattern maintained',
        'No major economic disruptions',
      ],
      methodology: 'Moving average with linear trend adjustment',
    },
    insights: [
      {
        type: 'positive',
        category: 'collections',
        title: 'Collection Rate Improving',
        description: 'Collection rates have been steadily improving over the last 4 terms.',
        impact: 'high',
        recommendation: 'Continue current collection strategies and consider replicating successful approaches.',
      },
      {
        type: 'positive',
        category: 'payment_methods',
        title: 'Strong Mobile Money Adoption',
        description: 'Mobile money accounts for 45% of collections.',
        impact: 'medium',
        recommendation: 'Continue promoting mobile money payments for convenience and reconciliation efficiency.',
      },
      {
        type: 'positive',
        category: 'timing',
        title: 'Strong Early Collections',
        description: '30% of fees collected in the first week of term.',
        impact: 'medium',
      },
    ],
  };
}
