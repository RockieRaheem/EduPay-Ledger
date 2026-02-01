/**
 * Reports Firebase Service
 * Handles all reporting and audit trail operations for eBursar
 */

import {
  db,
  fetchDocument,
  fetchCollection,
  saveDocument,
  subscribeToCollection,
  logAuditAction,
  COLLECTIONS,
  Timestamp,
} from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  sum,
  getAggregateFromServer,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import type { Payment, PaymentChannel } from "@/types/payment";
import type { Student } from "@/types/student";

// ============================================================================
// TYPES
// ============================================================================

export interface ReportFilters {
  schoolId: string;
  termId?: string;
  classId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CollectionReport {
  period: string;
  totalCollected: number;
  totalExpected: number;
  collectionRate: number;
  byChannel: Record<string, number>;
  byClass: Record<string, number>;
  dailyBreakdown: { date: string; amount: number }[];
}

export interface ArrearsReport {
  totalArrears: number;
  studentsWithArrears: number;
  byClass: { className: string; count: number; amount: number }[];
  topDefaulters: {
    studentId: string;
    studentName: string;
    className: string;
    amount: number;
  }[];
  agingAnalysis: {
    range: string;
    count: number;
    amount: number;
  }[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  collection: string;
  documentId: string;
  userId: string;
  userName?: string;
  timestamp: Timestamp;
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface AuditFilters {
  schoolId: string;
  userId?: string;
  action?: string;
  collection?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================================================
// COLLECTION REPORTS
// ============================================================================

/**
 * Generate collection summary report
 */
export async function generateCollectionReport(
  filters: ReportFilters,
): Promise<CollectionReport> {
  const { schoolId, termId, dateFrom, dateTo } = filters;

  const constraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
  ];

  if (dateFrom) {
    constraints.push(where("recordedAt", ">=", Timestamp.fromDate(dateFrom)));
  }

  if (dateTo) {
    constraints.push(where("recordedAt", "<=", Timestamp.fromDate(dateTo)));
  }

  constraints.push(orderBy("recordedAt", "asc"));

  const payments = await fetchCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    constraints,
  );

  // Calculate totals
  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  // Group by channel
  const byChannel: Record<string, number> = {};
  payments.forEach((p) => {
    byChannel[p.channel] = (byChannel[p.channel] || 0) + p.amount;
  });

  // Group by class (would need to join with students)
  const byClass: Record<string, number> = {};

  // Daily breakdown
  const dailyTotals: Record<string, number> = {};
  payments.forEach((payment) => {
    const date = payment.recordedAt.toDate().toISOString().split("T")[0];
    dailyTotals[date] = (dailyTotals[date] || 0) + payment.amount;
  });

  const dailyBreakdown = Object.entries(dailyTotals).map(([date, amount]) => ({
    date,
    amount,
  }));

  // Calculate expected (would come from fee structures)
  const totalExpected = 0; // Placeholder

  return {
    period: termId || "All Time",
    totalCollected,
    totalExpected,
    collectionRate:
      totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    byChannel,
    byClass,
    dailyBreakdown,
  };
}

/**
 * Get collections by class
 */
export async function getCollectionsByClass(
  schoolId: string,
  termId?: string,
): Promise<{ className: string; collected: number; expected: number }[]> {
  // Get all classes
  const classes = await fetchCollection<{ id: string; name: string }>(
    COLLECTIONS.CLASSES,
    [where("schoolId", "==", schoolId)],
  );

  const results = [];

  for (const classItem of classes) {
    const constraints = [
      where("schoolId", "==", schoolId),
      where("studentClass", "==", classItem.name),
      where("status", "==", "cleared"),
    ];

    const q = query(collection(db, COLLECTIONS.PAYMENTS), ...constraints);
    const snapshot = await getAggregateFromServer(q, {
      total: sum("amount"),
    });

    results.push({
      className: classItem.name,
      collected: snapshot.data().total || 0,
      expected: 0, // Would come from fee structures
    });
  }

  return results;
}

// ============================================================================
// ARREARS REPORTS
// ============================================================================

/**
 * Generate arrears report
 */
export async function generateArrearsReport(
  filters: ReportFilters,
): Promise<ArrearsReport> {
  const { schoolId, classId } = filters;

  const constraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
  ];

  if (classId) {
    constraints.push(where("classId", "==", classId));
  }

  constraints.push(orderBy("balance", "desc"));

