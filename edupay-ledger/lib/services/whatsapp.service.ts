/**
 * WhatsApp Integration Service
 * Handles WhatsApp Business API integration for fee queries
 *
 * Features:
 * - Balance inquiries via keyword
 * - Receipt delivery
 * - Statement generation
 * - Bulk reminders
 * - Session management
 */

import { Timestamp } from 'firebase/firestore';
import {
  IncomingWhatsAppMessage,
  OutgoingWhatsAppMessage,
  WhatsAppSession,
  WhatsAppConfig,
  WhatsAppTemplate,
  WhatsAppAnalytics,
  ScheduledWhatsAppMessage,
  SendBalanceInput,
  SendReceiptInput,
  SendStatementInput,
  SendBulkReminderInput,
  BalanceResponse,
  ReceiptResponse,
  WhatsAppCommand,
  MessageContent,
  TextContent,
  InteractiveContent,
  TemplateType,
  parseCommand,
  formatBalanceMessage,
  formatReceiptMessage,
  generateHelpMessage,
  generateMenuContent,
  formatPhoneForWhatsApp,
  SessionState,
  WhatsAppMessageStatus,
} from '@/types/whatsapp';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get WhatsApp configuration for school
 */
export async function getWhatsAppConfig(schoolId: string): Promise<WhatsAppConfig> {
  // Mock implementation - would fetch from Firestore
  return getMockConfig(schoolId);
}

/**
 * Update WhatsApp configuration
 */
export async function updateWhatsAppConfig(
  schoolId: string,
  updates: Partial<WhatsAppConfig>,
  userId: string
): Promise<WhatsAppConfig> {
  const current = await getWhatsAppConfig(schoolId);
  
  const updated: WhatsAppConfig = {
    ...current,
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };
  
  // Would save to Firestore
  console.log('Updated WhatsApp config:', updated);
  
  return updated;
}

/**
 * Test WhatsApp API connection
 */
export async function testWhatsAppConnection(schoolId: string): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const config = await getWhatsAppConfig(schoolId);
  
  if (!config.isActive) {
    return { success: false, message: 'WhatsApp integration is not active' };
  }
  
  // Would actually test API connection
  const startTime = Date.now();
  
  // Simulate API test
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const latencyMs = Date.now() - startTime;
  
  return {
    success: true,
    message: 'Connection successful',
    latencyMs,
  };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get or create session for phone number
 */
