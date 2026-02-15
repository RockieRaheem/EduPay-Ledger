/**
 * Payment Promise Escalation Types
 * Automated SMS reminders for overdue payment promises
 *
 * Features:
 * - Escalation timeline tracking
 * - Multi-stage SMS reminders
 * - Head/DOS notification triggers
 * - Auto-exam clearance blocking
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Escalation stage
 */
export type EscalationStage =
  | "none" // Promise is current
  | "reminder" // 3 days before due - friendly reminder
  | "due_today" // Due date - payment expected
  | "overdue_1" // 1-3 days overdue - first warning
  | "overdue_7" // 7 days overdue - urgent
  | "overdue_14" // 14 days overdue - final warning
  | "escalated_dos" // Escalated to Dean of Students
  | "escalated_head" // Escalated to Headteacher
  | "exam_blocked" // Student blocked from exams
  | "defaulted"; // Promise defaulted, refer for collection

/**
 * SMS template type
 */
export type SMSTemplateType =
  | "promise_reminder"
  | "promise_due_today"
  | "promise_overdue_1"
  | "promise_overdue_7"
  | "promise_final_warning"
  | "promise_escalated"
  | "promise_defaulted"
  | "exam_clearance_blocked";

/**
 * Escalation action type
 */
export type EscalationAction =
  | "send_sms"
  | "send_email"
  | "notify_dos"
  | "notify_head"
  | "block_exams"
  | "create_followup"
  | "refer_writeoff";

/**
 * Payment promise with escalation tracking
 */
export interface PromiseWithEscalation {
  id: string;
  schoolId: string;

  // Student info
  studentId: string;
  studentName: string;
  className: string;

  // Guardian info
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;

  // Promise details
  promiseAmount: number;
  promiseDate: Date;
  createdAt: Timestamp;
  createdBy: string;

  // Status
  isPaid: boolean;
  paidAmount: number;
  paidAt?: Timestamp;

  // Escalation state
  currentStage: EscalationStage;
  daysOverdue: number;

  // Communication history
  notifications: EscalationNotification[];
  totalSMSSent: number;
  lastSMSSentAt?: Timestamp;

  // Escalation flags
  hasBeenEscalatedToDOS: boolean;
  dosEscalatedAt?: Timestamp;
  hasBeenEscalatedToHead: boolean;
  headEscalatedAt?: Timestamp;

  // Exam clearance
  examClearanceBlocked: boolean;
  examBlockedAt?: Timestamp;
  examBlockedReason?: string;

  // Notes
  notes: PromiseNote[];

  // Next action
  nextActionDate: Date;
  nextActionType: EscalationAction;

  updatedAt: Timestamp;
}

/**
 * Notification record
 */
export interface EscalationNotification {
  id: string;
  type: "sms" | "email" | "internal";
  templateType: SMSTemplateType;
  recipient: string;
  recipientType: "guardian" | "dos" | "headteacher" | "bursar";

  message: string;
  sentAt: Timestamp;
  sentBy: string; // 'system' for auto-sent

  // Delivery status
  deliveryStatus: "pending" | "sent" | "delivered" | "failed";
  deliveryFailReason?: string;

  // Response
  hasResponse: boolean;
  responseReceived?: string;
  responseAt?: Timestamp;
}

/**
 * Promise note
 */
export interface PromiseNote {
  id: string;
  note: string;
  addedBy: string;
  addedByName: string;
  addedAt: Timestamp;
  noteType: "general" | "followup" | "response" | "escalation";
}

// ============================================================================
// ESCALATION CONFIGURATION
// ============================================================================

/**
 * Escalation policy for school
 */
export interface EscalationPolicy {
  schoolId: string;

  // Enable/disable
  autoEscalationEnabled: boolean;
  autoSMSEnabled: boolean;
  autoEmailEnabled: boolean;

  // Timeline (days relative to promise date)
  reminderDaysBefore: number; // Send reminder X days before (default: 3)
  firstWarningDaysAfter: number; // First warning after X days overdue (default: 1)
  urgentWarningDaysAfter: number; // Urgent warning after X days (default: 7)
  finalWarningDaysAfter: number; // Final warning after X days (default: 14)
  dosEscalationDaysAfter: number; // Escalate to DOS after X days (default: 14)
  headEscalationDaysAfter: number; // Escalate to Head after X days (default: 21)
  examBlockDaysAfter: number; // Block exams after X days (default: 21)
  defaultDaysAfter: number; // Mark as defaulted after X days (default: 30)

