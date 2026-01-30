/**
 * Automated Reports Service
 * Scheduled report generation and delivery
 */

import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency } from "../utils";

// ============================================================================
// Types
// ============================================================================

export type ReportType =
  | "daily_collection"
  | "weekly_summary"
  | "monthly_summary"
  | "arrears_list"
  | "class_breakdown"
  | "payment_methods"
  | "term_progress"
  | "custom";

export type ReportFormat = "pdf" | "excel" | "csv" | "email";

export type ScheduleFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "termly"
  | "on_demand";

export interface ReportSchedule {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: ScheduleFrequency;
  format: ReportFormat[];
  recipients: string[];
  filters?: ReportFilters;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  classIds?: string[];
  termId?: string;
  paymentMethods?: string[];
  minAmount?: number;
  maxAmount?: number;
  status?: string[];
}

export interface GeneratedReport {
  id: string;
  scheduleId?: string;
  reportType: ReportType;
  title: string;
  period: { start: Date; end: Date };
  generatedAt: Date;
  generatedBy: string;
  format: ReportFormat;
  fileUrl?: string;
  data: ReportData;
  summary: ReportSummary;
}

export interface ReportPayment {
  id: string;
  studentId: string;
  amount: number;
  channel?: string;
  date?: Date;
  [key: string]: unknown;
}

export interface ReportData {
  payments: ReportPayment[];
  totals?: {
    expected?: number;
    arrears?: number;
    [key: string]: number | undefined;
  };
  [key: string]: unknown;
}

export interface ReportSummary {
  totalCollected: number;
  totalExpected: number;
  collectionRate: number;
  transactionCount: number;
  studentsCount: number;
  arrearsTotal?: number;
  highlights: string[];
}

// ============================================================================
// Report Templates
// ============================================================================

export const reportTemplates: Record<
  ReportType,
  {
    title: string;
    description: string;
    defaultFrequency: ScheduleFrequency;
  }
> = {
  daily_collection: {
    title: "Daily Collection Report",
    description: "Summary of all payments received in a day",
    defaultFrequency: "daily",
  },
  weekly_summary: {
    title: "Weekly Summary Report",
    description: "Week-over-week collection performance",
    defaultFrequency: "weekly",
  },
  monthly_summary: {
    title: "Monthly Summary Report",
    description: "Comprehensive monthly financial overview",
    defaultFrequency: "monthly",
  },
  arrears_list: {
    title: "Arrears Report",
    description: "List of students with outstanding balances",
    defaultFrequency: "weekly",
  },
  class_breakdown: {
    title: "Class-wise Collection Report",
    description: "Collection performance by class",
    defaultFrequency: "monthly",
  },
  payment_methods: {
    title: "Payment Methods Analysis",
    description: "Breakdown of collections by payment method",
    defaultFrequency: "monthly",
  },
  term_progress: {
    title: "Term Progress Report",
    description: "Overall term fee collection progress",
    defaultFrequency: "weekly",
  },
  custom: {
    title: "Custom Report",
    description: "User-defined report with custom filters",
    defaultFrequency: "on_demand",
  },
};

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a report based on type and filters
 */
export async function generateReport(
  reportType: ReportType,
  filters: ReportFilters,
  generatedBy: string,
): Promise<GeneratedReport> {
  const period = getReportPeriod(reportType, filters);

  // Fetch data based on report type
  const data = await fetchReportData(reportType, period, filters);

  // Calculate summary
  const summary = calculateReportSummary(data);

  // Generate highlights
  summary.highlights = generateHighlights(reportType, data, summary);

  const report: GeneratedReport = {
    id: `report_${Date.now()}`,
    reportType,
    title: reportTemplates[reportType].title,
    period,
    generatedAt: new Date(),
    generatedBy,
    format: "email", // Default format
    data,
    summary,
  };

  // Store report in Firestore
  await saveReport(report);

  return report;
}

/**
 * Get the date range for a report
 */
function getReportPeriod(
  reportType: ReportType,
  filters: ReportFilters,
): { start: Date; end: Date } {
  if (filters.startDate && filters.endDate) {
    return { start: filters.startDate, end: filters.endDate };
  }

  const now = new Date();

  switch (reportType) {
    case "daily_collection":
      return {
        start: startOfDay(subDays(now, 1)),
        end: endOfDay(subDays(now, 1)),
      };
    case "weekly_summary":
      return {
        start: startOfWeek(subWeeks(now, 1)),
        end: endOfWeek(subWeeks(now, 1)),
      };
    case "monthly_summary":
    case "class_breakdown":
    case "payment_methods":
      return {
        start: startOfMonth(subMonths(now, 1)),
        end: endOfMonth(subMonths(now, 1)),
      };
    default:
      return {
        start: startOfDay(subDays(now, 30)),
        end: endOfDay(now),
      };
  }
}

/**
 * Fetch data for report generation
 * This is a placeholder - actual implementation would query Firestore
 */
async function fetchReportData(
  reportType: ReportType,
  period: { start: Date; end: Date },
  filters: ReportFilters,
): Promise<any> {
  // Placeholder data structure
  // In production, this would query Firestore based on filters
  return {
    payments: [],
    students: [],
    classes: [],
    totals: {
      collected: 0,
      expected: 0,
      arrears: 0,
    },
  };
}

