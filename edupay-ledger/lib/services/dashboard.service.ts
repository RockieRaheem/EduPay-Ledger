/**
 * Dashboard Service
 *
 * Provides real-time dashboard data including:
 * - Collection statistics
 * - Class/Stream arrears heatmap
 * - Recent activity feed
 * - Installment completion breakdown
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db, initializeFirebase, COLLECTIONS } from "@/lib/firebase";
import { Student, PaymentStatus } from "@/types/student";
import { Payment, PaymentChannel } from "@/types/payment";
import { School, SchoolClass, Stream } from "@/types/school";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  totalCollected: number;
  collectionTarget: number;
  outstanding: number;
  overdue30Days: number;
  collectionProgress: number;
  percentageChange: string;
  totalStudents: number;
  activeStudents: number;
  fullyPaidStudents: number;
  partialStudents: number;
  overdueStudents: number;
  noPaymentStudents: number;
}

export interface HeatmapCell {
  name: string;
  value: number;
  level: "low" | "med" | "high";
  studentCount: number;
}

export interface HeatmapRow {
  class: string;
  classId: string;
  streams: HeatmapCell[];
  totalArrears: number;
}

export interface ActivityItem {
  id: string;
  type: "payment" | "registration" | "alert" | "system";
  title: string;
  description: string;
  time: Date;
  icon: string;
  iconBg: string;
  iconColor: string;
  link?: string;
}

export interface InstallmentStat {
  name: string;
  value: number;
  color: "success" | "primary" | "warning" | "danger";
  percentage: number;
}

export interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapRow[];
  recentActivity: ActivityItem[];
  installmentStats: InstallmentStat[];
  currentTerm?: string;
  academicYear?: string;
  activities?: ActivityItem[];
  isLoading: boolean;
  error?: string;
}

// ============================================================================
// DASHBOARD DATA FETCHING
// ============================================================================

/**
 * Get dashboard statistics for a school
 */
export async function getDashboardStats(
  schoolId: string,
): Promise<DashboardStats> {
  initializeFirebase();

  try {
    // Get school data for collection target
    const schoolRef = doc(db, COLLECTIONS.SCHOOLS, schoolId);
    const schoolDoc = await getDoc(schoolRef);

    let collectionTarget = 0;
    if (schoolDoc.exists()) {
      const school = schoolDoc.data() as School;
      collectionTarget =
        school.feeStructures?.reduce((sum, fs) => sum + fs.totalAmount, 0) || 0;
    }

    // Get all students for this school
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      where("status", "==", "active"),
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    let totalCollected = 0;
    let outstanding = 0;
    let overdue30Days = 0;
    let fullyPaidCount = 0;
    let partialCount = 0;
    let overdueCount = 0;
    let noPaymentCount = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    studentsSnapshot.forEach((doc) => {
      const student = doc.data() as Student;

      totalCollected += student.amountPaid;
      outstanding += student.balance;

      // Recalculate target if we have actual fee data
      if (!collectionTarget && student.totalFees) {
        collectionTarget += student.totalFees;
      }

      // Count by payment status
      switch (student.paymentStatus) {
        case "fully_paid":
          fullyPaidCount++;
          break;
        case "partial":
          partialCount++;
          break;
        case "overdue":
          overdueCount++;
          // Check if overdue within last 30 days
          const hasRecentOverdue = student.installmentProgress?.some((ip) => {
            if (ip.status === "overdue" && ip.deadline) {
              const deadline = ip.deadline.toDate();
              return deadline >= thirtyDaysAgo;
            }
            return false;
          });
          if (hasRecentOverdue) {
            overdue30Days += student.balance;
          }
          break;
        case "no_payment":
          noPaymentCount++;
          overdue30Days += student.balance; // All no-payment is likely overdue
          break;
      }
    });

    const totalStudents = studentsSnapshot.size;
    const collectionProgress =
      collectionTarget > 0 ? (totalCollected / collectionTarget) * 100 : 0;

    // TODO: Calculate actual percentage change from previous term
    const percentageChange = "+12%"; // Placeholder

    return {
      totalCollected,
      collectionTarget,
      outstanding,
      overdue30Days,
      collectionProgress,
      percentageChange,
      totalStudents,
      activeStudents: totalStudents,
      fullyPaidStudents: fullyPaidCount,
      partialStudents: partialCount,
      overdueStudents: overdueCount,
      noPaymentStudents: noPaymentCount,
    };
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    throw error;
  }
}

/**
 * Get class/stream arrears heatmap data
 */
