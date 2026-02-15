/**
 * Payment Promise Escalation Service
 * Handles automated SMS reminders and escalation workflows
 *
 * Features:
 * - Batch processing of overdue promises
 * - SMS scheduling with rate limits
 * - DOS/Headteacher notifications
 * - Exam clearance blocking
 */

import { Timestamp } from "firebase/firestore";
import {
  PromiseWithEscalation,
  EscalationNotification,
  EscalationPolicy,
  SMSTemplate,
  EscalationBatch,
  EscalationBatchAction,
  EscalationDashboard,
  GuardianCommunicationSummary,
  PromiseEscalationQuery,
  SendSMSInput,
  EscalatePromiseInput,
  EscalationStage,
  SMSTemplateType,
  calculateDaysOverdue,
  determineStage,
  getNextAction,
  parseSMSTemplate,
  getDefaultSMSTemplate,
  formatUgandaPhone,
  PromiseNote,
} from "@/types/escalation";

// ============================================================================
// ESCALATION POLICY MANAGEMENT
// ============================================================================

/**
 * Get escalation policy for school
 */
export async function getEscalationPolicy(
  schoolId: string,
): Promise<EscalationPolicy> {
  // Mock implementation - would fetch from Firestore
  return getMockPolicy(schoolId);
}

/**
 * Update escalation policy
 */
export async function updateEscalationPolicy(
  schoolId: string,
  updates: Partial<EscalationPolicy>,
  userId: string,
): Promise<EscalationPolicy> {
  const current = await getEscalationPolicy(schoolId);

  const updated: EscalationPolicy = {
    ...current,
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  // Would save to Firestore
  console.log("Updated escalation policy:", updated);

  return updated;
}

// ============================================================================
// SMS TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Get SMS templates for school
 */
export async function getSMSTemplates(
  schoolId: string,
): Promise<SMSTemplate[]> {
  const templateTypes: SMSTemplateType[] = [
    "promise_reminder",
    "promise_due_today",
    "promise_overdue_1",
    "promise_overdue_7",
    "promise_final_warning",
    "promise_escalated",
    "promise_defaulted",
    "exam_clearance_blocked",
  ];

  return templateTypes.map((type, index) => ({
    id: `template-${index + 1}`,
    schoolId,
    templateType: type,
    templateText: getDefaultSMSTemplate(type, "School Name"),
    isActive: true,
    lastModified: Timestamp.now(),
    modifiedBy: "system",
  }));
}

/**
 * Update SMS template
 */
export async function updateSMSTemplate(
  templateId: string,
  templateText: string,
  userId: string,
): Promise<SMSTemplate> {
  const templates = await getSMSTemplates("mock-school");
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    throw new Error("Template not found");
  }

  const updated: SMSTemplate = {
    ...template,
    templateText,
    lastModified: Timestamp.now(),
    modifiedBy: userId,
  };

  return updated;
}

// ============================================================================
// PROMISE ESCALATION QUERIES
// ============================================================================

/**
 * Get promises with escalation status
 */
export async function getPromisesWithEscalation(
  query: PromiseEscalationQuery,
): Promise<PromiseWithEscalation[]> {
  // Mock implementation
  let promises = getMockPromises(query.schoolId);

  if (query.stage) {
    promises = promises.filter((p) => p.currentStage === query.stage);
  }

  if (query.overdueOnly) {
    promises = promises.filter((p) => p.daysOverdue > 0);
  }

  if (query.examBlockedOnly) {
    promises = promises.filter((p) => p.examClearanceBlocked);
  }

  if (query.needsAction) {
    const policy = await getEscalationPolicy(query.schoolId);
    promises = promises.filter((p) => {
      const next = getNextAction(p, policy);
      return next.daysUntil === 0;
    });
  }

  if (query.classId) {
    promises = promises.filter((p) => p.className === query.classId);
  }

  if (query.limit) {
    promises = promises.slice(0, query.limit);
  }

  return promises;
}

/**
 * Get single promise with escalation details
 */
export async function getPromiseEscalation(
  promiseId: string,
): Promise<PromiseWithEscalation | null> {
  const promises = getMockPromises("mock-school");
  return promises.find((p) => p.id === promiseId) || null;
}

// ============================================================================
// SMS SENDING
// ============================================================================

/**
 * Send SMS for a promise
 */