/**
 * Calculate summary statistics from report data
 */
function calculateReportSummary(data: ReportData): ReportSummary {
  const payments = data.payments || [];

  const totalCollected = payments.reduce(
    (sum: number, p: ReportPayment) => sum + (p.amount || 0),
    0,
  );
  const totalExpected = data.totals?.expected || 0;
  const collectionRate =
    totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  return {
    totalCollected,
    totalExpected,
    collectionRate,
    transactionCount: payments.length,
    studentsCount: new Set(payments.map((p: ReportPayment) => p.studentId))
      .size,
    arrearsTotal: data.totals?.arrears || 0,
    highlights: [],
  };
}

/**
 * Generate report highlights/insights
 */
function generateHighlights(
  reportType: ReportType,
  data: ReportData,
  summary: ReportSummary,
): string[] {
  const highlights: string[] = [];

  // Collection rate insight
  if (summary.collectionRate >= 90) {
    highlights.push(
      `Excellent collection rate of ${summary.collectionRate.toFixed(1)}%`,
    );
  } else if (summary.collectionRate >= 70) {
    highlights.push(
      `Good collection rate of ${summary.collectionRate.toFixed(1)}%`,
    );
  } else if (summary.collectionRate < 50) {
    highlights.push(
      `⚠️ Low collection rate of ${summary.collectionRate.toFixed(1)}% needs attention`,
    );
  }

  // Transaction volume
  if (summary.transactionCount > 0) {
    const avgTransaction = summary.totalCollected / summary.transactionCount;
    highlights.push(`Average transaction: ${formatCurrency(avgTransaction)}`);
  }

  // Arrears insight
  if (summary.arrearsTotal && summary.arrearsTotal > 0) {
    highlights.push(`Total arrears: ${formatCurrency(summary.arrearsTotal)}`);
  }

  return highlights;
}

/**
 * Save report to Firestore
 */
async function saveReport(report: GeneratedReport): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "reports"), {
      ...report,
      generatedAt: Timestamp.fromDate(report.generatedAt),
      period: {
        start: Timestamp.fromDate(report.period.start),
        end: Timestamp.fromDate(report.period.end),
      },
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving report:", error);
    throw error;
  }
}

// ============================================================================
// Report Scheduling
// ============================================================================

/**
 * Create a new report schedule
 */