export async function getArrearsHeatmap(
  schoolId: string,
): Promise<HeatmapRow[]> {
  initializeFirebase();

  try {
    // Get school structure
    const schoolRef = doc(db, COLLECTIONS.SCHOOLS, schoolId);
    const schoolDoc = await getDoc(schoolRef);

    if (!schoolDoc.exists()) {
      return [];
    }

    const school = schoolDoc.data() as School;
    const classes = school.classes || [];

    // Get all students
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      where("status", "==", "active"),
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    // Create a map of class -> stream -> arrears
    const arrearsMap: Map<
      string,
      Map<string, { value: number; count: number }>
    > = new Map();

    studentsSnapshot.forEach((doc) => {
      const student = doc.data() as Student;
      const classKey = student.className;
      const streamKey = student.streamName || "Default";

      if (!arrearsMap.has(classKey)) {
        arrearsMap.set(classKey, new Map());
      }

      const classMap = arrearsMap.get(classKey)!;
      if (!classMap.has(streamKey)) {
        classMap.set(streamKey, { value: 0, count: 0 });
      }

      const streamData = classMap.get(streamKey)!;
      streamData.value += student.balance;
      streamData.count += 1;
    });

    // Convert to heatmap rows
    const heatmapRows: HeatmapRow[] = [];

    // Sort classes by their natural order (P.1, P.2, etc. or S.1, S.2, etc.)
    const sortedClasses = Array.from(arrearsMap.keys()).sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, "")) || 0;
      const bNum = parseInt(b.replace(/\D/g, "")) || 0;
      return aNum - bNum;
    });

    for (const className of sortedClasses) {
      const classMap = arrearsMap.get(className)!;
      const streams: HeatmapCell[] = [];
      let totalArrears = 0;

      // Get all streams and sort them
      const sortedStreams = Array.from(classMap.keys()).sort();

      for (const streamName of sortedStreams) {
        const streamData = classMap.get(streamName)!;
        totalArrears += streamData.value;

        streams.push({
          name: streamName,
          value: streamData.value,
          level: getArrearLevel(streamData.value),
          studentCount: streamData.count,
        });
      }

      heatmapRows.push({
        class: className,
        classId: className, // Use className as ID if no explicit ID
        streams,
        totalArrears,
      });
    }

    return heatmapRows;
  } catch (error) {
    console.error("Error getting arrears heatmap:", error);
    throw error;
  }
}

/**
 * Get recent activity feed
 */
export async function getRecentActivity(
  schoolId: string,
  maxItems: number = 10,
): Promise<ActivityItem[]> {
  initializeFirebase();

  try {
    const activities: ActivityItem[] = [];

    // Get recent payments
    const paymentsQuery = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("schoolId", "==", schoolId),
      orderBy("recordedAt", "desc"),
      limit(maxItems),
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);

    paymentsSnapshot.forEach((doc) => {
      const payment = doc.data() as Payment;
      activities.push({
        id: doc.id,
        type: "payment",
        title: `Payment: ${payment.studentName} (${payment.studentClass})`,
        description: `UGX ${payment.amount.toLocaleString()} received via ${getChannelName(payment.channel)}`,
        time: payment.recordedAt.toDate(),
        icon: "check",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600",
        link: `/students/${payment.studentId}`,
      });
    });

    // Get recent student registrations
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc"),
      limit(5),
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    studentsSnapshot.forEach((doc) => {
      const student = doc.data() as Student;
      activities.push({
        id: doc.id,
        type: "registration",
        title: "New Student Registered",
        description: `${student.firstName} ${student.lastName} joined ${student.className}${student.streamName ? ` - ${student.streamName}` : ""}`,
        time: student.createdAt.toDate(),
        icon: "person",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600",
        link: `/students/${doc.id}`,
      });
    });

    // Sort by time (most recent first)
    activities.sort((a, b) => b.time.getTime() - a.time.getTime());

    return activities.slice(0, maxItems);
  } catch (error) {
    console.error("Error getting recent activity:", error);
    throw error;
  }
}

/**
 * Get installment completion breakdown
 */