  const students = await fetchCollection<Student>(
    COLLECTIONS.STUDENTS,
    constraints,
  );

  // Calculate total arrears
  const totalArrears = students.reduce((sum, s) => sum + (s.balance || 0), 0);

  // Group by class
  const classTotals: Record<string, { count: number; amount: number }> = {};
  students.forEach((student) => {
    const className = student.className || "Unknown";
    if (!classTotals[className]) {
      classTotals[className] = { count: 0, amount: 0 };
    }
    classTotals[className].count++;
    classTotals[className].amount += student.balance || 0;
  });

  const byClass = Object.entries(classTotals).map(([className, data]) => ({
    className,
    count: data.count,
    amount: data.amount,
  }));

  // Top defaulters
  const topDefaulters = students.slice(0, 10).map((s) => ({
    studentId: s.id,
    studentName: `${s.firstName} ${s.lastName}`,
    className: s.className || "Unknown",
    amount: s.balance || 0,
  }));

  // Aging analysis (simplified - would need lastPaymentDate)
  const agingAnalysis = [
    { range: "0-30 days", count: 0, amount: 0 },
    { range: "31-60 days", count: 0, amount: 0 },
    { range: "61-90 days", count: 0, amount: 0 },
    { range: "90+ days", count: 0, amount: 0 },
  ];