export async function createReportSchedule(
  schedule: Omit<ReportSchedule, "id" | "createdAt" | "updatedAt" | "nextRun">,
): Promise<string> {
  const nextRun = calculateNextRun(schedule.frequency);

  const docRef = await addDoc(collection(db, "reportSchedules"), {
    ...schedule,
    nextRun: Timestamp.fromDate(nextRun),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Update an existing schedule
 */
export async function updateReportSchedule(
  scheduleId: string,
  updates: Partial<ReportSchedule>,
): Promise<void> {
  const scheduleRef = doc(db, "reportSchedules", scheduleId);
  await updateDoc(scheduleRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: ScheduleFrequency): Date {
  const now = new Date();

  switch (frequency) {
    case "daily":
      // Next day at 6 AM
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(6, 0, 0, 0);
      return nextDay;

    case "weekly":
      // Next Monday at 6 AM
      const nextMonday = new Date(now);
      nextMonday.setDate(
        nextMonday.getDate() + ((7 - nextMonday.getDay() + 1) % 7 || 7),
      );
      nextMonday.setHours(6, 0, 0, 0);
      return nextMonday;

    case "monthly":
      // First day of next month at 6 AM
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextMonth.setHours(6, 0, 0, 0);
      return nextMonth;

    case "termly":
      // This would need term configuration
      const nextTerm = new Date(now);
      nextTerm.setMonth(nextTerm.getMonth() + 4);
      return nextTerm;

    default:
      return now;
  }
}

/**
 * Get all schedules due for execution
 */
export async function getDueSchedules(): Promise<ReportSchedule[]> {
  const now = new Date();

  const schedulesQuery = query(
    collection(db, "reportSchedules"),
    where("isActive", "==", true),
    where("nextRun", "<=", Timestamp.fromDate(now)),
  );

  const snapshot = await getDocs(schedulesQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    nextRun: doc.data().nextRun?.toDate(),
    lastRun: doc.data().lastRun?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as ReportSchedule[];
}

/**
 * Execute a scheduled report
 */
export async function executeScheduledReport(
  schedule: ReportSchedule,
): Promise<void> {
  try {
    // Generate the report
    const report = await generateReport(
      schedule.reportType,
      schedule.filters || {},
      "system",
    );

    // Send to recipients
    for (const recipient of schedule.recipients) {
      await sendReportEmail(recipient, report);
    }

    // Update schedule
    const nextRun = calculateNextRun(schedule.frequency);
    await updateReportSchedule(schedule.id, {
      lastRun: new Date(),
      nextRun,
    });

    console.log(`Report ${schedule.name} executed successfully`);
  } catch (error) {
    console.error(`Error executing report ${schedule.name}:`, error);
    throw error;
  }
}

// ============================================================================
// Report Delivery
// ============================================================================

/**
 * Send report via email
 * This is a placeholder - actual implementation would use an email service
 */
async function sendReportEmail(
  recipient: string,
  report: GeneratedReport,
): Promise<void> {
  const emailContent = formatReportEmail(report);

  // In production, this would send via Firebase Extensions (Trigger Email)
  // or a service like SendGrid/Mailgun
  console.log(`Would send report to ${recipient}:`, emailContent.subject);

  // Example: Using Firebase Trigger Email extension
  // await addDoc(collection(db, 'mail'), {
  //   to: recipient,
  //   message: emailContent,
  // });
}

/**
 * Format report as email content
 */
function formatReportEmail(report: GeneratedReport): {
  subject: string;
  html: string;
  text: string;
} {
  const periodStr = `${format(report.period.start, "dd MMM yyyy")} - ${format(report.period.end, "dd MMM yyyy")}`;

  const subject = `${report.title} - ${periodStr}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #2563eb; color: white; padding: 20px; }
        .content { padding: 20px; }
        .summary-card { background: #f3f4f6; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .stat { display: inline-block; margin-right: 20px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .stat-label { font-size: 12px; color: #666; }
        .highlight { padding: 8px 12px; background: #dbeafe; border-radius: 4px; margin: 5px 0; }
        .footer { padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin:0">${report.title}</h1>
        <p style="margin:5px 0 0 0;opacity:0.9">${periodStr}</p>
      </div>
      
      <div class="content">
        <div class="summary-card">
          <div class="stat">
            <div class="stat-value">${formatCurrency(report.summary.totalCollected)}</div>
            <div class="stat-label">Total Collected</div>
          </div>
          <div class="stat">
            <div class="stat-value">${report.summary.collectionRate.toFixed(1)}%</div>
            <div class="stat-label">Collection Rate</div>
          </div>
          <div class="stat">
            <div class="stat-value">${report.summary.transactionCount}</div>
            <div class="stat-label">Transactions</div>
          </div>
        </div>
        
        <h3>Key Insights</h3>
        ${report.summary.highlights.map((h) => `<div class="highlight">${h}</div>`).join("")}
        
        <p style="margin-top:20px">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/reports/${report.id}" 
             style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">
            View Full Report
          </a>
        </p>
      </div>
      
      <div class="footer">
        <p>This report was automatically generated by EduPay Ledger.</p>
        <p>Generated on ${format(report.generatedAt, "dd MMM yyyy HH:mm")}</p>
      </div>
    </body>
    </html>
  `;

  const text = `
${report.title}
${periodStr}

SUMMARY
-------
Total Collected: ${formatCurrency(report.summary.totalCollected)}
Collection Rate: ${report.summary.collectionRate.toFixed(1)}%
Transactions: ${report.summary.transactionCount}

KEY INSIGHTS
------------
${report.summary.highlights.join("\n")}

View full report: ${process.env.NEXT_PUBLIC_APP_URL}/reports/${report.id}

---
Generated by EduPay Ledger on ${format(report.generatedAt, "dd MMM yyyy HH:mm")}
  `;

  return { subject, html, text };
}

// ============================================================================
// Report Export Functions
// ============================================================================

/**
 * Export report as CSV
 */
export function exportReportAsCSV(report: GeneratedReport): string {
  // Header row
  const headers = ["Date", "Student", "Class", "Amount", "Method", "Reference"];
  const rows = [headers.join(",")];

  // Data rows
  const payments = report.data.payments || [];
  for (const payment of payments) {
    const row = [
      payment.date ? format(payment.date, "yyyy-MM-dd") : "",
      `"${payment.studentName || ""}"`,
      payment.className || "",
      payment.amount || 0,
      payment.method || "",
      payment.reference || "",
    ];
    rows.push(row.join(","));
  }

  // Summary row
  rows.push("");
  rows.push(`Total,,,${report.summary.totalCollected},,`);
  rows.push(`Collection Rate,,,${report.summary.collectionRate.toFixed(1)}%,,`);

  return rows.join("\n");
}

/**
 * Generate report data for Excel export
 * Returns data structure suitable for a library like xlsx
 */
export interface ExcelReportData {
  summary: {
    title: string;
    period: string;
    totalCollected: number;
    collectionRate: number;
    transactions: number;
  };
  payments: ReportPayment[];
  highlights: string[];
}

export function prepareReportForExcel(
  report: GeneratedReport,
): ExcelReportData {
  return {
    summary: {
      title: report.title,
      period: `${format(report.period.start, "dd/MM/yyyy")} - ${format(report.period.end, "dd/MM/yyyy")}`,
      totalCollected: report.summary.totalCollected,
      collectionRate: report.summary.collectionRate,
      transactions: report.summary.transactionCount,
    },
    payments: report.data.payments || [],
    highlights: report.summary.highlights,
  };
}

export default {
  generateReport,
  createReportSchedule,
  updateReportSchedule,
  getDueSchedules,
  executeScheduledReport,
  exportReportAsCSV,
  prepareReportForExcel,
  reportTemplates,
};