export async function getInstallmentStats(
  schoolId: string,
): Promise<InstallmentStat[]> {
  initializeFirebase();

  try {
    // Get all active students
    const studentsQuery = query(
      collection(db, COLLECTIONS.STUDENTS),
      where("schoolId", "==", schoolId),
      where("status", "==", "active"),
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    let fullyPaid = 0;
    let installment3 = 0; // 75%+
    let installment2 = 0; // 50-74%
    let installment1 = 0; // 25-49%
    let noPayment = 0; // 0-24%

    studentsSnapshot.forEach((doc) => {
      const student = doc.data() as Student;
      const progressPercent =
        student.totalFees > 0
          ? (student.amountPaid / student.totalFees) * 100
          : 0;

      if (progressPercent >= 100) {
        fullyPaid++;
      } else if (progressPercent >= 75) {
        installment3++;
      } else if (progressPercent >= 50) {
        installment2++;
      } else if (progressPercent >= 25) {
        installment1++;
      } else {
        noPayment++;
      }
    });

    const total = studentsSnapshot.size || 1; // Prevent division by zero

    return [
      {
        name: "Fully Paid (100%)",
        value: fullyPaid,
        color: "success",
        percentage: Math.round((fullyPaid / total) * 100),
      },
      {
        name: "Installment 3 (75%+)",
        value: installment3,
        color: "primary",
        percentage: Math.round((installment3 / total) * 100),
      },
      {
        name: "Installment 2 (50%+)",
        value: installment2,
        color: "warning",
        percentage: Math.round((installment2 / total) * 100),
      },
      {
        name: "Below 50% / None",
        value: installment1 + noPayment,
        color: "danger",
        percentage: Math.round(((installment1 + noPayment) / total) * 100),
      },
    ];
  } catch (error) {
    console.error("Error getting installment stats:", error);
    throw error;
  }
}

/**
 * Get all dashboard data in one call
 */
export async function getDashboardData(
  schoolId: string,
): Promise<DashboardData> {
  try {
    const [stats, heatmap, recentActivity, installmentStats] =
      await Promise.all([
        getDashboardStats(schoolId),
        getArrearsHeatmap(schoolId),
        getRecentActivity(schoolId),
        getInstallmentStats(schoolId),
      ]);

    return {
      stats,
      heatmap,
      recentActivity,
      installmentStats,
      isLoading: false,
    };
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return {
      stats: getEmptyStats(),
      heatmap: [],
      recentActivity: [],
      installmentStats: [],
      isLoading: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data",
    };
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to real-time dashboard updates
 */
export function subscribeToDashboard(
  schoolId: string,
  onUpdate: (data: DashboardData) => void,
): () => void {
  initializeFirebase();

  // Subscribe to students collection for real-time stats updates
  const studentsQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );

  const unsubscribe = onSnapshot(studentsQuery, async () => {
    // Refetch all dashboard data when students change
    const data = await getDashboardData(schoolId);
    onUpdate(data);
  });

  // Initial fetch
  getDashboardData(schoolId).then(onUpdate);

  return unsubscribe;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getArrearLevel(amount: number): "low" | "med" | "high" {
  if (amount >= 5000000) return "high"; // 5M+ UGX
  if (amount >= 2000000) return "med"; // 2M-5M UGX
  return "low"; // Below 2M UGX
}

function getChannelName(channel: PaymentChannel): string {
  const names: Record<PaymentChannel, string> = {
    momo_mtn: "MTN MoMo",
    momo_airtel: "Airtel Money",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    cheque: "Cheque",
    other: "Other",
  };
  return names[channel] || channel;
}

function getEmptyStats(): DashboardStats {
  return {
    totalCollected: 0,
    collectionTarget: 0,
    outstanding: 0,
    overdue30Days: 0,
    collectionProgress: 0,
    percentageChange: "0%",
    totalStudents: 0,
    activeStudents: 0,
    fullyPaidStudents: 0,
    partialStudents: 0,
    overdueStudents: 0,
    noPaymentStudents: 0,
  };
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

export function getMockDashboardData(): DashboardData {
  return {
    stats: {
      totalCollected: 450500000,
      collectionTarget: 600000000,
      outstanding: 149500000,
      overdue30Days: 42100000,
      collectionProgress: 75.1,
      percentageChange: "+12%",
      totalStudents: 942,
      activeStudents: 942,
      fullyPaidStudents: 420,
      partialStudents: 430,
      overdueStudents: 50,
      noPaymentStudents: 42,
    },
    heatmap: [
      {
        class: "P.1",
        classId: "p1",
        totalArrears: 3600000,
        streams: [
          { name: "A", value: 500000, level: "low", studentCount: 32 },
          { name: "B", value: 2100000, level: "med", studentCount: 28 },
          { name: "C", value: 800000, level: "low", studentCount: 30 },
          { name: "D", value: 200000, level: "low", studentCount: 35 },
        ],
      },
      {
        class: "P.2",
        classId: "p2",
        totalArrears: 14000000,
        streams: [
          { name: "A", value: 8400000, level: "high", studentCount: 27 },
          { name: "B", value: 1200000, level: "low", studentCount: 33 },
          { name: "C", value: 3500000, level: "med", studentCount: 29 },
          { name: "D", value: 900000, level: "low", studentCount: 31 },
        ],
      },
      {
        class: "P.3",
        classId: "p3",
        totalArrears: 18500000,
        streams: [
          { name: "A", value: 1100000, level: "low", studentCount: 34 },
          { name: "B", value: 400000, level: "low", studentCount: 30 },
          { name: "C", value: 12200000, level: "high", studentCount: 26 },
          { name: "D", value: 4800000, level: "med", studentCount: 32 },
        ],
      },
      {
        class: "P.4",
        classId: "p4",
        totalArrears: 7700000,
        streams: [
          { name: "A", value: 2500000, level: "med", studentCount: 30 },
          { name: "B", value: 3000000, level: "med", studentCount: 28 },
          { name: "C", value: 700000, level: "low", studentCount: 35 },
          { name: "D", value: 1500000, level: "low", studentCount: 29 },
        ],
      },
      {
        class: "P.5",
        classId: "p5",
        totalArrears: 6200000,
        streams: [
          { name: "A", value: 1800000, level: "low", studentCount: 31 },
          { name: "B", value: 2200000, level: "med", studentCount: 27 },
          { name: "C", value: 1400000, level: "low", studentCount: 33 },
          { name: "D", value: 800000, level: "low", studentCount: 30 },
        ],
      },
      {
        class: "P.6",
        classId: "p6",
        totalArrears: 9100000,
        streams: [
          { name: "A", value: 3200000, level: "med", studentCount: 29 },
          { name: "B", value: 1500000, level: "low", studentCount: 32 },
          { name: "C", value: 2800000, level: "med", studentCount: 28 },
          { name: "D", value: 1600000, level: "low", studentCount: 34 },
        ],
      },
      {
        class: "P.7",
        classId: "p7",
        totalArrears: 5400000,
        streams: [
          { name: "A", value: 900000, level: "low", studentCount: 33 },
          { name: "B", value: 1700000, level: "low", studentCount: 30 },
          { name: "C", value: 1200000, level: "low", studentCount: 31 },
          { name: "D", value: 1600000, level: "low", studentCount: 29 },
        ],
      },
    ],
    recentActivity: [
      {
        id: "1",
        type: "payment",
        title: "Payment: Peter Mukasa (P.4)",
        description: "UGX 1,200,000 received via MTN MoMo",
        time: new Date(Date.now() - 2 * 60000),
        icon: "check",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600",
        link: "/students/1",
      },
      {
        id: "2",
        type: "registration",
        title: "New Student Registered",
        description: "Jane Namugenyi joined Primary 1 - Stream B",
        time: new Date(Date.now() - 45 * 60000),
        icon: "person",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600",
        link: "/students/2",
      },
      {
        id: "3",
        type: "payment",
        title: "Payment: Kevin Okello (P.7)",
        description: "UGX 850,000 received via Bank Transfer",
        time: new Date(Date.now() - 2 * 3600000),
        icon: "check",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600",
        link: "/students/3",
      },
      {
        id: "4",
        type: "alert",
        title: "Arrears Alert: Primary 2",
        description: "Stream A has exceeded the 20% arrears threshold",
        time: new Date(Date.now() - 3 * 3600000),
        icon: "priority_high",
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-600",
      },
      {
        id: "5",
        type: "payment",
        title: "Payment: Sarah Namukasa (P.3)",
        description: "UGX 500,000 received via Airtel Money",
        time: new Date(Date.now() - 5 * 3600000),
        icon: "check",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600",
        link: "/students/5",
      },
      {
        id: "6",
        type: "registration",
        title: "New Student Registered",
        description: "David Ssempijja joined Primary 6 - Stream A",
        time: new Date(Date.now() - 8 * 3600000),
        icon: "person",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600",
        link: "/students/6",
      },
    ],
    installmentStats: [
      {
        name: "Fully Paid (100%)",
        value: 420,
        color: "success",
        percentage: 45,
      },
      {
        name: "Installment 3 (75%+)",
        value: 280,
        color: "primary",
        percentage: 30,
      },
      {
        name: "Installment 2 (50%+)",
        value: 150,
        color: "warning",
        percentage: 16,
      },
      { name: "Below 50% / None", value: 92, color: "danger", percentage: 10 },
    ],
    isLoading: false,
  };
}
