/**
 * Payment Promise Escalation Hooks
 * React hooks for managing automated SMS reminders and escalation workflows
 *
 * Features:
 * - Real-time escalation dashboard
 * - SMS sending management
 * - Policy configuration
 * - Batch processing
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PromiseWithEscalation,
  EscalationPolicy,
  SMSTemplate,
  EscalationBatch,
  EscalationDashboard,
  GuardianCommunicationSummary,
  PromiseEscalationQuery,
  EscalationStage,
  SMSTemplateType,
  EscalationNotification,
  getStageInfo,
  getTemplateDescription,
  calculateDaysOverdue,
  formatUgandaPhone,
} from "@/types/escalation";
import {
  getEscalationPolicy,
  updateEscalationPolicy,
  getSMSTemplates,
  updateSMSTemplate,
  getPromisesWithEscalation,
  getPromiseEscalation,
  sendPromiseSMS,
  sendBulkSMS,
  escalatePromise,
  blockExamClearance,
  unblockExamClearance,
  addFollowUpNote,
  runEscalationBatch,
  getEscalationDashboard,
  getGuardianCommunicationSummary,
  getMockEscalationDashboard,
} from "@/lib/services/escalation.service";

// Re-export helper functions for component use
export {
  getStageInfo,
  getTemplateDescription,
  calculateDaysOverdue,
  formatUgandaPhone,
};

// ============================================================================
// DASHBOARD HOOK
// ============================================================================

/**
 * Hook for escalation dashboard
 */