  // Notification limits
  maxSMSPerPromise: number; // Max SMS to send per promise (default: 5)
  minDaysBetweenSMS: number; // Minimum days between SMS (default: 3)

  // Working hours for SMS
  smsStartHour: number; // Don't send before this hour (default: 8)
  smsEndHour: number; // Don't send after this hour (default: 18)
  sendOnWeekends: boolean;

  // Auto-actions
  autoBlockExams: boolean;
  autoNotifyDOS: boolean;
  autoNotifyHead: boolean;

  // Contact preferences
  preferredContactMethod: "sms" | "email" | "both";

  // Staff to notify
  dosUserId?: string;
  headUserId?: string;

  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * SMS template
 */
export interface SMSTemplate {
  id: string;
  schoolId: string;
  templateType: SMSTemplateType;

  // Template content
  templateText: string;

  // Available placeholders
  // {student_name}, {guardian_name}, {amount}, {promise_date},
  // {days_overdue}, {school_name}, {balance}

  isActive: boolean;
  lastModified: Timestamp;
  modifiedBy: string;
}

// ============================================================================
// ESCALATION BATCH PROCESSING
// ============================================================================

/**
 * Batch processing job
 */
export interface EscalationBatch {
  id: string;
  schoolId: string;
  runDate: Date;
  runAt: Timestamp;

  // Processing stats
  promisesProcessed: number;
  smsScheduled: number;
  smsSent: number;
  smsFailed: number;
  escalationsTriggered: number;
  examsBlocked: number;

  // Details
  actions: EscalationBatchAction[];

  status: "pending" | "running" | "completed" | "failed";
  completedAt?: Timestamp;
  error?: string;
}

/**
 * Individual batch action
 */
export interface EscalationBatchAction {
  promiseId: string;
  studentName: string;
  action: EscalationAction;
  previousStage: EscalationStage;
  newStage: EscalationStage;
  success: boolean;
  error?: string;
  timestamp: Timestamp;
}

// ============================================================================
// INPUT/QUERY TYPES
// ============================================================================

export interface PromiseEscalationQuery {
  schoolId: string;
  stage?: EscalationStage;
  overdueOnly?: boolean;
  examBlockedOnly?: boolean;
  needsAction?: boolean;
  classId?: string;
  limit?: number;
}

export interface SendSMSInput {
  promiseId: string;
  templateType: SMSTemplateType;
  customMessage?: string;
  senderId: string;
}

export interface EscalatePromiseInput {
  promiseId: string;
  newStage: EscalationStage;
  reason: string;
  escalatedBy: string;
  escalatedByName: string;
}

// ============================================================================
// SUMMARY TYPES
// ============================================================================

/**
 * Escalation dashboard summary
 */
export interface EscalationDashboard {
  schoolId: string;
  asOfDate: Date;

  // Counts by stage
  byStage: Record<EscalationStage, number>;

  // Key metrics
  totalActivePromises: number;
  totalOverdue: number;
  overdueAmount: number;

  // Communication stats
  smsSentToday: number;
  smsSentThisWeek: number;
  smsRemaining: number; // Based on budget/limits

  // Escalation stats
  escalatedToDOS: number;
  escalatedToHead: number;
  examBlocked: number;

  // Trends
  promisesFulfilledThisWeek: number;
  promisesDefaultedThisWeek: number;
  fulfillmentRate: number;

  // Urgent items
  urgentFollowUps: PromiseWithEscalation[];
}

/**
 * Guardian communication summary
 */
export interface GuardianCommunicationSummary {
  guardianPhone: string;
  guardianName: string;

  // Children with promises
  children: {
    studentId: string;
    studentName: string;
    promiseAmount: number;
    daysOverdue: number;
  }[];

  totalPromiseAmount: number;
  totalOverdueAmount: number;

  // Communication history
  smsCount: number;
  lastContactDate: Date;
  hasResponded: boolean;