export async function getOrCreateSession(
  schoolId: string,
  phoneNumber: string
): Promise<WhatsAppSession> {
  const formattedPhone = formatPhoneForWhatsApp(phoneNumber);
  
  // Would check Firestore for existing session
  const existingSession = await findSession(schoolId, formattedPhone);
  
  if (existingSession) {
    return {
      ...existingSession,
      lastActivityAt: Timestamp.now(),
    };
  }
  
  // Create new session
  const newSession: WhatsAppSession = {
    id: `session-${Date.now()}`,
    schoolId,
    phoneNumber: formattedPhone,
    linkedStudentIds: [],
    isVerified: false,
    pinAttempts: 0,
    state: 'idle',
    lastActivityAt: Timestamp.now(),
    sessionStartedAt: Timestamp.now(),
    messageCount: 0,
    preferredLanguage: 'en',
    receiveNotifications: true,
    receiveReceipts: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Would save to Firestore
  return newSession;
}

/**
 * Find existing session
 */
async function findSession(
  schoolId: string,
  phoneNumber: string
): Promise<WhatsAppSession | null> {
  // Mock - would query Firestore
  return null;
}

/**
 * Update session state
 */
export async function updateSessionState(
  sessionId: string,
  state: SessionState,
  stateData?: Record<string, unknown>
): Promise<WhatsAppSession> {
  // Would update Firestore
  return {
    id: sessionId,
    schoolId: 'mock-school',
    phoneNumber: '256771234567',
    linkedStudentIds: [],
    isVerified: true,
    pinAttempts: 0,
    state,
    stateData,
    lastActivityAt: Timestamp.now(),
    sessionStartedAt: Timestamp.now(),
    messageCount: 1,
    preferredLanguage: 'en',
    receiveNotifications: true,
    receiveReceipts: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Verify PIN for session
 */
export async function verifySessionPIN(
  sessionId: string,
  pin: string
): Promise<{ verified: boolean; attemptsRemaining: number }> {
  // Would verify against stored hash
  // For demo, accept PIN "1234"
  const isValid = pin === '1234';
  
  if (isValid) {
    // Would update session as verified
    return { verified: true, attemptsRemaining: 3 };
  }
  
  // Would increment attempts
  return { verified: false, attemptsRemaining: 2 };
}

/**
 * Link student to session
 */
export async function linkStudentToSession(
  sessionId: string,
  studentId: string,
  guardianId: string
): Promise<WhatsAppSession> {
  // Would update Firestore
  return {
    id: sessionId,
    schoolId: 'mock-school',
    phoneNumber: '256771234567',
    guardianId,
    linkedStudentIds: [studentId],
    isVerified: true,
    pinAttempts: 0,
    state: 'main_menu',
    lastActivityAt: Timestamp.now(),
    sessionStartedAt: Timestamp.now(),
    messageCount: 1,
    preferredLanguage: 'en',
    receiveNotifications: true,
    receiveReceipts: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Process incoming WhatsApp message
 */
export async function processIncomingMessage(
  message: IncomingWhatsAppMessage
): Promise<OutgoingWhatsAppMessage | null> {
  const session = await getOrCreateSession(message.schoolId, message.from);
  const config = await getWhatsAppConfig(message.schoolId);
  
  // Check if within operating hours
  const hour = new Date().getHours();
  if (hour < config.operatingHoursStart || hour >= config.operatingHoursEnd) {
    return createTextResponse(message, session, config.outOfHoursMessage);
  }
  
  // Parse command
  const text = message.text || message.buttonPayload || message.listSelection?.id || '';
  const { command, args } = parseCommand(text);
  
  // Handle based on session state and command
  if (session.state === 'awaiting_pin') {
    return handlePINEntry(message, session, text);
  }
  
  if (!command) {
    return handleUnknownMessage(message, session);
  }
  
  // Check verification requirement
  if (requiresVerification(command) && !session.isVerified && config.requirePIN) {
    await updateSessionState(session.id, 'awaiting_pin', { pendingCommand: command, args });
    return createTextResponse(
      message,
      session,
      '🔐 Please enter your 4-digit PIN to continue:'
    );
  }
  
  // Handle command
  switch (command) {
    case 'BALANCE':
    case 'BAL':
      return handleBalanceInquiry(message, session);
    case 'FEES':
      return handleFeeBreakdown(message, session);
    case 'RECEIPT':
      return handleReceiptRequest(message, session);
    case 'STATEMENT':
      return handleStatementRequest(message, session);
    case 'HISTORY':
      return handlePaymentHistory(message, session);
    case 'HELP':
      return handleHelp(message, session);
    case 'MENU':
      return handleMenu(message, session);
    case 'PAY':
      return handlePaymentInstructions(message, session);
    case 'STOP':
      return handleOptOut(message, session);
    case 'PIN':
      return handlePinSetup(message, session);
    default:
      return handleUnknownMessage(message, session);
  }
}

/**
 * Check if command requires verification
 */
function requiresVerification(command: WhatsAppCommand): boolean {
  const protectedCommands: WhatsAppCommand[] = [
    'BALANCE', 'BAL', 'FEES', 'RECEIPT', 'STATEMENT', 'HISTORY', 'PAY'
  ];
  return protectedCommands.includes(command);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handlePINEntry(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession,
  pin: string
): Promise<OutgoingWhatsAppMessage> {
  const result = await verifySessionPIN(session.id, pin);
  
  if (result.verified) {
    await updateSessionState(session.id, 'main_menu');
    return createTextResponse(
      message,
      session,
      '✅ PIN verified! ' + generateHelpMessage()
    );
  }
  
  if (result.attemptsRemaining === 0) {
    return createTextResponse(
      message,
      session,
      '🔒 Too many incorrect attempts. Account locked for 30 minutes.'
    );
  }
  
  return createTextResponse(
    message,
    session,
    `❌ Incorrect PIN. ${result.attemptsRemaining} attempts remaining.`
  );
}

async function handleBalanceInquiry(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  // Get balance for linked student
  const studentId = session.linkedStudentIds[0];
  
  if (!studentId) {
    return createTextResponse(
      message,
      session,
      '⚠️ No student linked to this number. Please contact the school to link your account.'
    );
  }
  
  // Would fetch from database
  const balanceData = getMockBalanceData(studentId);
  const formattedMessage = formatBalanceMessage(balanceData);
  
  return createTextResponse(message, session, formattedMessage);
}

async function handleFeeBreakdown(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  const studentId = session.linkedStudentIds[0];
  
  if (!studentId) {
    return createTextResponse(
      message,
      session,
      '⚠️ No student linked to this number.'
    );
  }
  
  // Would fetch detailed breakdown
  const balanceData = getMockBalanceData(studentId);
  
  let message_text = `📋 *Fee Breakdown for ${balanceData.studentName}*\n\n`;
  
  if (balanceData.breakdown) {
    for (const item of balanceData.breakdown) {
      const balance = item.amount - item.paid;
      message_text += `*${item.category}*\n`;
      message_text += `  Fee: UGX ${item.amount.toLocaleString()}\n`;
      message_text += `  Paid: UGX ${item.paid.toLocaleString()}\n`;
      message_text += `  Balance: UGX ${balance.toLocaleString()}\n\n`;
    }
  }
  
  message_text += `━━━━━━━━━━━━━━━━━━\n`;
  message_text += `*Total Balance: UGX ${balanceData.balance.toLocaleString()}*`;
  
  return createTextResponse(message, session, message_text);
}

async function handleReceiptRequest(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  const studentId = session.linkedStudentIds[0];
  
  if (!studentId) {
    return createTextResponse(
      message,
      session,
      '⚠️ No student linked to this number.'
    );
  }
  
  // Would fetch last payment
  const receiptData = getMockReceiptData();
  const formattedMessage = formatReceiptMessage(receiptData);
  
  return createTextResponse(message, session, formattedMessage);
}

async function handleStatementRequest(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  return createTextResponse(
    message,
    session,
    `📄 *Statement Request*\n\nYour statement is being prepared and will be sent as a PDF shortly.\n\nAlternatively, visit the parent portal at:\nhttps://school.edupay.ug/parent`
  );
}

async function handlePaymentHistory(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  // Would fetch payment history
  const history = [
    { date: '15 Jan 2024', amount: 500000, method: 'Mobile Money' },
    { date: '05 Dec 2023', amount: 800000, method: 'Bank Transfer' },
    { date: '12 Sep 2023', amount: 350000, method: 'Cash' },
  ];
  
  let message_text = `📜 *Recent Payments*\n\n`;
  
  for (const payment of history) {
    message_text += `${payment.date}\n`;
    message_text += `UGX ${payment.amount.toLocaleString()} (${payment.method})\n\n`;
  }
  
  message_text += `Reply STATEMENT for full history.`;
  
  return createTextResponse(message, session, message_text);
}

async function handleHelp(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  return createTextResponse(message, session, generateHelpMessage());
}

async function handleMenu(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  const menuContent = generateMenuContent();
  return createInteractiveResponse(message, session, menuContent);
}

async function handlePaymentInstructions(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  const instructions = `💳 *Payment Options*

*Mobile Money:*
MTN: *165*3# → School Fees
Airtel: *185*9# → School Fees

*Bank Transfer:*
Bank: Stanbic Bank
Account: 9030012345678
Name: ABC School Fees

*In Person:*
Visit the Bursar's office
Mon-Fri, 8am-4pm

After payment, send BALANCE to check your updated balance.`;
  
  return createTextResponse(message, session, instructions);
}

async function handleOptOut(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  // Would update preferences
  return createTextResponse(
    message,
    session,
    `✅ You have been opted out of fee notifications.\n\nTo opt back in, reply START at any time.`
  );
}

async function handlePinSetup(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  await updateSessionState(session.id, 'awaiting_pin');
  return createTextResponse(
    message,
    session,
    `🔐 *PIN Setup*\n\nPlease enter a 4-digit PIN to secure your account.\n\nThis PIN will be required to view fee information.`
  );
}

async function handleUnknownMessage(
  message: IncomingWhatsAppMessage,
  session: WhatsAppSession
): Promise<OutgoingWhatsAppMessage> {
  return createTextResponse(
    message,
    session,
    `❓ I didn't understand that command.\n\nReply HELP to see available commands, or MENU for options.`
  );
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

function createTextResponse(
  incoming: IncomingWhatsAppMessage,
  session: WhatsAppSession,
  text: string
): OutgoingWhatsAppMessage {
  const content: TextContent = {
    type: 'text',
    body: text,
  };
  
  return {
    id: `out-${Date.now()}`,
    schoolId: incoming.schoolId,
    to: incoming.from,
    type: 'text',
    content,
    status: 'pending',
    retryCount: 0,
    createdAt: Timestamp.now(),
    triggerMessageId: incoming.id,
    triggerType: 'auto',
  };
}

function createInteractiveResponse(
  incoming: IncomingWhatsAppMessage,
  session: WhatsAppSession,
  interactive: InteractiveContent
): OutgoingWhatsAppMessage {
  return {
    id: `out-${Date.now()}`,
    schoolId: incoming.schoolId,
    to: incoming.from,
    type: 'interactive',
    content: interactive,
    status: 'pending',
    retryCount: 0,
    createdAt: Timestamp.now(),
    triggerMessageId: incoming.id,
    triggerType: 'auto',
  };
}

// ============================================================================
// OUTBOUND MESSAGING
// ============================================================================

/**
 * Send balance inquiry response
 */
export async function sendBalanceMessage(input: SendBalanceInput): Promise<OutgoingWhatsAppMessage> {
  // Would fetch actual balance
  const balanceData = getMockBalanceData(input.studentId);
  
  let messageText = formatBalanceMessage(balanceData);
  
  if (input.includeBreakdown && balanceData.breakdown) {
    messageText += '\n\n📋 *Breakdown:*\n';
    for (const item of balanceData.breakdown) {
      const balance = item.amount - item.paid;
      messageText += `• ${item.category}: UGX ${balance.toLocaleString()}\n`;
    }
  }
  
  const content: TextContent = {
    type: 'text',
    body: messageText,
  };
  
  const message: OutgoingWhatsAppMessage = {
    id: `out-${Date.now()}`,
    schoolId: 'current-school',
    to: formatPhoneForWhatsApp(input.phoneNumber),
    type: 'text',
    content,
    status: 'pending',
    retryCount: 0,
    createdAt: Timestamp.now(),
    triggerType: 'manual',
  };
  
  // Would send via API
  return sendMessage(message);
}

/**
 * Send receipt via WhatsApp
 */
export async function sendReceiptMessage(input: SendReceiptInput): Promise<OutgoingWhatsAppMessage> {
  // Would fetch actual receipt
  const receiptData = getMockReceiptData();
  const messageText = formatReceiptMessage(receiptData);
  
  const content: TextContent = {
    type: 'text',
    body: messageText,
  };
  
  // For PDF format, would attach document
  const message: OutgoingWhatsAppMessage = {
    id: `out-${Date.now()}`,
    schoolId: 'current-school',
    to: formatPhoneForWhatsApp(input.phoneNumber),
    type: input.format === 'pdf' ? 'document' : 'text',
    content: input.format === 'pdf' 
      ? {
          type: 'document',
          link: `https://receipts.edupay.ug/${input.paymentId}.pdf`,
          filename: `Receipt_${receiptData.receiptNumber}.pdf`,
          caption: messageText,
        }
      : content,
    status: 'pending',
    retryCount: 0,
    createdAt: Timestamp.now(),
    triggerType: 'auto',
  };
  
  return sendMessage(message);
}

/**
 * Send bulk payment reminders
 */
export async function sendBulkReminders(
  input: SendBulkReminderInput
): Promise<{ sent: number; failed: number; errors: string[] }> {
  // Would fetch guardians based on filter
  const results = { sent: 0, failed: 0, errors: [] as string[] };
  
  // Mock recipients
  const recipients = [
    { phone: '0772123456', studentName: 'David Mugisha', balance: 500000 },
    { phone: '0701987654', studentName: 'Grace Nakato', balance: 350000 },
    { phone: '0753111222', studentName: 'Sarah Achieng', balance: 850000 },
  ];
  
  for (const recipient of recipients) {
    if (recipient.balance >= input.minimumBalance) {
      try {
        await sendBalanceMessage({
          phoneNumber: recipient.phone,
          studentId: 'mock-id',
          includeBreakdown: false,
        });
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${recipient.phone}: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }
  }
  
  return results;
}

/**
 * Send message via WhatsApp API
 */
async function sendMessage(message: OutgoingWhatsAppMessage): Promise<OutgoingWhatsAppMessage> {
  // Would integrate with actual WhatsApp API provider
  console.log('Sending WhatsApp message:', {
    to: message.to,
    type: message.type,
  });
  
  // Simulate sending
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    ...message,
    status: 'sent',
    sentAt: Timestamp.now(),
    whatsappMessageId: `wamid.${Date.now()}`,
  };
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Get templates for school
 */
export async function getWhatsAppTemplates(schoolId: string): Promise<WhatsAppTemplate[]> {
  return getMockTemplates(schoolId);
}

/**
 * Create new template (submits to Meta for approval)
 */
export async function createWhatsAppTemplate(
  template: Omit<WhatsAppTemplate, 'id' | 'status' | 'usageCount' | 'createdAt' | 'updatedAt'>
): Promise<WhatsAppTemplate> {
  const newTemplate: WhatsAppTemplate = {
    ...template,
    id: `template-${Date.now()}`,
    status: 'PENDING',
    usageCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Would submit to Meta Business API
  return newTemplate;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get WhatsApp analytics
 */
export async function getWhatsAppAnalytics(
  schoolId: string,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<WhatsAppAnalytics> {
  return getMockAnalytics(schoolId, period);
}

// ============================================================================
// SCHEDULED MESSAGES
// ============================================================================

/**
 * Get scheduled messages
 */
export async function getScheduledMessages(
  schoolId: string
): Promise<ScheduledWhatsAppMessage[]> {
  return getMockScheduledMessages(schoolId);
}

/**
 * Schedule bulk message
 */
export async function scheduleMessage(
  message: Omit<ScheduledWhatsAppMessage, 'id' | 'status' | 'createdAt'>
): Promise<ScheduledWhatsAppMessage> {
  const scheduled: ScheduledWhatsAppMessage = {
    ...message,
    id: `scheduled-${Date.now()}`,
    status: 'scheduled',
    createdAt: Timestamp.now(),
  };
  
  // Would save to Firestore
  return scheduled;
}

/**
 * Cancel scheduled message
 */
export async function cancelScheduledMessage(messageId: string): Promise<void> {
  // Would update Firestore
  console.log('Cancelled scheduled message:', messageId);
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockConfig(schoolId: string): WhatsAppConfig {
  return {
    schoolId,
    provider: 'africas_talking',
    apiCredentials: {
      apiKey: 'mock-api-key',
    },
    businessPhoneNumber: '+256700000000',
    displayName: 'eBursar School',
    features: {
      balanceInquiry: true,
      receiptDelivery: true,
      paymentReminders: true,
      feeStatements: true,
      interactiveMenus: true,
      autoReply: true,
    },
    requirePIN: true,
    pinLength: 4,
    maxPinAttempts: 3,
    lockoutDurationMinutes: 30,
    dailyMessageLimit: 1000,
    messagesSentToday: 45,
    autoReplyMessage: 'Welcome to eBursar! Reply HELP for commands.',
    outOfHoursMessage: 'Thank you for your message. Our service hours are 7am-8pm. Your message will be processed during business hours.',
    supportContactNumber: '0800123456',
    operatingHoursStart: 7,
    operatingHoursEnd: 20,
    timezone: 'Africa/Kampala',
    isActive: true,
    lastHealthCheck: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}

function getMockBalanceData(studentId: string): BalanceResponse {
  return {
    studentName: 'David Mugisha',
    className: 'S4 Science',
    totalFees: 2850000,
    totalPaid: 2000000,
    balance: 850000,
    dueDate: new Date('2024-02-28'),
    lastPaymentDate: new Date('2024-01-15'),
    lastPaymentAmount: 500000,
    breakdown: [
      { category: 'Tuition', amount: 1500000, paid: 1200000 },
      { category: 'Boarding', amount: 850000, paid: 600000 },
      { category: 'Development', amount: 300000, paid: 200000 },
      { category: 'Computer Lab', amount: 200000, paid: 0 },
    ],
  };
}

function getMockReceiptData(): ReceiptResponse {
  return {
    receiptNumber: 'RCP-2024-0156',
    studentName: 'David Mugisha',
    amount: 500000,
    paymentDate: new Date('2024-01-15'),
    paymentMethod: 'MTN Mobile Money',
    balance: 850000,
    receivedBy: 'John Ssemakula (Bursar)',
  };
}

function getMockTemplates(schoolId: string): WhatsAppTemplate[] {
  return [
    {
      id: 'template-1',
      schoolId,
      templateName: 'fee_balance',
      category: 'TRANSACTIONAL',
      language: 'en',
      status: 'APPROVED',
      headerType: 'TEXT',
      headerText: '📊 Fee Balance Update',
      bodyText: 'Dear {{1}}, the fee balance for {{2}} is UGX {{3}}. Due date: {{4}}.',
      footerText: 'Reply BAL for updated balance',
      usageCount: 245,
      lastUsedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: 'template-2',
      schoolId,
      templateName: 'payment_receipt',
      category: 'TRANSACTIONAL',
      language: 'en',
      status: 'APPROVED',
      headerType: 'TEXT',
      headerText: '🧾 Payment Receipt',
      bodyText: 'Thank you! Payment of UGX {{1}} received for {{2}}. Receipt #{{3}}. New balance: UGX {{4}}.',
      usageCount: 189,
      lastUsedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: 'template-3',
      schoolId,
      templateName: 'payment_reminder',
      category: 'TRANSACTIONAL',
      language: 'en',
      status: 'APPROVED',
      headerType: 'TEXT',
      headerText: '⏰ Payment Reminder',
      bodyText: 'Reminder: Fee balance of UGX {{1}} for {{2}} is {{3}} days overdue. Please pay to avoid disruption.',
      footerText: 'Reply PAY for payment options',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Check Balance' },
        { type: 'QUICK_REPLY', text: 'Payment Options' },
      ],
      usageCount: 156,
      lastUsedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];
}

function getMockAnalytics(schoolId: string, period: 'daily' | 'weekly' | 'monthly'): WhatsAppAnalytics {
  const multiplier = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  
  return {
    schoolId,
    period,
    startDate: new Date(),
    endDate: new Date(),
    totalInbound: 45 * multiplier,
    totalOutbound: 120 * multiplier,
    totalDelivered: 115 * multiplier,
    totalRead: 98 * multiplier,
    totalFailed: 5 * multiplier,
    byType: {
      balanceInquiries: 35 * multiplier,
      receiptsSent: 42 * multiplier,
      remindersSent: 28 * multiplier,
      statementsSent: 8 * multiplier,
      supportMessages: 7 * multiplier,
    },
    uniqueUsers: 78 * (multiplier * 0.5),
    newUsers: 12 * (multiplier * 0.3),
    returningUsers: 66 * (multiplier * 0.5),
    averageMessagesPerUser: 2.1,
    averageResponseTimeSeconds: 1.5,
    autoReplyRate: 92,
    estimatedCost: 15000 * multiplier,
    currency: 'UGX',
  };
}

function getMockScheduledMessages(schoolId: string): ScheduledWhatsAppMessage[] {
  return [
    {
      id: 'scheduled-1',
      schoolId,
      recipientType: 'overdue',
      recipientFilter: { daysOverdue: 7 },
      recipientCount: 45,
      templateType: 'payment_reminder',
      scheduledFor: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      recurring: true,
      recurringPattern: 'weekly',
      status: 'scheduled',
      createdBy: 'bursar-1',
      createdAt: Timestamp.now(),
    },
    {
      id: 'scheduled-2',
      schoolId,
      recipientType: 'all_guardians',
      recipientCount: 520,
      templateType: 'fee_statement',
      customMessage: 'Term 1 fee statements are now available.',
      scheduledFor: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
      recurring: false,
      status: 'scheduled',
      createdBy: 'bursar-1',
      createdAt: Timestamp.now(),
    },
  ];
}

export function getMockWhatsAppDashboard() {
  return {
    messagesInLast24h: { inbound: 67, outbound: 145 },
    topCommands: [
      { command: 'BAL', count: 42 },
      { command: 'RECEIPT', count: 18 },
      { command: 'HELP', count: 12 },
    ],
    deliveryRate: 96.5,
    readRate: 82.3,
    activeUsers: 89,
    scheduledMessages: 2,
    recentActivity: [
      { type: 'inbound', from: '+256772***456', command: 'BAL', time: '2 min ago' },
      { type: 'outbound', to: '+256701***654', template: 'fee_balance', time: '5 min ago' },
      { type: 'inbound', from: '+256753***222', command: 'RECEIPT', time: '8 min ago' },
    ],
  };
}
