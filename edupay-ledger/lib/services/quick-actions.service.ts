/**
 * Quick Actions Service
 * Backend service for quick action dashboard data
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  DailySummary,
  PendingTask,
  DashboardAlert,
  DashboardConfig,
  PinnedItem,
  QuickSearchResult,
  sortTasksByPriority,
} from "../../types/quick-actions";

// ============================================
// DAILY SUMMARY
// ============================================

export async function getDailySummary(
  schoolId: string,
  date?: Date,
): Promise<DailySummary> {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get today's payments
  const paymentsRef = collection(db, "schools", schoolId, "payments");
  const paymentsQuery = query(
    paymentsRef,
    where("date", ">=", Timestamp.fromDate(startOfDay)),
    where("date", "<=", Timestamp.fromDate(endOfDay)),
    where("status", "==", "completed"),
  );
  const paymentsSnap = await getDocs(paymentsQuery);

  let totalCollected = 0;
  const methodTotals: { [key: string]: { amount: number; count: number } } = {};
  const recentPayments: DailySummary["recentPayments"] = [];

  paymentsSnap.docs.forEach((doc) => {
    const data = doc.data();
    totalCollected += data.amount;

    const method = data.paymentMethod || "Cash";
    if (!methodTotals[method]) {
      methodTotals[method] = { amount: 0, count: 0 };
    }
    methodTotals[method].amount += data.amount;
    methodTotals[method].count += 1;

    recentPayments.push({
      id: doc.id,
      studentName: data.studentName || "Unknown",
      amount: data.amount,
      time: data.date?.toDate() || new Date(),
      method: method,
    });
  });

  // Get pending promises
  const promisesRef = collection(db, "schools", schoolId, "paymentPromises");
  const promisesQuery = query(
    promisesRef,
    where("status", "in", ["pending", "due"]),
  );
  const promisesSnap = await getDocs(promisesQuery);

  // Get overdue accounts
  const studentsRef = collection(db, "schools", schoolId, "students");
  const overdueQuery = query(studentsRef, where("balance", ">", 0));
  const overdueSnap = await getDocs(overdueQuery);

  // Get cleared students today
  const clearanceRef = collection(db, "schools", schoolId, "clearances");
  const clearanceQuery = query(
    clearanceRef,
    where("clearedAt", ">=", Timestamp.fromDate(startOfDay)),
    where("clearedAt", "<=", Timestamp.fromDate(endOfDay)),
  );
  const clearanceSnap = await getDocs(clearanceQuery);

  // Convert method totals to array
  const topPaymentMethods = Object.entries(methodTotals)
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Sort recent payments by time (most recent first)
  recentPayments.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );

  return {
    date: targetDate,
    totalCollected,
    transactionCount: paymentsSnap.size,
    pendingPromises: promisesSnap.size,
    overdueAccounts: overdueSnap.size,
    studentsCleared: clearanceSnap.size,
    topPaymentMethods,
    recentPayments: recentPayments.slice(0, 5),
  };
}

// ============================================
// PENDING TASKS
// ============================================

export async function getPendingTasks(
  schoolId: string,
): Promise<PendingTask[]> {
  const tasks: PendingTask[] = [];
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get due promises
  const promisesRef = collection(db, "schools", schoolId, "paymentPromises");
  const promisesQuery = query(
    promisesRef,
    where("dueDate", "<=", Timestamp.fromDate(nextWeek)),
    where("status", "in", ["pending", "due"]),
  );
  const promisesSnap = await getDocs(promisesQuery);

  promisesSnap.docs.forEach((doc) => {
    const data = doc.data();
    const dueDate = data.dueDate?.toDate() || new Date();
    const isOverdue = dueDate < today;

    tasks.push({
      id: `promise-${doc.id}`,
      type: "promise_due",
      title: `Payment promise: ${data.studentName || "Student"}`,
      description: `UGX ${(data.promisedAmount || 0).toLocaleString()} due`,
      priority: isOverdue ? "urgent" : "high",
      dueDate,
      relatedId: doc.id,
      relatedType: "promise",
      action: {
        label: "View Promise",
        href: `/promises/${doc.id}`,
      },
    });
  });

  // Get pending follow-ups
  const followUpsRef = collection(db, "schools", schoolId, "followUps");
  const followUpsQuery = query(
    followUpsRef,
    where("scheduledDate", "<=", Timestamp.fromDate(nextWeek)),
    where("status", "==", "scheduled"),
  );
  const followUpsSnap = await getDocs(followUpsQuery);

  followUpsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const scheduledDate = data.scheduledDate?.toDate() || new Date();

    tasks.push({
      id: `followup-${doc.id}`,
      type: "follow_up",
      title: `Follow up: ${data.studentName || "Student"}`,
      description: data.notes || "Follow up required",
      priority: "medium",
      dueDate: scheduledDate,
      relatedId: data.promiseId,
      relatedType: "promise",
      action: {
        label: "Complete Follow-up",
        href: `/promises/${data.promiseId}`,
      },
    });
  });

  // Get pending clearance requests
  const clearanceRequestsRef = collection(
    db,
    "schools",
    schoolId,
    "clearanceRequests",
  );
  const clearanceQuery = query(
    clearanceRequestsRef,
    where("status", "==", "pending"),
  );
  const clearanceSnap = await getDocs(clearanceQuery);

  clearanceSnap.docs.forEach((doc) => {
    const data = doc.data();
    tasks.push({
      id: `clearance-${doc.id}`,
      type: "clearance_request",
      title: `Clearance request: ${data.studentName || "Student"}`,
      description: `${data.className || "Class"} - Balance: UGX ${(data.balance || 0).toLocaleString()}`,
      priority: "medium",
      dueDate: data.requestedAt?.toDate() || new Date(),
      relatedId: data.studentId,
      relatedType: "student",
      action: {
        label: "Review",
        href: `/students/${data.studentId}?tab=clearance`,
      },
    });
  });

  return sortTasksByPriority(tasks);
}

// ============================================
// DASHBOARD ALERTS
// ============================================

export async function getDashboardAlerts(
  schoolId: string,
): Promise<DashboardAlert[]> {
  const alertsRef = collection(db, "schools", schoolId, "alerts");
  const alertsQuery = query(
    alertsRef,
    where("isActive", "==", true),
    orderBy("createdAt", "desc"),
    limit(10),
  );
  const alertsSnap = await getDocs(alertsQuery);

  return alertsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type || "info",
      title: data.title || "",
      message: data.message || "",
      createdAt: data.createdAt?.toDate() || new Date(),
      isRead: data.isRead || false,
      action: data.action,
      expiresAt: data.expiresAt?.toDate(),
    };
  });
}

export async function markAlertRead(
  schoolId: string,
  alertId: string,
): Promise<void> {
  const alertRef = doc(db, "schools", schoolId, "alerts", alertId);
  await updateDoc(alertRef, { isRead: true });
}

export async function dismissAlert(
  schoolId: string,
  alertId: string,
): Promise<void> {
  const alertRef = doc(db, "schools", schoolId, "alerts", alertId);
  await updateDoc(alertRef, { isActive: false, dismissedAt: Timestamp.now() });
}

// ============================================
// DASHBOARD CONFIGURATION
// ============================================

export async function getDashboardConfig(
  userId: string,
): Promise<DashboardConfig> {
  const configRef = doc(db, "userConfigs", userId, "dashboard", "settings");
  const configSnap = await getDoc(configRef);

  if (configSnap.exists()) {
    return configSnap.data() as DashboardConfig;
  }

  // Return default config
  return {
    userId,
    layout: "default",
    showDailySummary: true,
    showPendingTasks: true,
    showRecentPayments: true,
    showAlerts: true,
    pinnedActions: [
      "record-payment",
      "view-arrears",
      "send-reminder",
      "clear-student",
    ],
    quickAccessItems: [],
    refreshInterval: 60,
  };
}

export async function updateDashboardConfig(
  userId: string,
  updates: Partial<DashboardConfig>,
): Promise<void> {
  const configRef = doc(db, "userConfigs", userId, "dashboard", "settings");
  await setDoc(configRef, { ...updates, userId }, { merge: true });
}

export async function pinAction(
  userId: string,
  actionId: string,
): Promise<void> {
  const config = await getDashboardConfig(userId);
  if (!config.pinnedActions.includes(actionId)) {
    config.pinnedActions.push(actionId);
    await updateDashboardConfig(userId, {
      pinnedActions: config.pinnedActions,
    });
  }
}

export async function unpinAction(
  userId: string,
  actionId: string,
): Promise<void> {
  const config = await getDashboardConfig(userId);
  config.pinnedActions = config.pinnedActions.filter((id) => id !== actionId);
  await updateDashboardConfig(userId, { pinnedActions: config.pinnedActions });
}

// ============================================
// QUICK SEARCH
// ============================================

interface PaymentData {
  reference?: string;
  receiptNumber?: string;
  amount?: number;
  studentName?: string;
}

interface StudentData {
  name?: string;
  studentId?: string;
  className?: string;
}

export async function quickSearch(
  schoolId: string,
  searchQuery: string,
): Promise<QuickSearchResult[]> {
  const results: QuickSearchResult[] = [];
  const searchLower = searchQuery.toLowerCase();

  // Search students
  const studentsRef = collection(db, "schools", schoolId, "students");
  const studentsSnap = await getDocs(studentsRef);

  studentsSnap.docs.forEach((doc) => {
    const data = doc.data() as StudentData;
    const name = (data.name || "").toLowerCase();
    const studentId = (data.studentId || "").toLowerCase();

    if (name.includes(searchLower) || studentId.includes(searchLower)) {
      results.push({
        id: doc.id,
        type: "student",
        title: data.name || "Unknown",
        subtitle: `${data.className || ""} - ${data.studentId || ""}`,
        href: `/students/${doc.id}`,
        highlight: name.includes(searchLower) ? data.name : data.studentId,
      });
    }
  });

  // Search payments by reference
  const paymentsRef = collection(db, "schools", schoolId, "payments");
  const paymentsSnap = await getDocs(query(paymentsRef, limit(50)));

  paymentsSnap.docs.forEach((doc) => {
    const data = doc.data() as PaymentData;
    const reference = (data.reference || "").toLowerCase();
    const receiptNumber = (data.receiptNumber || "").toLowerCase();

    if (
      reference.includes(searchLower) ||
      receiptNumber.includes(searchLower)
    ) {
      results.push({
        id: doc.id,
        type: "payment",
        title: `Payment: UGX ${(data.amount || 0).toLocaleString()}`,
        subtitle: `${data.studentName || ""} - ${data.receiptNumber || data.reference}`,
        href: `/payments/${doc.id}`,
        highlight: reference.includes(searchLower)
          ? data.reference
          : data.receiptNumber,
      });
    }
  });

  return results.slice(0, 10);
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export function subscribeToDailySummary(
  schoolId: string,
  callback: (summary: DailySummary) => void,
): () => void {
  // For real-time updates, we'd listen to the payments collection
  // This is a simplified version that polls
  const interval = setInterval(async () => {
    const summary = await getDailySummary(schoolId);
    callback(summary);
  }, 30000); // Update every 30 seconds

  // Initial fetch
  getDailySummary(schoolId).then(callback);

  return () => clearInterval(interval);
}

export function subscribeToPendingTasks(
  schoolId: string,
  callback: (tasks: PendingTask[]) => void,
): () => void {
  // Listen to promises collection
  const promisesRef = collection(db, "schools", schoolId, "paymentPromises");
  const promisesQuery = query(
    promisesRef,
    where("status", "in", ["pending", "due"]),
  );

  return onSnapshot(promisesQuery, async () => {
    const tasks = await getPendingTasks(schoolId);
    callback(tasks);
  });
}

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

export function getMockDailySummary(): DailySummary {
  return {
    date: new Date(),
    totalCollected: 4750000,
    transactionCount: 12,
    pendingPromises: 8,
    overdueAccounts: 45,
    studentsCleared: 5,
    topPaymentMethods: [
      { method: "MTN Mobile Money", amount: 2500000, count: 6 },
      { method: "Airtel Money", amount: 1250000, count: 3 },
      { method: "Bank Transfer", amount: 750000, count: 2 },
      { method: "Cash", amount: 250000, count: 1 },
    ],
    recentPayments: [
      {
        id: "1",
        studentName: "John Mukasa",
        amount: 500000,
        time: new Date(Date.now() - 15 * 60000),
        method: "MTN Mobile Money",
      },
      {
        id: "2",
        studentName: "Sarah Nambi",
        amount: 350000,
        time: new Date(Date.now() - 45 * 60000),
        method: "Airtel Money",
      },
      {
        id: "3",
        studentName: "Peter Okello",
        amount: 750000,
        time: new Date(Date.now() - 90 * 60000),
        method: "Bank Transfer",
      },
      {
        id: "4",
        studentName: "Grace Apio",
        amount: 425000,
        time: new Date(Date.now() - 150 * 60000),
        method: "MTN Mobile Money",
      },
      {
        id: "5",
        studentName: "David Ssekandi",
        amount: 600000,
        time: new Date(Date.now() - 200 * 60000),
        method: "Cash",
      },
    ],
  };
}

export function getMockPendingTasks(): PendingTask[] {
  const today = new Date();
  return [
    {
      id: "1",
      type: "promise_due",
      title: "Payment promise: John Mukasa",
      description: "UGX 300,000 due today",
      priority: "urgent",
      dueDate: today,
      relatedId: "promise-001",
      relatedType: "promise",
      action: { label: "View Promise", href: "/promises/001" },
    },
    {
      id: "2",
      type: "clearance_request",
      title: "Clearance request: Sarah Nambi",
      description: "S.4 Blue - Balance: UGX 150,000",
      priority: "high",
      dueDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      relatedId: "student-002",
      relatedType: "student",
      action: { label: "Review", href: "/students/002?tab=clearance" },
    },
    {
      id: "3",
      type: "follow_up",
      title: "Follow up: Peter Okello",
      description: "Parent requested callback about payment plan",
      priority: "medium",
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      relatedId: "promise-003",
      relatedType: "promise",
      action: { label: "Complete Follow-up", href: "/promises/003" },
    },
    {
      id: "4",
      type: "report_due",
      title: "Weekly collection report",
      description: "Generate and submit weekly report",
      priority: "medium",
      dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      action: { label: "Generate Report", href: "/reports/weekly" },
    },
    {
      id: "5",
      type: "reconciliation",
      title: "Bank reconciliation pending",
      description: "15 unmatched transactions",
      priority: "low",
      dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      action: { label: "Reconcile", href: "/reconciliation" },
    },
  ];
}

export function getMockAlerts(): DashboardAlert[] {
  return [
    {
      id: "1",
      type: "warning",
      title: "High Overdue Alert",
      message: "45 students have balances exceeding UGX 500,000",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      isRead: false,
      action: { label: "View Overdue", href: "/overdue?min=500000" },
    },
    {
      id: "2",
      type: "info",
      title: "Term 2 Fee Structure",
      message: "New fee structure is now active for Term 2",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      isRead: true,
      action: { label: "View Structure", href: "/settings/fees" },
    },
    {
      id: "3",
      type: "success",
      title: "Collection Target Achieved",
      message: "Daily collection target of UGX 5,000,000 reached!",
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      isRead: false,
    },
  ];
}