  return {
    totalArrears,
    studentsWithArrears: students.length,
    byClass,
    topDefaulters,
    agingAnalysis,
  };
}

/**
 * Get students with critical arrears
 */
export async function getCriticalArrears(
  schoolId: string,
  threshold: number = 500000, // UGX
): Promise<Student[]> {
  return fetchCollection<Student>(COLLECTIONS.STUDENTS, [
    where("schoolId", "==", schoolId),
    where("balance", ">=", threshold),
    orderBy("balance", "desc"),
    limit(50),
  ]);
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(
  filters: AuditFilters,
  pagination?: { pageSize?: number; lastDoc?: DocumentData },
): Promise<{ logs: AuditLogEntry[]; lastDoc: DocumentData | null }> {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", filters.schoolId),
  ];

  if (filters.userId) {
    constraints.push(where("userId", "==", filters.userId));
  }

  if (filters.action) {
    constraints.push(where("action", "==", filters.action));
  }

  if (filters.collection) {
    constraints.push(where("collection", "==", filters.collection));
  }

  if (filters.dateFrom) {
    constraints.push(
      where("timestamp", ">=", Timestamp.fromDate(filters.dateFrom)),
    );
  }

  if (filters.dateTo) {
    constraints.push(
      where("timestamp", "<=", Timestamp.fromDate(filters.dateTo)),
    );
  }

  constraints.push(orderBy("timestamp", "desc"));

  if (pagination?.pageSize) {
    constraints.push(limit(pagination.pageSize));
  }

  if (pagination?.lastDoc) {
    constraints.push(startAfter(pagination.lastDoc));
  }

  const logs = await fetchCollection<AuditLogEntry>(
    COLLECTIONS.AUDIT_LOGS,
    constraints,
  );

  return {
    logs,
    lastDoc: logs.length > 0 ? logs[logs.length - 1] : null,
  };
}

/**
 * Subscribe to audit logs in real-time
 */
export function subscribeToAuditLogs(
  schoolId: string,
  onData: (logs: AuditLogEntry[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToCollection<AuditLogEntry>(
    COLLECTIONS.AUDIT_LOGS,
    [
      where("schoolId", "==", schoolId),
      orderBy("timestamp", "desc"),
      limit(100),
    ],
    onData,
    onError,
  );
}

/**
 * Get audit statistics
 */
export async function getAuditStats(
  schoolId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<{
  totalActions: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byCollection: Record<string, number>;
}> {
  const logs = await fetchCollection<AuditLogEntry>(COLLECTIONS.AUDIT_LOGS, [
    where("schoolId", "==", schoolId),
    where("timestamp", ">=", Timestamp.fromDate(dateFrom)),
    where("timestamp", "<=", Timestamp.fromDate(dateTo)),
  ]);

  const byAction: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byCollection: Record<string, number> = {};

  logs.forEach((log) => {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byUser[log.userId] = (byUser[log.userId] || 0) + 1;
    byCollection[log.collection] = (byCollection[log.collection] || 0) + 1;
  });

  return {
    totalActions: logs.length,
    byAction,
    byUser,
    byCollection,
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate report data for export
 */
export async function exportCollectionData(
  filters: ReportFilters,
  format: "json" | "csv",
): Promise<string | object[]> {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", filters.schoolId),
    where("status", "==", "cleared"),
  ];

  if (filters.dateFrom) {
    constraints.push(
      where("recordedAt", ">=", Timestamp.fromDate(filters.dateFrom)),
    );
  }

  if (filters.dateTo) {
    constraints.push(
      where("recordedAt", "<=", Timestamp.fromDate(filters.dateTo)),
    );
  }

  constraints.push(orderBy("recordedAt", "desc"));

  const payments = await fetchCollection<Payment>(
    COLLECTIONS.PAYMENTS,
    constraints,
  );

  if (format === "json") {
    return payments;
  }

  // CSV format
  const headers = [
    "Receipt Number",
    "Student ID",
    "Student Name",
    "Amount",
    "Channel",
    "Installment",
    "Date",
    "Status",
  ].join(",");

  const rows = payments.map((p) =>
    [
      p.receiptNumber,
      p.studentId,
      p.studentName,
      p.amount,
      p.channel,
      p.installmentName,
      p.recordedAt.toDate().toISOString(),
      p.status,
    ].join(","),
  );

  return [headers, ...rows].join("\n");
}

/**
 * Export arrears data
 */
export async function exportArrearsData(
  schoolId: string,
  format: "json" | "csv",
): Promise<string | object[]> {
  const students = await fetchCollection<Student>(COLLECTIONS.STUDENTS, [
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
    orderBy("balance", "desc"),
  ]);

  if (format === "json") {
    return students;
  }

  // CSV format
  const headers = [
    "Student ID",
    "Student Code",
    "Name",
    "Class",
    "Balance (UGX)",
    "Status",
  ].join(",");

  const rows = students.map((s) =>
    [
      s.id,
      s.studentId || "",
      `${s.firstName} ${s.lastName}`,
      s.className || "",
      s.balance || 0,
      s.status,
    ].join(","),
  );

  return [headers, ...rows].join("\n");
}

// ============================================================================
// SCHEDULED REPORTS
// ============================================================================

/**
 * Save scheduled report configuration
 */
export async function saveScheduledReport(
  schoolId: string,
  config: {
    name: string;
    type: "collections" | "arrears" | "audit";
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
    filters?: ReportFilters;
  },
  userId: string,
): Promise<string> {
  const reportId = `RPT-${Date.now()}`;

  await saveDocument(`${COLLECTIONS.SETTINGS}/reports/scheduled`, reportId, {
    ...config,
    schoolId,
    createdBy: userId,
    createdAt: Timestamp.now(),
    isActive: true,
  });

  await logAuditAction("CREATE", "scheduled_reports", reportId, userId, {
    reportType: config.type,
    frequency: config.frequency,
  });

  return reportId;
}

/**
 * Get dashboard summary for reports page
 */
export async function getReportsSummary(
  schoolId: string,
  termId?: string,
): Promise<{
  totalCollections: number;
  totalArrears: number;
  collectionRate: number;
  studentsWithArrears: number;
  recentPayments: Payment[];
  topCollectors: { userId: string; count: number; total: number }[];
}> {
  // Get collections
  const collectionConstraints = [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
  ];

  const collectionsQuery = query(
    collection(db, COLLECTIONS.PAYMENTS),
    ...collectionConstraints,
  );
  const collectionsSnapshot = await getAggregateFromServer(collectionsQuery, {
    total: sum("amount"),
  });

  // Get arrears
  const arrearsQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
  );
  const arrearsTotalSnapshot = await getAggregateFromServer(arrearsQuery, {
    total: sum("balance"),
  });
  const arrearsCountSnapshot = await getCountFromServer(arrearsQuery);

  // Recent payments
  const recentPayments = await fetchCollection<Payment>(COLLECTIONS.PAYMENTS, [
    where("schoolId", "==", schoolId),
    where("status", "==", "cleared"),
    orderBy("recordedAt", "desc"),
    limit(10),
  ]);

  return {
    totalCollections: collectionsSnapshot.data().total || 0,
    totalArrears: arrearsTotalSnapshot.data().total || 0,
    collectionRate: 0, // Would need expected fees
    studentsWithArrears: arrearsCountSnapshot.data().count || 0,
    recentPayments,
    topCollectors: [], // Would need aggregation by recordedBy
  };
}
