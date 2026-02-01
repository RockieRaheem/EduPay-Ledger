/**
 * Dashboard Firebase Service
 * Handles all dashboard-related data operations for EduPay Ledger
 */

import {
  db,
  fetchCollection,
  subscribeToCollection,
  COLLECTIONS,
} from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  sum,
  getAggregateFromServer,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import type { Payment } from "@/types/payment";
import type { Student } from "@/types/student";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
  // Financial
  totalCollected: number;
  totalExpected: number;
  collectionRate: number;
  todayCollections: number;
  weekCollections: number;
  monthCollections: number;

  // Student metrics
  totalStudents: number;
  activeStudents: number;
  studentsWithArrears: number;
  totalArrears: number;

  // Transaction metrics
  transactionCount: number;
  averagePayment: number;
  pendingTransactions: number;
}

export interface DashboardChartData {
  weeklyTrend: { day: string; amount: number }[];
  monthlyTrend: { month: string; amount: number }[];
  paymentChannels: { channel: string; amount: number; count: number }[];
  classDistribution: {
    className: string;
    collected: number;
    arrears: number;
  }[];
}

export interface RecentActivity {
  id: string;
  type: "payment" | "student" | "refund" | "alert";
  title: string;
  description: string;
  timestamp: Date;
  amount?: number;
  status?: string;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

/**
 * Get comprehensive dashboard statistics
 */
export async function getDashboardStats(
  schoolId: string,
  termId?: string,
): Promise<DashboardStats> {
  const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // Base payment constraints
  const paymentBaseConstraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    where("status", "==", "completed"),
  ];

  if (termId) {
    paymentBaseConstraints.push(where("termId", "==", termId));
  }

  // Total collected
  const totalQuery = query(paymentsRef, ...paymentBaseConstraints);
  const totalSnapshot = await getAggregateFromServer(totalQuery, {
    total: sum("amount"),
  });

  // Today's collections
  const todayQuery = query(
    paymentsRef,
    ...paymentBaseConstraints,
    where("createdAt", ">=", Timestamp.fromDate(today)),
  );
  const todaySnapshot = await getAggregateFromServer(todayQuery, {
    total: sum("amount"),
  });

  // This week's collections
  const weekQuery = query(
    paymentsRef,
    ...paymentBaseConstraints,
    where("createdAt", ">=", Timestamp.fromDate(weekAgo)),
  );
  const weekSnapshot = await getAggregateFromServer(weekQuery, {
    total: sum("amount"),
  });

  // This month's collections
  const monthQuery = query(
    paymentsRef,
    ...paymentBaseConstraints,
    where("createdAt", ">=", Timestamp.fromDate(monthAgo)),
  );
  const monthSnapshot = await getAggregateFromServer(monthQuery, {
    total: sum("amount"),
  });

  // Transaction count
  const countQuery = query(paymentsRef, ...paymentBaseConstraints);
  const countSnapshot = await getCountFromServer(countQuery);

  // Pending transactions
  const pendingQuery = query(
    paymentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "pending"),
  );
  const pendingSnapshot = await getCountFromServer(pendingQuery);

  // Student stats
  const totalStudentsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
  );
  const totalStudentsSnapshot = await getCountFromServer(totalStudentsQuery);

  const activeStudentsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );
  const activeStudentsSnapshot = await getCountFromServer(activeStudentsQuery);

  const arrearsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
  );
  const arrearsCountSnapshot = await getCountFromServer(arrearsQuery);
  const arrearsTotalSnapshot = await getAggregateFromServer(arrearsQuery, {
    total: sum("balance"),
  });

  const totalCollected = totalSnapshot.data().total || 0;
  const transactionCount = countSnapshot.data().count;

  return {
    totalCollected,
    totalExpected: 0, // Would come from fee structures
    collectionRate: 0, // Would need expected to calculate
    todayCollections: todaySnapshot.data().total || 0,
    weekCollections: weekSnapshot.data().total || 0,
    monthCollections: monthSnapshot.data().total || 0,
    totalStudents: totalStudentsSnapshot.data().count,
    activeStudents: activeStudentsSnapshot.data().count,
    studentsWithArrears: arrearsCountSnapshot.data().count,
    totalArrears: arrearsTotalSnapshot.data().total || 0,
    transactionCount,
    averagePayment:
      transactionCount > 0 ? totalCollected / transactionCount : 0,
    pendingTransactions: pendingSnapshot.data().count,
  };
}