export function useEscalationDashboard(schoolId: string) {
  const [dashboard, setDashboard] = useState<EscalationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getEscalationDashboard(schoolId);
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      // Fallback to mock
      setDashboard(getMockEscalationDashboard());
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Stage distribution for charts
  const stageDistribution = useMemo(() => {
    if (!dashboard) return [];

    return Object.entries(dashboard.byStage)
      .filter(([_, count]) => count > 0)
      .map(([stage, count]) => {
        const info = getStageInfo(stage as EscalationStage);
        return {
          stage: stage as EscalationStage,
          label: info.label,
          count,
          color: info.color,
        };
      })
      .sort(
        (a, b) =>
          getStageInfo(b.stage).severity - getStageInfo(a.stage).severity,
      );
  }, [dashboard]);

  // Key alerts
  const alerts = useMemo(() => {
    if (!dashboard) return [];

    const alerts: { type: "warning" | "error" | "info"; message: string }[] =
      [];

    if (dashboard.examBlocked > 0) {
      alerts.push({
        type: "error",
        message: `${dashboard.examBlocked} students blocked from exams`,
      });
    }

    if (dashboard.escalatedToHead > 0) {
      alerts.push({
        type: "warning",
        message: `${dashboard.escalatedToHead} promises escalated to Headteacher`,
      });
    }

    if (dashboard.smsRemaining < 50) {
      alerts.push({
        type: "warning",
        message: `Low SMS balance: ${dashboard.smsRemaining} remaining`,
      });
    }

    if (dashboard.urgentFollowUps.length > 0) {
      alerts.push({
        type: "info",
        message: `${dashboard.urgentFollowUps.length} promises need immediate follow-up`,
      });
    }

    return alerts;
  }, [dashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
    stageDistribution,
    alerts,
  };
}

// ============================================================================
// PROMISES LIST HOOK
// ============================================================================

/**
 * Hook for querying promises with escalation
 */
export function useEscalationPromises(query: PromiseEscalationQuery) {
  const [promises, setPromises] = useState<PromiseWithEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromises = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPromisesWithEscalation(query);
      setPromises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promises");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(query)]);

  useEffect(() => {
    fetchPromises();
  }, [fetchPromises]);

  // Group by stage
  const byStage = useMemo(() => {
    const grouped: Record<EscalationStage, PromiseWithEscalation[]> = {
      none: [],
      reminder: [],
      due_today: [],
      overdue_1: [],
      overdue_7: [],
      overdue_14: [],
      escalated_dos: [],
      escalated_head: [],
      exam_blocked: [],
      defaulted: [],
    };

    for (const promise of promises) {
      grouped[promise.currentStage].push(promise);
    }

    return grouped;
  }, [promises]);

  // Group by class
  const byClass = useMemo(() => {
    const grouped: Record<string, PromiseWithEscalation[]> = {};

    for (const promise of promises) {
      if (!grouped[promise.className]) {
        grouped[promise.className] = [];
      }
      grouped[promise.className].push(promise);
    }

    return grouped;
  }, [promises]);

  // Statistics
  const stats = useMemo(() => {
    const overduePromises = promises.filter(
      (p) => p.daysOverdue > 0 && !p.isPaid,
    );
    return {
      total: promises.length,
      overdue: overduePromises.length,
      overdueAmount: overduePromises.reduce(
        (sum, p) => sum + (p.promiseAmount - p.paidAmount),
        0,
      ),
      avgDaysOverdue:
        overduePromises.length > 0
          ? Math.round(
              overduePromises.reduce((sum, p) => sum + p.daysOverdue, 0) /
                overduePromises.length,
            )
          : 0,
    };
  }, [promises]);

  return {
    promises,
    loading,
    error,
    refresh: fetchPromises,
    byStage,
    byClass,
    stats,
  };
}

// ============================================================================
// SINGLE PROMISE HOOK
// ============================================================================

/**
 * Hook for single promise escalation details
 */
export function usePromiseEscalation(promiseId: string) {
  const [promise, setPromise] = useState<PromiseWithEscalation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromise = useCallback(async () => {
    if (!promiseId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getPromiseEscalation(promiseId);
      setPromise(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promise");
    } finally {
      setLoading(false);
    }
  }, [promiseId]);

  useEffect(() => {
    fetchPromise();
  }, [fetchPromise]);

  // Stage info
  const stageInfo = useMemo(() => {
    if (!promise) return null;
    return getStageInfo(promise.currentStage);
  }, [promise]);

  // Timeline for display
  const timeline = useMemo(() => {
    if (!promise) return [];

    const items: {
      type: "sms" | "email" | "note" | "escalation" | "payment";
      date: Date;
      title: string;
      description: string;
      icon: string;
    }[] = [];

    // Add notifications
    for (const notif of promise.notifications) {
      items.push({
        type:
          notif.type === "sms"
            ? "sms"
            : notif.type === "email"
              ? "email"
              : "note",
        date: notif.sentAt.toDate(),
        title: notif.type === "sms" ? "SMS Sent" : "Notification",
        description: notif.message.substring(0, 100) + "...",
        icon: notif.type === "sms" ? "sms" : "mail",
      });
    }

    // Add notes
    for (const note of promise.notes) {
      items.push({
        type: note.noteType === "escalation" ? "escalation" : "note",
        date: note.addedAt.toDate(),
        title: note.noteType === "escalation" ? "Escalation" : "Note",
        description: note.note,
        icon: note.noteType === "escalation" ? "arrow_upward" : "note",
      });
    }

    // Sort by date descending
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [promise]);

  return {
    promise,
    loading,
    error,
    refresh: fetchPromise,
    stageInfo,
    timeline,
  };
}

// ============================================================================
// SMS ACTIONS HOOK
// ============================================================================

/**
 * Hook for SMS operations
 */
export function useSMSActions(schoolId: string) {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Send single SMS
  const sendSMS = useCallback(
    async (
      promiseId: string,
      templateType: SMSTemplateType,
      senderId: string,
      customMessage?: string,
    ): Promise<EscalationNotification | null> => {
      setSending(true);
      setLastResult(null);

      try {
        const notification = await sendPromiseSMS({
          promiseId,
          templateType,
          customMessage,
          senderId,
        });

        setLastResult({
          success: true,
          message: "SMS sent successfully",
        });

        return notification;
      } catch (error) {
        setLastResult({
          success: false,
          message:
            error instanceof Error ? error.message : "Failed to send SMS",
        });
        return null;
      } finally {
        setSending(false);
      }
    },
    [],
  );

  // Send bulk SMS
  const sendBulk = useCallback(
    async (
      promiseIds: string[],
      templateType: SMSTemplateType,
      senderId: string,
    ) => {
      setSending(true);
      setLastResult(null);

      try {
        const result = await sendBulkSMS(promiseIds, templateType, senderId);

        setLastResult({
          success: result.failed === 0,
          message: `Sent ${result.sent}/${promiseIds.length} SMS (${result.failed} failed)`,
        });

        return result;
      } catch (error) {
        setLastResult({
          success: false,
          message: error instanceof Error ? error.message : "Bulk SMS failed",
        });
        return {
          sent: 0,
          failed: promiseIds.length,
          errors: ["Bulk operation failed"],
        };
      } finally {
        setSending(false);
      }
    },
    [],
  );

  return {
    sending,
    lastResult,
    sendSMS,
    sendBulk,
    clearResult: () => setLastResult(null),
  };
}

// ============================================================================
// ESCALATION ACTIONS HOOK
// ============================================================================

/**
 * Hook for escalation operations
 */
export function useEscalationActions() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escalate promise
  const escalate = useCallback(
    async (
      promiseId: string,
      newStage: EscalationStage,
      reason: string,
      userId: string,
      userName: string,
    ): Promise<PromiseWithEscalation | null> => {
      setProcessing(true);
      setError(null);

      try {
        const result = await escalatePromise({
          promiseId,
          newStage,
          reason,
          escalatedBy: userId,
          escalatedByName: userName,
        });
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Escalation failed");
        return null;
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  // Block exams
  const blockExams = useCallback(
    async (promiseId: string, reason: string, userId: string) => {
      setProcessing(true);
      setError(null);

      try {
        return await blockExamClearance(promiseId, reason, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to block exams");
        return null;
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  // Unblock exams
  const unblockExams = useCallback(
    async (promiseId: string, reason: string, userId: string) => {
      setProcessing(true);
      setError(null);

      try {
        return await unblockExamClearance(promiseId, reason, userId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to unblock exams",
        );
        return null;
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  // Add note
  const addNote = useCallback(
    async (
      promiseId: string,
      note: string,
      userId: string,
      userName: string,
      noteType: "general" | "followup" | "response" = "followup",
    ) => {
      setProcessing(true);
      setError(null);

      try {
        return await addFollowUpNote(
          promiseId,
          note,
          userId,
          userName,
          noteType,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add note");
        return null;
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  return {
    processing,
    error,
    escalate,
    blockExams,
    unblockExams,
    addNote,
    clearError: () => setError(null),
  };
}

// ============================================================================
// POLICY HOOK
// ============================================================================

/**
 * Hook for escalation policy management
 */
export function useEscalationPolicy(schoolId: string) {
  const [policy, setPolicy] = useState<EscalationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getEscalationPolicy(schoolId);
      setPolicy(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  // Update policy
  const updatePolicy = useCallback(
    async (
      updates: Partial<EscalationPolicy>,
      userId: string,
    ): Promise<boolean> => {
      if (!schoolId) return false;

      setSaving(true);
      setError(null);

      try {
        const updated = await updateEscalationPolicy(schoolId, updates, userId);
        setPolicy(updated);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update policy",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [schoolId],
  );

  return {
    policy,
    loading,
    saving,
    error,
    updatePolicy,
    refresh: fetchPolicy,
  };
}

// ============================================================================
// SMS TEMPLATES HOOK
// ============================================================================

/**
 * Hook for SMS template management
 */
export function useSMSTemplates(schoolId: string) {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getSMSTemplates(schoolId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Update template
  const updateTemplate = useCallback(
    async (
      templateId: string,
      newText: string,
      userId: string,
    ): Promise<boolean> => {
      setSaving(true);
      setError(null);

      try {
        const updated = await updateSMSTemplate(templateId, newText, userId);
        setTemplates((prev) =>
          prev.map((t) => (t.id === templateId ? updated : t)),
        );
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update template",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Get template by type
  const getTemplate = useCallback(
    (type: SMSTemplateType): SMSTemplate | undefined => {
      return templates.find((t) => t.templateType === type);
    },
    [templates],
  );

  return {
    templates,
    loading,
    saving,
    error,
    updateTemplate,
    getTemplate,
    refresh: fetchTemplates,
  };
}

// ============================================================================
// BATCH PROCESSING HOOK
// ============================================================================

/**
 * Hook for batch escalation processing
 */
export function useEscalationBatch(schoolId: string) {
  const [batch, setBatch] = useState<EscalationBatch | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run batch (dry run first)
  const runBatch = useCallback(
    async (dryRun: boolean = true): Promise<EscalationBatch | null> => {
      setRunning(true);
      setError(null);

      try {
        const result = await runEscalationBatch(schoolId, dryRun);
        setBatch(result);
        return result;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Batch processing failed",
        );
        return null;
      } finally {
        setRunning(false);
      }
    },
    [schoolId],
  );

  // Preview actions
  const preview = useCallback(async () => {
    return runBatch(true);
  }, [runBatch]);

  // Execute batch
  const execute = useCallback(async () => {
    return runBatch(false);
  }, [runBatch]);

  return {
    batch,
    running,
    error,
    preview,
    execute,
    clearBatch: () => setBatch(null),
  };
}

// ============================================================================
// GUARDIAN COMMUNICATION HOOK
// ============================================================================

/**
 * Hook for guardian communication history
 */
export function useGuardianCommunication(
  schoolId: string,
  guardianPhone?: string,
) {
  const [summary, setSummary] = useState<GuardianCommunicationSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (phone: string) => {
      setLoading(true);
      setError(null);

      try {
        const data = await getGuardianCommunicationSummary(schoolId, phone);
        setSummary(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load guardian info",
        );
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [schoolId],
  );

  useEffect(() => {
    if (guardianPhone) {
      fetchSummary(guardianPhone);
    }
  }, [guardianPhone, fetchSummary]);

  // Risk color
  const riskColor = useMemo(() => {
    if (!summary) return "gray";
    const colors = {
      low: "green",
      medium: "yellow",
      high: "orange",
      critical: "red",
    };
    return colors[summary.riskLevel];
  }, [summary]);

  return {
    summary,
    loading,
    error,
    riskColor,
    refresh: (phone: string) => fetchSummary(phone),
  };
}

// ============================================================================
// OVERDUE PROMISES HOOK (CONVENIENCE)
// ============================================================================

/**
 * Hook specifically for overdue promises
 */
export function useOverduePromises(schoolId: string) {
  return useEscalationPromises({
    schoolId,
    overdueOnly: true,
  });
}

// ============================================================================
// URGENT ACTION HOOK (CONVENIENCE)
// ============================================================================

/**
 * Hook for promises needing immediate action
 */
export function useUrgentPromises(schoolId: string) {
  return useEscalationPromises({
    schoolId,
    needsAction: true,
    limit: 10,
  });
}