export async function sendPromiseSMS(
  input: SendSMSInput,
): Promise<EscalationNotification> {
  const promise = await getPromiseEscalation(input.promiseId);
  if (!promise) {
    throw new Error("Promise not found");
  }

  const policy = await getEscalationPolicy(promise.schoolId);

  // Check SMS limits
  if (promise.totalSMSSent >= policy.maxSMSPerPromise) {
    throw new Error(
      `SMS limit reached (${policy.maxSMSPerPromise} per promise)`,
    );
  }

  // Check time constraints
  const now = new Date();
  const hour = now.getHours();
  if (hour < policy.smsStartHour || hour >= policy.smsEndHour) {
    throw new Error(
      `SMS can only be sent between ${policy.smsStartHour}:00 and ${policy.smsEndHour}:00`,
    );
  }

  if (!policy.sendOnWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
    throw new Error("SMS sending is disabled on weekends");
  }

  // Get template
  const templates = await getSMSTemplates(promise.schoolId);
  const template = templates.find((t) => t.templateType === input.templateType);

  if (!template) {
    throw new Error("SMS template not found");
  }

  // Parse template
  const message =
    input.customMessage ||
    parseSMSTemplate(template.templateText, {
      studentName: promise.studentName,
      guardianName: promise.guardianName,
      amount: promise.promiseAmount,
      promiseDate: promise.promiseDate,
      daysOverdue: promise.daysOverdue,
      schoolName: "The School",
      balance: promise.promiseAmount - promise.paidAmount,
    });

  // Format phone
  const phone = formatUgandaPhone(promise.guardianPhone);

  // Create notification record
  const notification: EscalationNotification = {
    id: `notif-${Date.now()}`,
    type: "sms",
    templateType: input.templateType,
    recipient: phone,
    recipientType: "guardian",
    message,
    sentAt: Timestamp.now(),
    sentBy: input.senderId,
    deliveryStatus: "pending",
    hasResponse: false,
  };

  // Would integrate with SMS gateway here (Africa's Talking, etc.)
  console.log("Sending SMS:", { to: phone, message });

  // Simulate sending (would be async in real implementation)
  notification.deliveryStatus = "sent";

  return notification;
}

/**
 * Send bulk SMS for multiple promises
 */