// ============================================================================
// CHART DATA
// ============================================================================

/**
 * Get weekly collection trend data
 */
export async function getWeeklyTrend(
  schoolId: string,
): Promise<{ day: string; amount: number }[]> {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const payments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
    where("recordedAt", ">=", Timestamp.fromDate(weekAgo)),
    orderBy("recordedAt", "asc"),
  ]);

  // Initialize all days with 0
  const dailyTotals: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = days[date.getDay()];
    dailyTotals[dayName] = 0;
  }

  // Sum payments by day
  payments.forEach((payment) => {
    const date = payment.recordedAt.toDate();
    const dayName = days[date.getDay()];
    dailyTotals[dayName] += payment.amount;
  });

  return Object.entries(dailyTotals).map(([day, amount]) => ({
    day,
    amount,
  }));
}

/**
 * Get monthly collection trend data
 */
export async function getMonthlyTrend(
  schoolId: string,
  months: number = 6,
): Promise<{ month: string; amount: number }[]> {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const payments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
    where("recordedAt", ">=", Timestamp.fromDate(startDate)),
    orderBy("recordedAt", "asc"),
  ]);

  // Initialize months with 0
  const monthlyTotals: Record<string, number> = {};
  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - 1 - i));
    const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    monthlyTotals[monthKey] = 0;
  }

  // Sum payments by month
  payments.forEach((payment) => {
    const date = payment.recordedAt.toDate();
    const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    if (monthlyTotals.hasOwnProperty(monthKey)) {
      monthlyTotals[monthKey] += payment.amount;
    }
  });

  return Object.entries(monthlyTotals).map(([month, amount]) => ({
    month,
    amount,
  }));
}

/**
 * Get payment method distribution
 */
export async function getPaymentChannelDistribution(
  schoolId: string,
  termId?: string,
): Promise<{ channel: string; amount: number; count: number }[]> {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
  ];

  const payments = await fetchCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    constraints,
  );

  const channelTotals: Record<string, { amount: number; count: number }> = {};

  payments.forEach((payment) => {
    if (!channelTotals[payment.channel]) {
      channelTotals[payment.channel] = { amount: 0, count: 0 };
    }
    channelTotals[payment.channel].amount += payment.amount;
    channelTotals[payment.channel].count++;
  });

  const channelLabels: Record<string, string> = {
    cash: "Cash",
    mobile_money: "Mobile Money",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
  };

  return Object.entries(channelTotals).map(([channel, data]) => ({
    channel: channelLabels[channel] || channel,
    amount: data.amount,
    count: data.count,
  }));
}

// ============================================================================
// RECENT ACTIVITY
// ============================================================================

/**
 * Get recent activity feed
 */
export async function getRecentActivity(
  schoolId: string,
  limit_count: number = 20,
): Promise<RecentActivity[]> {
  // Get recent payments
  const payments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("schoolId", "==", schoolId),
    orderBy("recordedAt", "desc"),
    limit(limit_count),
  ]);

  const activities: RecentActivity[] = payments.map((payment) => ({
    id: payment.id,
    type: payment.status === "reversed" ? "refund" : "payment",
    title:
      payment.status === "reversed" ? "Payment Reversed" : "Payment Received",
    description: `${payment.studentName} - ${payment.channel.replace("_", " ")}`,
    timestamp: payment.recordedAt.toDate(),
    amount: payment.amount,
    status: payment.status,
  }));

  return activities.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  );
}

/**
 * Subscribe to real-time activity feed
 */