  // Risk assessment
  riskLevel: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get escalation stage display info
 */
export function getStageInfo(stage: EscalationStage): {
  label: string;
  color: "green" | "yellow" | "orange" | "red" | "purple" | "gray";
  icon: string;
  severity: number;
} {
  const info: Record<
    EscalationStage,
    {
      label: string;
      color: "green" | "yellow" | "orange" | "red" | "purple" | "gray";
      icon: string;
      severity: number;
    }
  > = {
    none: {
      label: "Current",
      color: "green",
      icon: "check_circle",
      severity: 0,
    },
    reminder: {
      label: "Reminder Sent",
      color: "green",
      icon: "notifications",
      severity: 1,
    },
    due_today: {
      label: "Due Today",
      color: "yellow",
      icon: "today",
      severity: 2,
    },
    overdue_1: {
      label: "1-3 Days Overdue",
      color: "yellow",
      icon: "warning",
      severity: 3,
    },
    overdue_7: {
      label: "7+ Days Overdue",
      color: "orange",
      icon: "error",
      severity: 4,
    },
    overdue_14: {
      label: "14+ Days Overdue",
      color: "red",
      icon: "error_outline",
      severity: 5,
    },
    escalated_dos: {
      label: "Escalated to DOS",
      color: "red",
      icon: "escalator_warning",
      severity: 6,
    },
    escalated_head: {
      label: "Escalated to Head",
      color: "purple",
      icon: "report",
      severity: 7,
    },
    exam_blocked: {
      label: "Exams Blocked",
      color: "purple",
      icon: "block",
      severity: 8,
    },
    defaulted: {
      label: "Defaulted",
      color: "gray",
      icon: "cancel",
      severity: 9,
    },
  };
  return info[stage];
}

/**
 * Get SMS template description
 */
export function getTemplateDescription(type: SMSTemplateType): string {
  const descriptions: Record<SMSTemplateType, string> = {
    promise_reminder: "Friendly reminder 3 days before promise date",
    promise_due_today: "Payment due today notification",
    promise_overdue_1: "First overdue notification (1-3 days)",
    promise_overdue_7: "Urgent overdue notification (7+ days)",
    promise_final_warning: "Final warning before escalation",
    promise_escalated: "Escalation notification to guardian",
    promise_defaulted: "Promise defaulted notification",
    exam_clearance_blocked: "Exam clearance blocked notification",
  };
  return descriptions[type];
}

/**
 * Get default SMS template
 */
export function getDefaultSMSTemplate(
  type: SMSTemplateType,
  schoolName: string,
): string {
  const templates: Record<SMSTemplateType, string> = {
    promise_reminder: `Dear {guardian_name}, this is a reminder that payment of UGX {amount} for {student_name} is due on {promise_date}. Please ensure timely payment. - ${schoolName}`,
    promise_due_today: `Dear {guardian_name}, payment of UGX {amount} for {student_name} is due TODAY. Please pay to avoid late fees. - ${schoolName}`,
    promise_overdue_1: `Dear {guardian_name}, payment of UGX {amount} for {student_name} is now {days_overdue} days overdue. Please pay immediately. - ${schoolName}`,
    promise_overdue_7: `URGENT: Payment of UGX {amount} for {student_name} is {days_overdue} days overdue. Please contact the school bursar immediately. - ${schoolName}`,
    promise_final_warning: `FINAL WARNING: UGX {amount} for {student_name} is {days_overdue} days overdue. Failure to pay will result in exam clearance being revoked. - ${schoolName}`,
    promise_escalated: `Important: {student_name}'s fee arrears of UGX {amount} has been escalated to school management. Please contact the school urgently. - ${schoolName}`,
    promise_defaulted: `{student_name}'s payment promise of UGX {amount} has defaulted. Please contact the school to discuss payment options. - ${schoolName}`,
    exam_clearance_blocked: `{student_name} has been blocked from sitting exams due to unpaid fees of UGX {balance}. Please clear the balance immediately. - ${schoolName}`,
  };
  return templates[type];
}

/**
 * Calculate days overdue
 */
export function calculateDaysOverdue(promiseDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const promise = new Date(promiseDate);
  promise.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - promise.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Determine escalation stage based on days overdue
 */
export function determineStage(
  daysOverdue: number,
  policy: EscalationPolicy,
): EscalationStage {
  if (daysOverdue < 0) return "none";
  if (daysOverdue === 0) return "due_today";
  if (daysOverdue <= 3) return "overdue_1";
  if (daysOverdue <= policy.urgentWarningDaysAfter) return "overdue_7";
  if (daysOverdue <= policy.dosEscalationDaysAfter) return "overdue_14";
  if (daysOverdue <= policy.headEscalationDaysAfter) return "escalated_dos";
  if (daysOverdue <= policy.defaultDaysAfter) return "escalated_head";
  return "defaulted";
}

/**
 * Get next action for promise
 */
export function getNextAction(
  promise: PromiseWithEscalation,
  policy: EscalationPolicy,
): { action: EscalationAction; daysUntil: number } {
  const daysOverdue = calculateDaysOverdue(promise.promiseDate);

  if (daysOverdue < 0) {
    // Not yet due
    const daysUntilDue = Math.abs(daysOverdue);
    if (
      daysUntilDue <= policy.reminderDaysBefore &&
      !promise.notifications.some((n) => n.templateType === "promise_reminder")
    ) {
      return { action: "send_sms", daysUntil: 0 };
    }
    return {
      action: "send_sms",
      daysUntil: daysUntilDue - policy.reminderDaysBefore,
    };
  }

  if (
    daysOverdue >= policy.examBlockDaysAfter &&
    !promise.examClearanceBlocked &&
    policy.autoBlockExams
  ) {
    return { action: "block_exams", daysUntil: 0 };
  }

  if (
    daysOverdue >= policy.headEscalationDaysAfter &&
    !promise.hasBeenEscalatedToHead &&
    policy.autoNotifyHead
  ) {
    return { action: "notify_head", daysUntil: 0 };
  }

  if (
    daysOverdue >= policy.dosEscalationDaysAfter &&
    !promise.hasBeenEscalatedToDOS &&
    policy.autoNotifyDOS
  ) {
    return { action: "notify_dos", daysUntil: 0 };
  }

  // Check if we need to send another SMS
  const canSendSMS = promise.totalSMSSent < policy.maxSMSPerPromise;
  const daysSinceLastSMS = promise.lastSMSSentAt
    ? Math.floor(
        (Date.now() - promise.lastSMSSentAt.toMillis()) / (1000 * 60 * 60 * 24),
      )
    : policy.minDaysBetweenSMS;

  if (canSendSMS && daysSinceLastSMS >= policy.minDaysBetweenSMS) {
    return { action: "send_sms", daysUntil: 0 };
  }

  return {
    action: "create_followup",
    daysUntil: policy.minDaysBetweenSMS - daysSinceLastSMS,
  };
}

/**
 * Parse SMS template with values
 */
export function parseSMSTemplate(
  template: string,
  values: {
    studentName: string;
    guardianName: string;
    amount: number;
    promiseDate: Date;
    daysOverdue: number;
    schoolName: string;
    balance: number;
  },
): string {
  return template
    .replace(/{student_name}/g, values.studentName)
    .replace(/{guardian_name}/g, values.guardianName)
    .replace(/{amount}/g, values.amount.toLocaleString("en-UG"))
    .replace(/{promise_date}/g, values.promiseDate.toLocaleDateString("en-UG"))
    .replace(/{days_overdue}/g, values.daysOverdue.toString())
    .replace(/{school_name}/g, values.schoolName)
    .replace(/{balance}/g, values.balance.toLocaleString("en-UG"));
}

/**
 * Format phone number for Uganda
 */
export function formatUgandaPhone(phone: string): string {
  // Remove spaces and dashes
  let cleaned = phone.replace(/[\s-]/g, "");

  // Handle local format (07XXXXXXXX)
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+256" + cleaned.substring(1);
  }

  // Handle without country code
  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return "+256" + cleaned;
  }

  // Handle 256 without +
  if (cleaned.startsWith("256") && cleaned.length === 12) {
    return "+" + cleaned;
  }

  return cleaned;
}
