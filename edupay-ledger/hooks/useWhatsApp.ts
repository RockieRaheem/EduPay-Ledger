/**
 * WhatsApp Integration Hooks
 * React hooks for WhatsApp communication management
 *
 * Features:
 * - Configuration management
 * - Message sending
 * - Session management
 * - Analytics
 * - Template management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  WhatsAppConfig,
  WhatsAppSession,
  WhatsAppTemplate,
  WhatsAppAnalytics,
  ScheduledWhatsAppMessage,
  OutgoingWhatsAppMessage,
  SendBalanceInput,
  SendReceiptInput,
  SendBulkReminderInput,
  TemplateType,
  WhatsAppCommand,
  parseCommand,
  formatPhoneForWhatsApp,
  isValidUgandaPhone,
  getMessageStatusDisplay,
  generateHelpMessage,
  COMMAND_DEFINITIONS,
} from '@/types/whatsapp';
import {
  getWhatsAppConfig,
  updateWhatsAppConfig,
  testWhatsAppConnection,
  getOrCreateSession,
  sendBalanceMessage,
  sendReceiptMessage,
  sendBulkReminders,
  getWhatsAppTemplates,
  createWhatsAppTemplate,
  getWhatsAppAnalytics,
  getScheduledMessages,
  scheduleMessage,
  cancelScheduledMessage,
  getMockWhatsAppDashboard,
} from '@/lib/services/whatsapp.service';

// Re-export helper functions
export {
  parseCommand,
  formatPhoneForWhatsApp,
  isValidUgandaPhone,
  getMessageStatusDisplay,
  generateHelpMessage,
  COMMAND_DEFINITIONS,
};

// ============================================================================
// CONFIGURATION HOOK
// ============================================================================

/**
 * Hook for WhatsApp configuration management
 */
