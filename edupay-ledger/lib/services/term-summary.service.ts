/**
 * End-of-Term Financial Summary Service
 * Backend service for generating comprehensive term-end reports
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  TermFinancialSummary,
  CategoryCollection,
  ClassCollection,
  PaymentMethodCollection,
  ScholarshipSummary,
  ArrearsSummary,
  ClearanceSummary,
  WeeklyCollectionData,
  StudentOutstandingItem,
  ClassPerformanceReport,
  GenerateReportRequest,
  ReportConfig,
  calculateCollectionRate,
  getTermDateRange,
} from "../../types/term-summary";

// ============================================
// LOCAL TYPE DEFINITIONS
// ============================================

interface FirestoreStudentData {
  id: string;
  status: string;
  residenceType?: string;
  totalFees: number;
  amountPaid?: number;
  balance?: number;
  className: string;
  streamName?: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  guardian?: { phone?: string };
  isCleared?: boolean;
  previousBalance?: number;
}

interface FirestorePaymentData {
  id: string;
  amount: number;
  categoryId?: string;
  studentId: string;
  channel?: string;
  paymentMethod?: string;
  date?: Date;
}

// ============================================
// GENERATE TERM SUMMARY
// ============================================

export async function generateTermFinancialSummary(
  request: GenerateReportRequest,
  userId: string,
): Promise<TermFinancialSummary> {
  const { schoolId, term, year } = request;
  const { start: periodStart, end: periodEnd } = getTermDateRange(term, year);

  // Get all students
  const studentsRef = collection(db, "schools", schoolId, "students");
  const studentsSnap = await getDocs(studentsRef);
  const students: FirestoreStudentData[] = studentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as FirestoreStudentData[];

  // Get all payments in the term
  const paymentsRef = collection(db, "schools", schoolId, "payments");
  const paymentsQuery = query(
    paymentsRef,
    where("date", ">=", Timestamp.fromDate(periodStart)),
    where("date", "<=", Timestamp.fromDate(periodEnd)),
    where("status", "==", "completed"),
  );
  const paymentsSnap = await getDocs(paymentsQuery);
  const payments: FirestorePaymentData[] = paymentsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate() || new Date(),
  })) as FirestorePaymentData[];

  // Calculate totals
  const totalStudents = students.length;
  const activeStudents = students.filter(
    (s: FirestoreStudentData) => s.status === "active",
  ).length;
  const boardingStudents = students.filter(
    (s: FirestoreStudentData) => s.residenceType === "boarding",
  ).length;
  const dayStudents = students.filter(
    (s: FirestoreStudentData) => s.residenceType === "day",
  ).length;

  const totalExpectedFees = students.reduce(
    (sum: number, s: FirestoreStudentData) => sum + (s.totalFees || 0),
    0,
  );
  const totalCollected = payments.reduce(
    (sum, p: FirestorePaymentData) => sum + (p.amount || 0),
    0,
  );
  const totalOutstanding = totalExpectedFees - totalCollected;
  const collectionRate = calculateCollectionRate(
    totalCollected,
    totalExpectedFees,
  );

  // Collection by Category
  const collectionByCategory = await calculateCategoryCollection(
    schoolId,
    payments,
    students,
  );

  // Collection by Class
  const collectionByClass = await calculateClassCollection(
    schoolId,
    students,
    payments,
  );

  // Payment Methods
  const collectionByPaymentMethod = calculatePaymentMethodCollection(payments);

  // Scholarship Summary
  const scholarshipSummary = await calculateScholarshipSummary(
    schoolId,
    term,
    year,
  );

  // Arrears Summary
  const arrearsSummary = await calculateArrearsSummary(schoolId, students);

  // Clearance Summary
  const clearanceSummary = await calculateClearanceSummary(schoolId, students);

  // Weekly Collection Trend
  const weeklyCollection = calculateWeeklyCollection(
    payments,
    periodStart,
    periodEnd,
  );

  // Calculate daily average and peak
  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dailyAverage = totalCollected / totalDays;
  const peakDay = findPeakCollectionDay(payments);

  // Create summary
  const summaryData: Omit<TermFinancialSummary, "id"> = {
    schoolId,
    term,
    year,
    generatedAt: new Date(),
    generatedBy: userId,
    status: "draft",
    periodStart,
    periodEnd,
    totalStudents,
    activeStudents,
    boardingStudents,
    dayStudents,
    newEnrollments: 0, // Would need enrollment date tracking
    withdrawals: 0,
    totalExpectedFees,
    totalCollected,
    totalOutstanding,
    collectionRate,
    collectionByCategory,
    collectionByClass,
    collectionByPaymentMethod,
    scholarshipSummary,
    arrearsSummary,
    clearanceSummary,
    weeklyCollection,
    dailyAverage,
    peakCollectionDay: peakDay,
  };

  // Save to Firestore
  const summariesRef = collection(db, "schools", schoolId, "termSummaries");
  const docRef = await addDoc(summariesRef, {
    ...summaryData,
    generatedAt: Timestamp.now(),
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    peakCollectionDay: {
      ...peakDay,
      date: Timestamp.fromDate(peakDay.date),
    },
  });

  return {
    id: docRef.id,
    ...summaryData,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function calculateCategoryCollection(
  schoolId: string,
  payments: FirestorePaymentData[],
  students: FirestoreStudentData[],
): Promise<CategoryCollection[]> {
  // Get fee categories
  const categoriesRef = collection(db, "schools", schoolId, "feeCategories");
  const categoriesSnap = await getDocs(categoriesRef);

  const categories: CategoryCollection[] = [];

  for (const catDoc of categoriesSnap.docs) {
    const cat = catDoc.data();
    const categoryPayments = payments.filter(
      (p: FirestorePaymentData) => p.categoryId === catDoc.id,
    );
    const collectedAmount = categoryPayments.reduce(
      (sum, p: FirestorePaymentData) => sum + (p.amount || 0),
      0,
    );

    // Calculate expected (simplified - would need fee structure data)
    const expectedAmount = students.length * (cat.defaultAmount || 0);

    categories.push({
      categoryId: catDoc.id,
      categoryName: cat.name || "Unknown",
      expectedAmount,
      collectedAmount,
      outstandingAmount: Math.max(0, expectedAmount - collectedAmount),
      collectionRate: calculateCollectionRate(collectedAmount, expectedAmount),
      studentCount: new Set(
        categoryPayments.map((p: FirestorePaymentData) => p.studentId),
      ).size,
    });
  }

  return categories.sort((a, b) => b.collectedAmount - a.collectedAmount);
}

async function calculateClassCollection(
  schoolId: string,
  students: FirestoreStudentData[],
  payments: FirestorePaymentData[],
): Promise<ClassCollection[]> {
  // Group students by class
  const classSummary: { [key: string]: ClassCollection } = {};

  for (const student of students) {
    const className = student.className || "Unknown";

    if (!classSummary[className]) {
      classSummary[className] = {
        classId: className,
        className,
        streamName: student.streamName,
        totalStudents: 0,
        expectedAmount: 0,
        collectedAmount: 0,
        outstandingAmount: 0,
        collectionRate: 0,
        fullyPaidCount: 0,
        partiallyPaidCount: 0,
        unpaidCount: 0,
      };
    }

    classSummary[className].totalStudents++;
    classSummary[className].expectedAmount += student.totalFees || 0;

    // Get student's payments
    const studentPayments = payments.filter(
      (p: FirestorePaymentData) => p.studentId === student.id,
    );
    const studentPaid = studentPayments.reduce(
      (sum, p: FirestorePaymentData) => sum + (p.amount || 0),
      0,
    );

    classSummary[className].collectedAmount += studentPaid;

    // Categorize payment status
    if (studentPaid >= (student.totalFees || 0)) {
      classSummary[className].fullyPaidCount++;
    } else if (studentPaid > 0) {
      classSummary[className].partiallyPaidCount++;
    } else {
      classSummary[className].unpaidCount++;
    }
  }

  // Calculate rates and outstanding
  return Object.values(classSummary)
    .map((cls) => ({
      ...cls,
      outstandingAmount: cls.expectedAmount - cls.collectedAmount,
      collectionRate: calculateCollectionRate(
        cls.collectedAmount,
        cls.expectedAmount,
      ),
    }))
    .sort((a, b) => b.collectionRate - a.collectionRate);
}

function calculatePaymentMethodCollection(
  payments: FirestorePaymentData[],
): PaymentMethodCollection[] {
  const methodSummary: { [key: string]: { count: number; amount: number } } =
    {};

  for (const payment of payments) {
    const method = payment.paymentMethod || "Cash";
    if (!methodSummary[method]) {
      methodSummary[method] = { count: 0, amount: 0 };
    }
    methodSummary[method].count++;
    methodSummary[method].amount += payment.amount || 0;
  }

  const totalAmount = payments.reduce(
    (sum, p: FirestorePaymentData) => sum + (p.amount || 0),
    0,
  );

  return Object.entries(methodSummary)
    .map(([method, data]) => ({
      method,
      transactionCount: data.count,
      totalAmount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      averageTransaction: data.count > 0 ? data.amount / data.count : 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

async function calculateScholarshipSummary(
  schoolId: string,
  term: string,
  year: number,
): Promise<ScholarshipSummary> {
  const scholarshipsRef = collection(db, "schools", schoolId, "scholarships");
  const scholarshipsQuery = query(
    scholarshipsRef,
    where("status", "==", "active"),
  );
  const scholarshipsSnap = await getDocs(scholarshipsQuery);

  let totalAmount = 0;
  let fullCount = 0;
  let partialCount = 0;
  let bursaryCount = 0;
  let sponsorCount = 0;
  const bySource: { [key: string]: { count: number; amount: number } } = {};

  for (const doc of scholarshipsSnap.docs) {
    const scholarship = doc.data();
    totalAmount += scholarship.amount || 0;

    if (scholarship.coveragePercent === 100) fullCount++;
    else partialCount++;

    if (scholarship.type === "bursary") bursaryCount++;
    else if (scholarship.type === "sponsorship") sponsorCount++;

    const source = scholarship.source || "Unknown";
    if (!bySource[source]) {
      bySource[source] = { count: 0, amount: 0 };
    }
    bySource[source].count++;
    bySource[source].amount += scholarship.amount || 0;
  }

  return {
    totalScholarships: scholarshipsSnap.size,
    totalBeneficiaries: scholarshipsSnap.size, // Simplified
    totalAmountAwarded: totalAmount,
    fullScholarships: fullCount,
    partialScholarships: partialCount,
    bursaries: bursaryCount,
    sponsorships: sponsorCount,
    bySource: Object.entries(bySource).map(([source, data]) => ({
      source,
      count: data.count,
      amount: data.amount,
    })),
  };
}

async function calculateArrearsSummary(
  schoolId: string,
  students: FirestoreStudentData[],
): Promise<ArrearsSummary> {
  const studentsWithArrears = students.filter(
    (s: FirestoreStudentData) => (s.previousBalance || 0) > 0,
  );
  const totalArrearsAmount = studentsWithArrears.reduce(
    (sum, s: FirestoreStudentData) => sum + (s.previousBalance || 0),
    0,
  );
  const arrearsRecovered = 0; // Would need tracking

  // Age brackets (simplified)
  const brackets = [
    {
      bracket: "0-30 days",
      studentCount: Math.floor(studentsWithArrears.length * 0.3),
      totalAmount: totalArrearsAmount * 0.2,
    },
    {
      bracket: "31-60 days",
      studentCount: Math.floor(studentsWithArrears.length * 0.25),
      totalAmount: totalArrearsAmount * 0.25,
    },
    {
      bracket: "61-90 days",
      studentCount: Math.floor(studentsWithArrears.length * 0.25),
      totalAmount: totalArrearsAmount * 0.25,
    },
    {
      bracket: "90+ days",
      studentCount: Math.floor(studentsWithArrears.length * 0.2),
      totalAmount: totalArrearsAmount * 0.3,
    },
  ];

  return {
    totalArrearsFromPreviousTerm: totalArrearsAmount,
    arrearsCarriedForward: totalArrearsAmount - arrearsRecovered,
    arrearsRecovered,
    arrearsRecoveryRate:
      totalArrearsAmount > 0
        ? (arrearsRecovered / totalArrearsAmount) * 100
        : 0,
    studentsWithArrears: studentsWithArrears.length,
    averageArrearsPerStudent:
      studentsWithArrears.length > 0
        ? totalArrearsAmount / studentsWithArrears.length
        : 0,
    arrearsAgeBrackets: brackets,
  };
}

async function calculateClearanceSummary(
  schoolId: string,
  students: FirestoreStudentData[],
): Promise<ClearanceSummary> {
  const cleared = students.filter(
    (s: FirestoreStudentData) => s.isCleared === true,
  ).length;
  const notCleared = students.length - cleared;

  // By class
  const byClass: { [key: string]: { total: number; cleared: number } } = {};

  for (const student of students) {
    const className = student.className || "Unknown";
    if (!byClass[className]) {
      byClass[className] = { total: 0, cleared: 0 };
    }
    byClass[className].total++;
    if (student.isCleared) byClass[className].cleared++;
  }

  return {
    totalEligible: students.length,
    cleared,
    notCleared,
    clearanceRate: students.length > 0 ? (cleared / students.length) * 100 : 0,
    clearedByClass: Object.entries(byClass).map(([className, data]) => ({
      className,
      total: data.total,
      cleared: data.cleared,
      rate: data.total > 0 ? (data.cleared / data.total) * 100 : 0,
    })),
  };
}

function calculateWeeklyCollection(
  payments: FirestorePaymentData[],
  periodStart: Date,
  periodEnd: Date,
): WeeklyCollectionData[] {
  const weeks: WeeklyCollectionData[] = [];
  let weekStart = new Date(periodStart);
  let weekNumber = 1;

  while (weekStart < periodEnd) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const weekPayments = payments.filter((p: FirestorePaymentData) => {
      if (!p.date) return false;
      const paymentDate = new Date(p.date);
      return paymentDate >= weekStart && paymentDate < weekEnd;
    });

    weeks.push({
      weekNumber,
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      amount: weekPayments.reduce(
        (sum, p: FirestorePaymentData) => sum + (p.amount || 0),
        0,
      ),
      transactionCount: weekPayments.length,
    });

    weekStart = weekEnd;
    weekNumber++;
  }

  return weeks;
}

function findPeakCollectionDay(payments: FirestorePaymentData[]): {
  date: Date;
  amount: number;
} {
  const dailyTotals: { [key: string]: number } = {};

  for (const payment of payments) {
    if (!payment.date) continue;
    const dateKey = new Date(payment.date).toISOString().split("T")[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + (payment.amount || 0);
  }

  let peakDate = new Date();
  let peakAmount = 0;

  for (const [dateKey, amount] of Object.entries(dailyTotals)) {
    if (amount > peakAmount) {
      peakAmount = amount;
      peakDate = new Date(dateKey);
    }
  }

  return { date: peakDate, amount: peakAmount };
}

// ============================================
// GET OUTSTANDING STUDENTS
// ============================================

export async function getOutstandingStudents(
  schoolId: string,
  minBalance: number = 0,
  classFilter?: string,
): Promise<StudentOutstandingItem[]> {
  const studentsRef = collection(db, "schools", schoolId, "students");
  let studentsQuery = query(studentsRef, where("balance", ">", minBalance));

  if (classFilter) {
    studentsQuery = query(
      studentsRef,
      where("balance", ">", minBalance),
      where("className", "==", classFilter),
    );
  }

  const studentsSnap = await getDocs(studentsQuery);

  return studentsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        studentId: doc.id,
        studentName: data.name || "Unknown",
        admissionNumber: data.studentId || "",
        className: data.className || "",
        totalFees: data.totalFees || 0,
        amountPaid: (data.totalFees || 0) - (data.balance || 0),
        balance: data.balance || 0,
        lastPaymentDate: data.lastPaymentDate?.toDate(),
        parentPhone: data.guardianPhone,
        paymentProgress:
          data.totalFees > 0
            ? ((data.totalFees - data.balance) / data.totalFees) * 100
            : 0,
        arrearsFromPreviousTerm: data.previousBalance || 0,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

// ============================================
// GET SAVED SUMMARIES
// ============================================

export async function getSavedSummaries(
  schoolId: string,
): Promise<TermFinancialSummary[]> {
  const summariesRef = collection(db, "schools", schoolId, "termSummaries");
  const summariesQuery = query(summariesRef, orderBy("generatedAt", "desc"));
  const summariesSnap = await getDocs(summariesQuery);

  return summariesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      generatedAt: data.generatedAt?.toDate() || new Date(),
      periodStart: data.periodStart?.toDate() || new Date(),
      periodEnd: data.periodEnd?.toDate() || new Date(),
      peakCollectionDay: {
        date: data.peakCollectionDay?.date?.toDate() || new Date(),
        amount: data.peakCollectionDay?.amount || 0,
      },
    } as TermFinancialSummary;
  });
}

// ============================================
// MOCK DATA
// ============================================

export function getMockTermSummary(): TermFinancialSummary {
  return {
    id: "summary-001",
    schoolId: "school-001",
    term: "Term 1",
    year: 2024,
    generatedAt: new Date(),
    generatedBy: "user-001",
    status: "draft",
    periodStart: new Date("2024-02-01"),
    periodEnd: new Date("2024-05-31"),
    totalStudents: 450,
    activeStudents: 442,
    boardingStudents: 180,
    dayStudents: 262,
    newEnrollments: 45,
    withdrawals: 8,
    totalExpectedFees: 675000000,
    totalCollected: 532500000,
    totalOutstanding: 142500000,
    collectionRate: 78.9,
    collectionByCategory: [
      {
        categoryId: "1",
        categoryName: "Tuition",
        expectedAmount: 450000000,
        collectedAmount: 382500000,
        outstandingAmount: 67500000,
        collectionRate: 85,
        studentCount: 450,
      },
      {
        categoryId: "2",
        categoryName: "Boarding",
        expectedAmount: 135000000,
        collectedAmount: 108000000,
        outstandingAmount: 27000000,
        collectionRate: 80,
        studentCount: 180,
      },
      {
        categoryId: "3",
        categoryName: "Development",
        expectedAmount: 45000000,
        collectedAmount: 22500000,
        outstandingAmount: 22500000,
        collectionRate: 50,
        studentCount: 300,
      },
      {
        categoryId: "4",
        categoryName: "Exams",
        expectedAmount: 45000000,
        collectedAmount: 19500000,
        outstandingAmount: 25500000,
        collectionRate: 43.3,
        studentCount: 200,
      },
    ],
    collectionByClass: [
      {
        classId: "S6",
        className: "S.6",
        totalStudents: 60,
        expectedAmount: 120000000,
        collectedAmount: 108000000,
        outstandingAmount: 12000000,
        collectionRate: 90,
        fullyPaidCount: 48,
        partiallyPaidCount: 10,
        unpaidCount: 2,
      },
      {
        classId: "S5",
        className: "S.5",
        totalStudents: 65,
        expectedAmount: 130000000,
        collectedAmount: 110500000,
        outstandingAmount: 19500000,
        collectionRate: 85,
        fullyPaidCount: 50,
        partiallyPaidCount: 12,
        unpaidCount: 3,
      },
      {
        classId: "S4",
        className: "S.4",
        totalStudents: 75,
        expectedAmount: 150000000,
        collectedAmount: 120000000,
        outstandingAmount: 30000000,
        collectionRate: 80,
        fullyPaidCount: 52,
        partiallyPaidCount: 18,
        unpaidCount: 5,
      },
      {
        classId: "S3",
        className: "S.3",
        totalStudents: 80,
        expectedAmount: 120000000,
        collectedAmount: 90000000,
        outstandingAmount: 30000000,
        collectionRate: 75,
        fullyPaidCount: 48,
        partiallyPaidCount: 25,
        unpaidCount: 7,
      },
    ],
    collectionByPaymentMethod: [
      {
        method: "MTN Mobile Money",
        transactionCount: 450,
        totalAmount: 266250000,
        percentage: 50,
        averageTransaction: 591667,
      },
      {
        method: "Airtel Money",
        transactionCount: 200,
        totalAmount: 133125000,
        percentage: 25,
        averageTransaction: 665625,
      },
      {
        method: "Bank Transfer",
        transactionCount: 80,
        totalAmount: 106500000,
        percentage: 20,
        averageTransaction: 1331250,
      },
      {
        method: "Cash",
        transactionCount: 50,
        totalAmount: 26625000,
        percentage: 5,
        averageTransaction: 532500,
      },
    ],
    scholarshipSummary: {
      totalScholarships: 25,
      totalBeneficiaries: 25,
      totalAmountAwarded: 37500000,
      fullScholarships: 5,
      partialScholarships: 15,
      bursaries: 3,
      sponsorships: 2,
      bySource: [
        { source: "School Fund", count: 10, amount: 15000000 },
        { source: "Church", count: 8, amount: 12000000 },
        { source: "NGO", count: 5, amount: 7500000 },
        { source: "Individual Donors", count: 2, amount: 3000000 },
      ],
    },
    arrearsSummary: {
      totalArrearsFromPreviousTerm: 45000000,
      arrearsCarriedForward: 31500000,
      arrearsRecovered: 13500000,
      arrearsRecoveryRate: 30,
      studentsWithArrears: 85,
      averageArrearsPerStudent: 529412,
      arrearsAgeBrackets: [
        { bracket: "0-30 days", studentCount: 25, totalAmount: 9000000 },
        { bracket: "31-60 days", studentCount: 22, totalAmount: 11250000 },
        { bracket: "61-90 days", studentCount: 20, totalAmount: 11250000 },
        { bracket: "90+ days", studentCount: 18, totalAmount: 13500000 },
      ],
    },
    clearanceSummary: {
      totalEligible: 442,
      cleared: 350,
      notCleared: 92,
      clearanceRate: 79.2,
      clearedByClass: [
        { className: "S.6", total: 60, cleared: 54, rate: 90 },
        { className: "S.5", total: 65, cleared: 55, rate: 84.6 },
        { className: "S.4", total: 75, cleared: 60, rate: 80 },
        { className: "S.3", total: 80, cleared: 56, rate: 70 },
      ],
    },
    weeklyCollection: [
      {
        weekNumber: 1,
        weekStart: new Date("2024-02-01"),
        weekEnd: new Date("2024-02-08"),
        amount: 85000000,
        transactionCount: 120,
      },
      {
        weekNumber: 2,
        weekStart: new Date("2024-02-08"),
        weekEnd: new Date("2024-02-15"),
        amount: 65000000,
        transactionCount: 95,
      },
      {
        weekNumber: 3,
        weekStart: new Date("2024-02-15"),
        weekEnd: new Date("2024-02-22"),
        amount: 45000000,
        transactionCount: 70,
      },
      {
        weekNumber: 4,
        weekStart: new Date("2024-02-22"),
        weekEnd: new Date("2024-02-29"),
        amount: 35000000,
        transactionCount: 55,
      },
    ],
    dailyAverage: 4437500,
    peakCollectionDay: { date: new Date("2024-02-05"), amount: 28500000 },
  };
}

export function getMockOutstandingStudents(): StudentOutstandingItem[] {
  return [
    {
      studentId: "1",
      studentName: "John Mukasa",
      admissionNumber: "EDU-2024-001",
      className: "S.4",
      totalFees: 1500000,
      amountPaid: 900000,
      balance: 600000,
      lastPaymentDate: new Date("2024-03-15"),
      parentPhone: "+256772456789",
      paymentProgress: 60,
      arrearsFromPreviousTerm: 0,
    },
    {
      studentId: "2",
      studentName: "Sarah Nambi",
      admissionNumber: "EDU-2024-002",
      className: "S.3",
      totalFees: 1500000,
      amountPaid: 750000,
      balance: 750000,
      lastPaymentDate: new Date("2024-02-28"),
      parentPhone: "+256753123456",
      paymentProgress: 50,
      arrearsFromPreviousTerm: 150000,
    },
    {
      studentId: "3",
      studentName: "Peter Okello",
      admissionNumber: "EDU-2024-003",
      className: "S.5",
      totalFees: 1800000,
      amountPaid: 1200000,
      balance: 600000,
      lastPaymentDate: new Date("2024-03-20"),
      parentPhone: "+256789012345",
      paymentProgress: 66.7,
      arrearsFromPreviousTerm: 0,
    },
    {
      studentId: "4",
      studentName: "Grace Apio",
      admissionNumber: "EDU-2024-004",
      className: "S.4",
      totalFees: 1500000,
      amountPaid: 500000,
      balance: 1000000,
      parentPhone: "+256701234567",
      paymentProgress: 33.3,
      arrearsFromPreviousTerm: 250000,
    },
    {
      studentId: "5",
      studentName: "David Ssekandi",
      admissionNumber: "EDU-2024-005",
      className: "S.6",
      totalFees: 2000000,
      amountPaid: 1650000,
      balance: 350000,
      lastPaymentDate: new Date("2024-03-25"),
      parentPhone: "+256778901234",
      paymentProgress: 82.5,
      arrearsFromPreviousTerm: 0,
    },
  ];
}