export async function sendBulkSMS(
  promiseIds: string[],
  templateType: SMSTemplateType,
  senderId: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const promiseId of promiseIds) {
    try {
      await sendPromiseSMS({
        promiseId,
        templateType,
        senderId,
      });
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push(
        `${promiseId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return results;
}

// ============================================================================
// ESCALATION ACTIONS
// ============================================================================

/**
 * Escalate a promise to next stage
 */
export async function escalatePromise(
  input: EscalatePromiseInput,
): Promise<PromiseWithEscalation> {
  const promise = await getPromiseEscalation(input.promiseId);
  if (!promise) {
    throw new Error("Promise not found");
  }

  const previousStage = promise.currentStage;

  // Update promise
  const updated: PromiseWithEscalation = {
    ...promise,
    currentStage: input.newStage,
    updatedAt: Timestamp.now(),
  };

  // Update escalation flags
  if (input.newStage === "escalated_dos") {
    updated.hasBeenEscalatedToDOS = true;
    updated.dosEscalatedAt = Timestamp.now();
  }

  if (input.newStage === "escalated_head") {
    updated.hasBeenEscalatedToHead = true;
    updated.headEscalatedAt = Timestamp.now();
  }

  if (input.newStage === "exam_blocked") {
    updated.examClearanceBlocked = true;
    updated.examBlockedAt = Timestamp.now();
    updated.examBlockedReason = input.reason;
  }

  // Add note
  const note: PromiseNote = {
    id: `note-${Date.now()}`,
    note: `Escalated from ${previousStage} to ${input.newStage}: ${input.reason}`,
    addedBy: input.escalatedBy,
    addedByName: input.escalatedByName,
    addedAt: Timestamp.now(),
    noteType: "escalation",
  };
  updated.notes = [...updated.notes, note];

  // Send notification
  if (
    input.newStage === "escalated_dos" ||
    input.newStage === "escalated_head"
  ) {
    const internalNotif: EscalationNotification = {
      id: `notif-${Date.now()}`,
      type: "internal",
      templateType: "promise_escalated",
      recipient: input.newStage === "escalated_dos" ? "DOS" : "Headteacher",
      recipientType: input.newStage === "escalated_dos" ? "dos" : "headteacher",
      message: `Payment promise for ${promise.studentName} (UGX ${promise.promiseAmount.toLocaleString()}) requires attention. ${promise.daysOverdue} days overdue.`,
      sentAt: Timestamp.now(),
      sentBy: "system",
      deliveryStatus: "delivered",
      hasResponse: false,
    };
    updated.notifications = [...updated.notifications, internalNotif];
  }

  return updated;
}

/**
 * Block exam clearance for student
 */
export async function blockExamClearance(
  promiseId: string,
  reason: string,
  blockedBy: string,
): Promise<PromiseWithEscalation> {
  return escalatePromise({
    promiseId,
    newStage: "exam_blocked",
    reason,
    escalatedBy: blockedBy,
    escalatedByName: "System",
  });
}

/**
 * Unblock exam clearance
 */
export async function unblockExamClearance(
  promiseId: string,
  reason: string,
  unblockedBy: string,
): Promise<PromiseWithEscalation> {
  const promise = await getPromiseEscalation(promiseId);
  if (!promise) {
    throw new Error("Promise not found");
  }

  const updated: PromiseWithEscalation = {
    ...promise,
    examClearanceBlocked: false,
    updatedAt: Timestamp.now(),
  };

  // Add note
  const note: PromiseNote = {
    id: `note-${Date.now()}`,
    note: `Exam clearance unblocked: ${reason}`,
    addedBy: unblockedBy,
    addedByName: "User",
    addedAt: Timestamp.now(),
    noteType: "general",
  };
  updated.notes = [...updated.notes, note];

  return updated;
}

/**
 * Add follow-up note
 */
export async function addFollowUpNote(
  promiseId: string,
  note: string,
  addedBy: string,
  addedByName: string,
  noteType: "general" | "followup" | "response" = "followup",
): Promise<PromiseWithEscalation> {
  const promise = await getPromiseEscalation(promiseId);
  if (!promise) {
    throw new Error("Promise not found");
  }

  const newNote: PromiseNote = {
    id: `note-${Date.now()}`,
    note,
    addedBy,
    addedByName,
    addedAt: Timestamp.now(),
    noteType,
  };

  return {
    ...promise,
    notes: [...promise.notes, newNote],
    updatedAt: Timestamp.now(),
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Run escalation batch for school
 * This would typically run as a scheduled job
 */
export async function runEscalationBatch(
  schoolId: string,
  dryRun: boolean = false,
): Promise<EscalationBatch> {
  const policy = await getEscalationPolicy(schoolId);
  const promises = await getPromisesWithEscalation({
    schoolId,
    overdueOnly: true,
  });

  const batch: EscalationBatch = {
    id: `batch-${Date.now()}`,
    schoolId,
    runDate: new Date(),
    runAt: Timestamp.now(),
    promisesProcessed: 0,
    smsScheduled: 0,
    smsSent: 0,
    smsFailed: 0,
    escalationsTriggered: 0,
    examsBlocked: 0,
    actions: [],
    status: "running",
  };

  for (const promise of promises) {
    if (promise.isPaid) continue;

    batch.promisesProcessed++;

    const nextAction = getNextAction(promise, policy);
    if (nextAction.daysUntil > 0) continue;

    const action: EscalationBatchAction = {
      promiseId: promise.id,
      studentName: promise.studentName,
      action: nextAction.action,
      previousStage: promise.currentStage,
      newStage: promise.currentStage,
      success: true,
      timestamp: Timestamp.now(),
    };

    if (!dryRun) {
      try {
        switch (nextAction.action) {
          case "send_sms":
            batch.smsScheduled++;
            const templateType = getTemplateForStage(promise.currentStage);
            await sendPromiseSMS({
              promiseId: promise.id,
              templateType,
              senderId: "system",
            });
            batch.smsSent++;
            break;

          case "notify_dos":
            const newStage = determineStage(promise.daysOverdue, policy);
            await escalatePromise({
              promiseId: promise.id,
              newStage: "escalated_dos",
              reason: "Auto-escalated due to overdue promise",
              escalatedBy: "system",
              escalatedByName: "Auto-escalation",
            });
            action.newStage = "escalated_dos";
            batch.escalationsTriggered++;
            break;

          case "notify_head":
            await escalatePromise({
              promiseId: promise.id,
              newStage: "escalated_head",
              reason: "Auto-escalated due to extended overdue",
              escalatedBy: "system",
              escalatedByName: "Auto-escalation",
            });
            action.newStage = "escalated_head";
            batch.escalationsTriggered++;
            break;

          case "block_exams":
            await blockExamClearance(
              promise.id,
              "Auto-blocked due to unpaid fees",
              "system",
            );
            action.newStage = "exam_blocked";
            batch.examsBlocked++;
            break;
        }
      } catch (error) {
        action.success = false;
        action.error = error instanceof Error ? error.message : "Unknown error";
        if (nextAction.action === "send_sms") {
          batch.smsFailed++;
        }
      }
    }

    batch.actions.push(action);
  }

  batch.status = "completed";
  batch.completedAt = Timestamp.now();

  return batch;
}

/**
 * Get appropriate SMS template for stage
 */
function getTemplateForStage(stage: EscalationStage): SMSTemplateType {
  const mapping: Record<EscalationStage, SMSTemplateType> = {
    none: "promise_reminder",
    reminder: "promise_reminder",
    due_today: "promise_due_today",
    overdue_1: "promise_overdue_1",
    overdue_7: "promise_overdue_7",
    overdue_14: "promise_final_warning",
    escalated_dos: "promise_escalated",
    escalated_head: "promise_escalated",
    exam_blocked: "exam_clearance_blocked",
    defaulted: "promise_defaulted",
  };
  return mapping[stage];
}

// ============================================================================
// DASHBOARD & REPORTING
// ============================================================================

/**
 * Get escalation dashboard
 */
export async function getEscalationDashboard(
  schoolId: string,
): Promise<EscalationDashboard> {
  const promises = await getPromisesWithEscalation({ schoolId });
  const activePromises = promises.filter((p) => !p.isPaid);
  const overduePromises = activePromises.filter((p) => p.daysOverdue > 0);

  const byStage: Record<EscalationStage, number> = {
    none: 0,
    reminder: 0,
    due_today: 0,
    overdue_1: 0,
    overdue_7: 0,
    overdue_14: 0,
    escalated_dos: 0,
    escalated_head: 0,
    exam_blocked: 0,
    defaulted: 0,
  };

  for (const promise of activePromises) {
    byStage[promise.currentStage]++;
  }

  // Calculate SMS stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let smsSentToday = 0;
  let smsSentThisWeek = 0;

  for (const promise of promises) {
    for (const notif of promise.notifications) {
      if (notif.type === "sms") {
        const sentDate = notif.sentAt.toDate();
        if (sentDate >= today) smsSentToday++;
        if (sentDate >= weekAgo) smsSentThisWeek++;
      }
    }
  }

  // Get urgent follow-ups (needs action today)
  const policy = await getEscalationPolicy(schoolId);
  const urgentFollowUps = activePromises
    .filter((p) => {
      const next = getNextAction(p, policy);
      return next.daysUntil === 0;
    })
    .slice(0, 10);

  return {
    schoolId,
    asOfDate: new Date(),
    byStage,
    totalActivePromises: activePromises.length,
    totalOverdue: overduePromises.length,
    overdueAmount: overduePromises.reduce(
      (sum, p) => sum + (p.promiseAmount - p.paidAmount),
      0,
    ),
    smsSentToday,
    smsSentThisWeek,
    smsRemaining: 500 - smsSentThisWeek, // Example weekly limit
    escalatedToDOS: activePromises.filter((p) => p.hasBeenEscalatedToDOS)
      .length,
    escalatedToHead: activePromises.filter((p) => p.hasBeenEscalatedToHead)
      .length,
    examBlocked: activePromises.filter((p) => p.examClearanceBlocked).length,
    promisesFulfilledThisWeek: promises.filter((p) => {
      if (!p.isPaid || !p.paidAt) return false;
      return p.paidAt.toDate() >= weekAgo;
    }).length,
    promisesDefaultedThisWeek: promises.filter((p) => {
      if (p.currentStage !== "defaulted") return false;
      return true; // Would check date
    }).length,
    fulfillmentRate:
      promises.length > 0
        ? (promises.filter((p) => p.isPaid).length / promises.length) * 100
        : 0,
    urgentFollowUps,
  };
}

/**
 * Get guardian communication summary
 */
export async function getGuardianCommunicationSummary(
  schoolId: string,
  guardianPhone: string,
): Promise<GuardianCommunicationSummary> {
  const promises = await getPromisesWithEscalation({ schoolId });
  const guardianPromises = promises.filter(
    (p) =>
      formatUgandaPhone(p.guardianPhone) === formatUgandaPhone(guardianPhone),
  );

  if (guardianPromises.length === 0) {
    throw new Error("No promises found for this guardian");
  }

  const firstPromise = guardianPromises[0];
  const totalAmount = guardianPromises.reduce(
    (sum, p) => sum + p.promiseAmount,
    0,
  );
  const overdueAmount = guardianPromises
    .filter((p) => p.daysOverdue > 0 && !p.isPaid)
    .reduce((sum, p) => sum + (p.promiseAmount - p.paidAmount), 0);

  const smsCount = guardianPromises.reduce(
    (sum, p) => sum + p.notifications.filter((n) => n.type === "sms").length,
    0,
  );

  const lastSMS = guardianPromises
    .flatMap((p) => p.notifications.filter((n) => n.type === "sms"))
    .sort((a, b) => b.sentAt.toMillis() - a.sentAt.toMillis())[0];

  const hasResponse = guardianPromises.some((p) =>
    p.notifications.some((n) => n.hasResponse),
  );

  // Risk level
  const maxOverdue = Math.max(...guardianPromises.map((p) => p.daysOverdue));
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (maxOverdue > 21) riskLevel = "critical";
  else if (maxOverdue > 14) riskLevel = "high";
  else if (maxOverdue > 7) riskLevel = "medium";

  return {
    guardianPhone: formatUgandaPhone(guardianPhone),
    guardianName: firstPromise.guardianName,
    children: guardianPromises.map((p) => ({
      studentId: p.studentId,
      studentName: p.studentName,
      promiseAmount: p.promiseAmount,
      daysOverdue: p.daysOverdue,
    })),
    totalPromiseAmount: totalAmount,
    totalOverdueAmount: overdueAmount,
    smsCount,
    lastContactDate: lastSMS ? lastSMS.sentAt.toDate() : new Date(),
    hasResponded: hasResponse,
    riskLevel,
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockPolicy(schoolId: string): EscalationPolicy {
  return {
    schoolId,
    autoEscalationEnabled: true,
    autoSMSEnabled: true,
    autoEmailEnabled: false,
    reminderDaysBefore: 3,
    firstWarningDaysAfter: 1,
    urgentWarningDaysAfter: 7,
    finalWarningDaysAfter: 14,
    dosEscalationDaysAfter: 14,
    headEscalationDaysAfter: 21,
    examBlockDaysAfter: 21,
    defaultDaysAfter: 30,
    maxSMSPerPromise: 5,
    minDaysBetweenSMS: 3,
    smsStartHour: 8,
    smsEndHour: 18,
    sendOnWeekends: false,
    autoBlockExams: true,
    autoNotifyDOS: true,
    autoNotifyHead: true,
    preferredContactMethod: "sms",
    updatedAt: Timestamp.now(),
    updatedBy: "system",
  };
}

function getMockPromises(schoolId: string): PromiseWithEscalation[] {
  const baseDate = new Date();

  return [
    {
      id: "promise-1",
      schoolId,
      studentId: "STU001",
      studentName: "David Mugisha",
      className: "S4 Science",
      guardianName: "John Mugisha",
      guardianPhone: "0772123456",
      guardianEmail: "john.mugisha@email.com",
      promiseAmount: 850000,
      promiseDate: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      isPaid: false,
      paidAmount: 0,
      currentStage: "overdue_1",
      daysOverdue: 5,
      notifications: [],
      totalSMSSent: 1,
      hasBeenEscalatedToDOS: false,
      hasBeenEscalatedToHead: false,
      examClearanceBlocked: false,
      notes: [],
      nextActionDate: new Date(),
      nextActionType: "send_sms",
      updatedAt: Timestamp.now(),
    },
    {
      id: "promise-2",
      schoolId,
      studentId: "STU002",
      studentName: "Grace Nakato",
      className: "S3 Arts",
      guardianName: "Mary Nakato",
      guardianPhone: "0701987654",
      promiseAmount: 650000,
      promiseDate: new Date(baseDate.getTime() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      isPaid: false,
      paidAmount: 200000,
      currentStage: "escalated_dos",
      daysOverdue: 18,
      notifications: [
        {
          id: "n1",
          type: "sms",
          templateType: "promise_overdue_7",
          recipient: "+256701987654",
          recipientType: "guardian",
          message: "Payment overdue...",
          sentAt: Timestamp.now(),
          sentBy: "system",
          deliveryStatus: "delivered",
          hasResponse: false,
        },
      ],
      totalSMSSent: 3,
      hasBeenEscalatedToDOS: true,
      dosEscalatedAt: Timestamp.now(),
      hasBeenEscalatedToHead: false,
      examClearanceBlocked: false,
      notes: [],
      nextActionDate: new Date(),
      nextActionType: "notify_head",
      updatedAt: Timestamp.now(),
    },
    {
      id: "promise-3",
      schoolId,
      studentId: "STU003",
      studentName: "Peter Ochen",
      className: "S6 Science",
      guardianName: "James Ochen",
      guardianPhone: "0782555444",
      promiseAmount: 1200000,
      promiseDate: new Date(baseDate.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      isPaid: false,
      paidAmount: 0,
      currentStage: "exam_blocked",
      daysOverdue: 25,
      notifications: [],
      totalSMSSent: 5,
      hasBeenEscalatedToDOS: true,
      dosEscalatedAt: Timestamp.now(),
      hasBeenEscalatedToHead: true,
      headEscalatedAt: Timestamp.now(),
      examClearanceBlocked: true,
      examBlockedAt: Timestamp.now(),
      examBlockedReason: "Auto-blocked: 21+ days overdue",
      notes: [],
      nextActionDate: new Date(),
      nextActionType: "refer_writeoff",
      updatedAt: Timestamp.now(),
    },
    {
      id: "promise-4",
      schoolId,
      studentId: "STU004",
      studentName: "Sarah Achieng",
      className: "S2 Science",
      guardianName: "Patrick Achieng",
      guardianPhone: "0753111222",
      promiseAmount: 450000,
      promiseDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      isPaid: false,
      paidAmount: 0,
      currentStage: "none",
      daysOverdue: 0,
      notifications: [],
      totalSMSSent: 0,
      hasBeenEscalatedToDOS: false,
      hasBeenEscalatedToHead: false,
      examClearanceBlocked: false,
      notes: [],
      nextActionDate: new Date(),
      nextActionType: "send_sms",
      updatedAt: Timestamp.now(),
    },
    {
      id: "promise-5",
      schoolId,
      studentId: "STU005",
      studentName: "Michael Ssemakula",
      className: "S1 Arts",
      guardianName: "Charles Ssemakula",
      guardianPhone: "0774888999",
      promiseAmount: 380000,
      promiseDate: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      createdAt: Timestamp.now(),
      createdBy: "bursar-1",
      isPaid: true,
      paidAmount: 380000,
      paidAt: Timestamp.now(),
      currentStage: "none",
      daysOverdue: 0,
      notifications: [
        {
          id: "n2",
          type: "sms",
          templateType: "promise_reminder",
          recipient: "+256774888999",
          recipientType: "guardian",
          message: "Reminder: Payment due...",
          sentAt: Timestamp.now(),
          sentBy: "system",
          deliveryStatus: "delivered",
          hasResponse: true,
          responseReceived: "Will pay today",
          responseAt: Timestamp.now(),
        },
      ],
      totalSMSSent: 1,
      hasBeenEscalatedToDOS: false,
      hasBeenEscalatedToHead: false,
      examClearanceBlocked: false,
      notes: [],
      nextActionDate: new Date(),
      nextActionType: "create_followup",
      updatedAt: Timestamp.now(),
    },
  ];
}

export function getMockEscalationDashboard(): EscalationDashboard {
  return {
    schoolId: "mock-school",
    asOfDate: new Date(),
    byStage: {
      none: 45,
      reminder: 12,
      due_today: 8,
      overdue_1: 15,
      overdue_7: 9,
      overdue_14: 6,
      escalated_dos: 4,
      escalated_head: 2,
      exam_blocked: 3,
      defaulted: 1,
    },
    totalActivePromises: 105,
    totalOverdue: 40,
    overdueAmount: 28500000,
    smsSentToday: 12,
    smsSentThisWeek: 67,
    smsRemaining: 433,
    escalatedToDOS: 4,
    escalatedToHead: 2,
    examBlocked: 3,
    promisesFulfilledThisWeek: 18,
    promisesDefaultedThisWeek: 1,
    fulfillmentRate: 78.5,
    urgentFollowUps: [],
  };
}