export function useWhatsAppConfig(schoolId: string) {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getWhatsAppConfig(schoolId);
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Update configuration
  const updateConfig = useCallback(async (
    updates: Partial<WhatsAppConfig>,
    userId: string
  ): Promise<boolean> => {
    if (!schoolId) return false;
    
    setSaving(true);
    setError(null);
    
    try {
      const updated = await updateWhatsAppConfig(schoolId, updates, userId);
      setConfig(updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config');
      return false;
    } finally {
      setSaving(false);
    }
  }, [schoolId]);

  // Test connection
  const testConnection = useCallback(async () => {
    if (!schoolId) return null;
    
    try {
      return await testWhatsAppConnection(schoolId);
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }, [schoolId]);

  // Feature flags
  const features = useMemo(() => {
    if (!config) return null;
    return config.features;
  }, [config]);

  return {
    config,
    loading,
    saving,
    error,
    updateConfig,
    testConnection,
    features,
    refresh: fetchConfig,
  };
}

// ============================================================================
// DASHBOARD HOOK
// ============================================================================

/**
 * Hook for WhatsApp dashboard
 */
export function useWhatsAppDashboard(schoolId: string) {
  const [dashboard, setDashboard] = useState<ReturnType<typeof getMockWhatsAppDashboard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Would fetch real dashboard data
      const data = getMockWhatsAppDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboard,
    loading,
    error,
    refresh: fetchDashboard,
  };
}

// ============================================================================
// MESSAGE SENDING HOOK
// ============================================================================

/**
 * Hook for sending WhatsApp messages
 */
export function useWhatsAppSender(schoolId: string) {
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  // Send balance message
  const sendBalance = useCallback(async (
    input: SendBalanceInput
  ): Promise<OutgoingWhatsAppMessage | null> => {
    if (!isValidUgandaPhone(input.phoneNumber)) {
      setLastResult({
        success: false,
        message: 'Invalid phone number format',
      });
      return null;
    }
    
    setSending(true);
    setLastResult(null);
    
    try {
      const result = await sendBalanceMessage(input);
      setLastResult({
        success: true,
        message: 'Balance message sent successfully',
        messageId: result.id,
      });
      return result;
    } catch (err) {
      setLastResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send message',
      });
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  // Send receipt
  const sendReceipt = useCallback(async (
    input: SendReceiptInput
  ): Promise<OutgoingWhatsAppMessage | null> => {
    if (!isValidUgandaPhone(input.phoneNumber)) {
      setLastResult({
        success: false,
        message: 'Invalid phone number format',
      });
      return null;
    }
    
    setSending(true);
    setLastResult(null);
    
    try {
      const result = await sendReceiptMessage(input);
      setLastResult({
        success: true,
        message: 'Receipt sent successfully',
        messageId: result.id,
      });
      return result;
    } catch (err) {
      setLastResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send receipt',
      });
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  // Send bulk reminders
  const sendBulk = useCallback(async (
    input: SendBulkReminderInput
  ) => {
    setSending(true);
    setLastResult(null);
    
    try {
      const results = await sendBulkReminders(input);
      setLastResult({
        success: results.failed === 0,
        message: `Sent ${results.sent} messages (${results.failed} failed)`,
      });
      return results;
    } catch (err) {
      setLastResult({
        success: false,
        message: err instanceof Error ? err.message : 'Bulk send failed',
      });
      return { sent: 0, failed: 0, errors: ['Operation failed'] };
    } finally {
      setSending(false);
    }
  }, []);

  return {
    sending,
    lastResult,
    sendBalance,
    sendReceipt,
    sendBulk,
    clearResult: () => setLastResult(null),
  };
}

// ============================================================================
// TEMPLATES HOOK
// ============================================================================

/**
 * Hook for WhatsApp template management
 */
export function useWhatsAppTemplates(schoolId: string) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getWhatsAppTemplates(schoolId);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Get template by name
  const getTemplate = useCallback((name: string): WhatsAppTemplate | undefined => {
    return templates.find(t => t.templateName === name);
  }, [templates]);

  // Group by status
  const byStatus = useMemo(() => {
    return {
      approved: templates.filter(t => t.status === 'APPROVED'),
      pending: templates.filter(t => t.status === 'PENDING'),
      rejected: templates.filter(t => t.status === 'REJECTED'),
    };
  }, [templates]);

  // Create new template
  const createTemplate = useCallback(async (
    template: Omit<WhatsAppTemplate, 'id' | 'status' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): Promise<WhatsAppTemplate | null> => {
    try {
      const created = await createWhatsAppTemplate(template);
      setTemplates(prev => [...prev, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
      return null;
    }
  }, []);

  return {
    templates,
    loading,
    error,
    getTemplate,
    byStatus,
    createTemplate,
    refresh: fetchTemplates,
  };
}

// ============================================================================
// ANALYTICS HOOK
// ============================================================================

/**
 * Hook for WhatsApp analytics
 */
export function useWhatsAppAnalytics(
  schoolId: string,
  period: 'daily' | 'weekly' | 'monthly' = 'weekly'
) {
  const [analytics, setAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  const fetchAnalytics = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getWhatsAppAnalytics(schoolId, selectedPeriod);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedPeriod]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Delivery metrics
  const deliveryMetrics = useMemo(() => {
    if (!analytics) return null;
    
    const total = analytics.totalOutbound;
    return {
      deliveryRate: total > 0 ? (analytics.totalDelivered / total) * 100 : 0,
      readRate: total > 0 ? (analytics.totalRead / total) * 100 : 0,
      failRate: total > 0 ? (analytics.totalFailed / total) * 100 : 0,
    };
  }, [analytics]);

  // Chart data
  const chartData = useMemo(() => {
    if (!analytics) return null;
    
    return {
      messageFlow: [
        { name: 'Inbound', value: analytics.totalInbound },
        { name: 'Outbound', value: analytics.totalOutbound },
      ],
      deliveryStatus: [
        { name: 'Delivered', value: analytics.totalDelivered },
        { name: 'Read', value: analytics.totalRead },
        { name: 'Failed', value: analytics.totalFailed },
      ],
      byType: Object.entries(analytics.byType).map(([key, value]) => ({
        name: key.replace(/([A-Z])/g, ' $1').trim(),
        value,
      })),
    };
  }, [analytics]);

  return {
    analytics,
    loading,
    error,
    deliveryMetrics,
    chartData,
    selectedPeriod,
    setSelectedPeriod,
    refresh: fetchAnalytics,
  };
}

// ============================================================================
// SCHEDULED MESSAGES HOOK
// ============================================================================

/**
 * Hook for scheduled WhatsApp messages
 */
export function useScheduledMessages(schoolId: string) {
  const [messages, setMessages] = useState<ScheduledWhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!schoolId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getScheduledMessages(schoolId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled messages');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Schedule new message
  const schedule = useCallback(async (
    message: Omit<ScheduledWhatsAppMessage, 'id' | 'status' | 'createdAt'>
  ): Promise<ScheduledWhatsAppMessage | null> => {
    try {
      const scheduled = await scheduleMessage(message);
      setMessages(prev => [...prev, scheduled]);
      return scheduled;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule message');
      return null;
    }
  }, []);

  // Cancel scheduled message
  const cancel = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      await cancelScheduledMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel message');
      return false;
    }
  }, []);

  // Group by status
  const byStatus = useMemo(() => {
    return {
      scheduled: messages.filter(m => m.status === 'scheduled'),
      processing: messages.filter(m => m.status === 'processing'),
      completed: messages.filter(m => m.status === 'completed'),
    };
  }, [messages]);

  return {
    messages,
    loading,
    error,
    schedule,
    cancel,
    byStatus,
    refresh: fetchMessages,
  };
}

// ============================================================================
// SESSION HOOK
// ============================================================================

/**
 * Hook for WhatsApp session management
 */
export function useWhatsAppSession(schoolId: string, phoneNumber?: string) {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async (phone: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getOrCreateSession(schoolId, phone);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (phoneNumber) {
      fetchSession(phoneNumber);
    }
  }, [phoneNumber, fetchSession]);

  return {
    session,
    loading,
    error,
    lookup: fetchSession,
  };
}

// ============================================================================
// COMMAND PREVIEW HOOK
// ============================================================================

/**
 * Hook for previewing WhatsApp commands
 */
export function useCommandPreview() {
  const [command, setCommand] = useState<WhatsAppCommand | null>(null);
  const [args, setArgs] = useState<string[]>([]);

  const parseInput = useCallback((text: string) => {
    const result = parseCommand(text);
    setCommand(result.command);
    setArgs(result.args);
    return result;
  }, []);

  const commandInfo = useMemo(() => {
    if (!command) return null;
    return COMMAND_DEFINITIONS[command];
  }, [command]);

  return {
    command,
    args,
    commandInfo,
    parseInput,
    clear: () => {
      setCommand(null);
      setArgs([]);
    },
  };
}

// ============================================================================
// PHONE VALIDATION HOOK
// ============================================================================

/**
 * Hook for phone number validation
 */
export function usePhoneValidation() {
  const [phone, setPhone] = useState('');
  const [formatted, setFormatted] = useState('');
  const [isValid, setIsValid] = useState(false);

  const validate = useCallback((input: string) => {
    setPhone(input);
    const valid = isValidUgandaPhone(input);
    setIsValid(valid);
    
    if (valid) {
      setFormatted(formatPhoneForWhatsApp(input));
    } else {
      setFormatted('');
    }
    
    return valid;
  }, []);

  return {
    phone,
    formatted,
    isValid,
    validate,
    clear: () => {
      setPhone('');
      setFormatted('');
      setIsValid(false);
    },
  };
}

// ============================================================================
// BULK RECIPIENT HOOK
// ============================================================================

/**
 * Hook for managing bulk message recipients
 */
export function useBulkRecipients(schoolId: string) {
  const [recipients, setRecipients] = useState<{
    phone: string;
    studentName: string;
    balance: number;
    selected: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    classId: '',
    minimumBalance: 0,
    daysOverdue: 0,
  });

  // Fetch recipients based on filter
  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    
    // Would fetch from API based on filter
    const mockRecipients = [
      { phone: '0772123456', studentName: 'David Mugisha', balance: 850000, selected: true },
      { phone: '0701987654', studentName: 'Grace Nakato', balance: 450000, selected: true },
      { phone: '0753111222', studentName: 'Sarah Achieng', balance: 1200000, selected: true },
      { phone: '0774888999', studentName: 'Michael Ssemakula', balance: 380000, selected: true },
    ].filter(r => r.balance >= filter.minimumBalance);
    
    setRecipients(mockRecipients);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // Toggle selection
  const toggleSelection = useCallback((phone: string) => {
    setRecipients(prev => 
      prev.map(r => r.phone === phone ? { ...r, selected: !r.selected } : r)
    );
  }, []);

  // Select/deselect all
  const selectAll = useCallback((selected: boolean) => {
    setRecipients(prev => prev.map(r => ({ ...r, selected })));
  }, []);

  // Selected counts
  const counts = useMemo(() => ({
    total: recipients.length,
    selected: recipients.filter(r => r.selected).length,
    totalBalance: recipients.filter(r => r.selected).reduce((sum, r) => sum + r.balance, 0),
  }), [recipients]);

  return {
    recipients,
    loading,
    filter,
    setFilter,
    toggleSelection,
    selectAll,
    counts,
    selectedPhones: recipients.filter(r => r.selected).map(r => r.phone),
    refresh: fetchRecipients,
  };
}