export function subscribeToRecentActivity(
  schoolId: string,
  onData: (activities: RecentActivity[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    [
      where("schoolId", "==", schoolId),
      orderBy("recordedAt", "desc"),
      limit(20),
    ],
    (payments) => {
      const activities: RecentActivity[] = payments.map((payment) => ({
        id: payment.id,
        type: payment.status === "reversed" ? "refund" : "payment",
        title:
          payment.status === "reversed"
            ? "Payment Reversed"
            : "Payment Received",
        description: `${payment.studentName} - ${payment.channel.replace("_", " ")}`,
        timestamp: payment.recordedAt.toDate(),
        amount: payment.amount,
        status: payment.status,
      }));

      onData(activities);
    },
    onError,
  );
}

// ============================================================================
// QUICK STATS
// ============================================================================

/**
 * Get quick stats for dashboard cards
 */
export async function getQuickStats(schoolId: string): Promise<{
  collections: {
    today: number;
    yesterday: number;
    change: number;
  };
  students: {
    total: number;
    newThisWeek: number;
    withArrears: number;
  };
  arrears: {
    total: number;
    critical: number; // > 500,000 UGX
    recovered: number; // This month
  };
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthStart = new Date(today);
  monthStart.setDate(1);

  const paymentsRef = collection(db, COLLECTIONS.PAYMENTS);
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);

  // Today's collections
  const todayQuery = query(
    paymentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "completed"),
    where("createdAt", ">=", Timestamp.fromDate(today)),
  );
  const todaySnapshot = await getAggregateFromServer(todayQuery, {
    total: sum("amount"),
  });

  // Yesterday's collections
  const yesterdayQuery = query(
    paymentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "completed"),
    where("createdAt", ">=", Timestamp.fromDate(yesterday)),
    where("createdAt", "<", Timestamp.fromDate(today)),
  );
  const yesterdaySnapshot = await getAggregateFromServer(yesterdayQuery, {
    total: sum("amount"),
  });

  // Total students
  const totalStudentsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );
  const totalStudentsSnapshot = await getCountFromServer(totalStudentsQuery);

  // New students this week
  const newStudentsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("createdAt", ">=", Timestamp.fromDate(weekAgo)),
  );
  const newStudentsSnapshot = await getCountFromServer(newStudentsQuery);

  // Students with arrears
  const arrearsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
  );
  const arrearsCountSnapshot = await getCountFromServer(arrearsQuery);
  const arrearsTotalSnapshot = await getAggregateFromServer(arrearsQuery, {
    total: sum("balance"),
  });

  // Critical arrears (> 500,000 UGX)
  const criticalQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("balance", ">", 500000),
  );
  const criticalSnapshot = await getCountFromServer(criticalQuery);

  const todayTotal = todaySnapshot.data().total || 0;
  const yesterdayTotal = yesterdaySnapshot.data().total || 0;
  const change =
    yesterdayTotal > 0
      ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
      : todayTotal > 0
        ? 100
        : 0;

  return {
    collections: {
      today: todayTotal,
      yesterday: yesterdayTotal,
      change,
    },
    students: {
      total: totalStudentsSnapshot.data().count,
      newThisWeek: newStudentsSnapshot.data().count,
      withArrears: arrearsCountSnapshot.data().count,
    },
    arrears: {
      total: arrearsTotalSnapshot.data().total || 0,
      critical: criticalSnapshot.data().count,
      recovered: 0, // Would need payment tracking for debt recovery
    },
  };
}

// ============================================================================
// ALERTS
// ============================================================================

export interface DashboardAlert {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
  createdAt: Date;
}

/**
 * Get dashboard alerts
 */
export async function getDashboardAlerts(
  schoolId: string,
): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = [];
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);

  // Check for critical arrears
  const criticalQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("balance", ">", 500000),
  );
  const criticalSnapshot = await getCountFromServer(criticalQuery);

  if (criticalSnapshot.data().count > 0) {
    alerts.push({
      id: "critical-overdue",
      type: "error",
      title: "Critical Overdue Alert",
      message: `${criticalSnapshot.data().count} students have overdue balances exceeding UGX 500,000`,
      actionLabel: "View Students",
      actionPath: "/overdue",
      createdAt: new Date(),
    });
  }

  // Check for pending payments
  const pendingQuery = query(
    collection(db, COLLECTIONS.PAYMENTS),
    where("schoolId", "==", schoolId),
    where("status", "==", "pending"),
  );
  const pendingSnapshot = await getCountFromServer(pendingQuery);

  if (pendingSnapshot.data().count > 0) {
    alerts.push({
      id: "pending-payments",
      type: "warning",
      title: "Pending Payments",
      message: `${pendingSnapshot.data().count} payments are awaiting confirmation`,
      actionLabel: "Review Payments",
      actionPath: "/payments",
      createdAt: new Date(),
    });
  }

  return alerts;
}
