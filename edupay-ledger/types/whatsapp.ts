/**
 * WhatsApp Integration Types
 * Instant balance queries and payment receipts via WhatsApp
 *
 * Features:
 * - Balance inquiry via keyword
 * - Payment receipt delivery
 * - Statement requests
 * - Fee reminders
 * - Interactive menus
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * WhatsApp message direction
 */
export type MessageDirection = "inbound" | "outbound";

/**
 * Message status
 */
export type WhatsAppMessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/**
 * Message type
 */
export type WhatsAppMessageType =
  | "text"
  | "template"
  | "interactive"
  | "document"
  | "image";

/**
 * WhatsApp session state
 */
export type SessionState =
  | "idle"
  | "awaiting_pin"
  | "main_menu"
  | "balance_inquiry"
  | "receipt_request"
  | "statement_request"
  | "payment_history"
  | "support";

/**
 * Incoming message from WhatsApp
 */
export interface IncomingWhatsAppMessage {
  id: string;
  schoolId: string;

  // Sender info
  from: string; // Phone number
  profileName?: string;

  // Message content
  type: "text" | "interactive" | "button";
  text?: string;
  buttonPayload?: string;
  listSelection?: {
    id: string;
    title: string;
    description?: string;
  };

  // Timestamps
  receivedAt: Timestamp;
  processedAt?: Timestamp;

  // Processing
  processed: boolean;
  responseId?: string;
  error?: string;
}

/**
 * Outgoing message to WhatsApp
 */
export interface OutgoingWhatsAppMessage {
  id: string;
  schoolId: string;

  // Recipient
  to: string; // Phone number

  // Message content
  type: WhatsAppMessageType;
  content: MessageContent;

  // Status
  status: WhatsAppMessageStatus;
  whatsappMessageId?: string; // ID from WhatsApp API

  // Error handling
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;

  // Timestamps
  createdAt: Timestamp;
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;

  // Context
  triggerMessageId?: string;
  triggerType: "auto" | "manual" | "scheduled";
  templateName?: string;
}

/**
 * Message content variants
 */
export type MessageContent =
  | TextContent
  | TemplateContent
  | InteractiveContent
  | DocumentContent;

export interface TextContent {
  type: "text";
  body: string;
  previewUrl?: boolean;
}

export interface TemplateContent {
  type: "template";
  templateName: string;
  language: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters: {
    type: "text" | "currency" | "date_time" | "document";
    text?: string;
    currency?: { code: string; amount: number };
    dateTime?: string;
    document?: { link: string; filename: string };
  }[];
}

export interface InteractiveContent {
  type: "interactive";
  interactiveType: "list" | "button";
  header?: { type: "text"; text: string };
  body: { text: string };
  footer?: { text: string };
  action: InteractiveAction;
}

export interface InteractiveAction {
  button?: string;
  buttons?: { type: "reply"; reply: { id: string; title: string } }[];
  sections?: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[];
}

export interface DocumentContent {
  type: "document";
  link: string;
  filename: string;
  caption?: string;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * WhatsApp conversation session
 */
export interface WhatsAppSession {
  id: string;
  schoolId: string;
  phoneNumber: string;

  // Linked account
  guardianId?: string;
  guardianName?: string;
  linkedStudentIds: string[];

  // Security
  isVerified: boolean;
  pinHash?: string;
  pinAttempts: number;
  lockedUntil?: Timestamp;

  // Session state
  state: SessionState;
  stateData?: Record<string, unknown>;

  // Activity
  lastActivityAt: Timestamp;
  sessionStartedAt: Timestamp;
  messageCount: number;

  // Preferences
  preferredLanguage: "en" | "sw" | "lg"; // English, Swahili, Luganda
  receiveNotifications: boolean;
  receiveReceipts: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// KEYWORD COMMANDS
// ============================================================================

/**
 * Command recognized from message
 */
export type WhatsAppCommand =
  | "BALANCE"
  | "BAL"
  | "FEES"
  | "RECEIPT"
  | "STATEMENT"
  | "HISTORY"
  | "HELP"
  | "MENU"
  | "PAY"
  | "STOP"
  | "PIN";

/**
 * Command definition
 */
export interface CommandDefinition {
  keywords: string[];
  description: string;
  requiresVerification: boolean;
  handler: string; // Function name
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * WhatsApp message template
 */
export interface WhatsAppTemplate {
  id: string;
  schoolId: string;

  // Meta template info
  templateName: string;
  category: "TRANSACTIONAL" | "MARKETING";
  language: string;

  // Status with Meta
  status: "APPROVED" | "PENDING" | "REJECTED";
  rejectionReason?: string;

  // Content
  headerType?: "TEXT" | "DOCUMENT" | "IMAGE";
  headerText?: string;
  bodyText: string;
  footerText?: string;

  // Buttons
  buttons?: {
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phoneNumber?: string;
  }[];

  // Usage
  usageCount: number;
  lastUsedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Available template types
 */
export type TemplateType =
  | "balance_response"
  | "payment_receipt"
  | "payment_reminder"
  | "fee_statement"
  | "exam_clearance"
  | "welcome_message"
  | "pin_setup";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * WhatsApp integration configuration
 */
export interface WhatsAppConfig {
  schoolId: string;

  // API Configuration (Africa's Talking, Twilio, or direct WhatsApp Business API)
  provider: "africas_talking" | "twilio" | "whatsapp_business" | "dialog360";
  apiCredentials: {
    accountId?: string;
    apiKey?: string;
    apiSecret?: string;
    phoneNumberId?: string;
    accessToken?: string;
  };

  // WhatsApp Business Account
  businessPhoneNumber: string;
  displayName: string;

  // Features
  features: {
    balanceInquiry: boolean;
    receiptDelivery: boolean;
    paymentReminders: boolean;
    feeStatements: boolean;
    interactiveMenus: boolean;
    autoReply: boolean;
  };

  // Security
  requirePIN: boolean;
  pinLength: number;
  maxPinAttempts: number;
  lockoutDurationMinutes: number;

  // Rate limits
  dailyMessageLimit: number;
  messagesSentToday: number;

  // Auto-reply settings
  autoReplyMessage: string;
  outOfHoursMessage: string;
  supportContactNumber: string;

  // Operating hours
  operatingHoursStart: number;
  operatingHoursEnd: number;
  timezone: string;

  // Status
  isActive: boolean;
  lastHealthCheck?: Timestamp;
  webhookUrl?: string;

  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * WhatsApp usage analytics
 */
export interface WhatsAppAnalytics {
  schoolId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: Date;
  endDate: Date;

  // Message counts
  totalInbound: number;
  totalOutbound: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;

  // By type
  byType: {
    balanceInquiries: number;
    receiptsSent: number;
    remindersSent: number;
    statementsSent: number;
    supportMessages: number;
  };

  // User engagement
  uniqueUsers: number;
  newUsers: number;
  returningUsers: number;
  averageMessagesPerUser: number;

  // Response metrics
  averageResponseTimeSeconds: number;
  autoReplyRate: number;

  // Cost tracking (for paid providers)
  estimatedCost: number;
  currency: string;
}

// ============================================================================
// SCHEDULED MESSAGES
// ============================================================================

/**
 * Scheduled WhatsApp message
 */
export interface ScheduledWhatsAppMessage {
  id: string;
  schoolId: string;

  // Recipients
  recipientType: "individual" | "class" | "all_guardians" | "overdue";
  recipientFilter?: {
    classId?: string;
    minimumBalance?: number;
    daysOverdue?: number;
  };
  recipientCount: number;

  // Content
  templateType: TemplateType;
  customMessage?: string;

  // Schedule
  scheduledFor: Timestamp;
  recurring: boolean;
  recurringPattern?: "daily" | "weekly" | "monthly" | "term_start";

  // Status
  status: "scheduled" | "processing" | "completed" | "failed" | "cancelled";

  // Results
  messagesSent?: number;
  messagesDelivered?: number;
  messagesFailed?: number;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface SendBalanceInput {
  phoneNumber: string;
  studentId: string;
  includeBreakdown: boolean;
}

export interface SendReceiptInput {
  phoneNumber: string;
  paymentId: string;
  format: "text" | "pdf";
}

export interface SendStatementInput {
  phoneNumber: string;
  studentId: string;
  termId: string;
  format: "text" | "pdf";
}

export interface SendBulkReminderInput {
  schoolId: string;
  classId?: string;
  minimumBalance: number;
  templateType: TemplateType;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Balance response data
 */
export interface BalanceResponse {
  studentName: string;
  className: string;
  totalFees: number;
  totalPaid: number;
  balance: number;
  dueDate?: Date;
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  breakdown?: {
    category: string;
    amount: number;
    paid: number;
  }[];
}

/**
 * Receipt response data
 */
export interface ReceiptResponse {
  receiptNumber: string;
  studentName: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  balance: number;
  receivedBy: string;
  pdfUrl?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse command from message text
 */
export function parseCommand(text: string): {
  command: WhatsAppCommand | null;
  args: string[];
} {
  const normalized = text.trim().toUpperCase();
  const parts = normalized.split(/\s+/);
  const firstWord = parts[0];

  const commandMap: Record<string, WhatsAppCommand> = {
    BALANCE: "BALANCE",
    BAL: "BAL",
    FEES: "FEES",
    RECEIPT: "RECEIPT",
    RCPT: "RECEIPT",
    STATEMENT: "STATEMENT",
    STMT: "STATEMENT",
    HISTORY: "HISTORY",
    HELP: "HELP",
    "?": "HELP",
    MENU: "MENU",
    PAY: "PAY",
    STOP: "STOP",
    PIN: "PIN",
  };

  const command = commandMap[firstWord] || null;
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Get command description
 */
export const COMMAND_DEFINITIONS: Record<WhatsAppCommand, CommandDefinition> = {
  BALANCE: {
    keywords: ["BALANCE", "BAL"],
    description: "Check fee balance",
    requiresVerification: true,
    handler: "handleBalanceInquiry",
  },
  BAL: {
    keywords: ["BAL"],
    description: "Check fee balance (short)",
    requiresVerification: true,
    handler: "handleBalanceInquiry",
  },
  FEES: {
    keywords: ["FEES"],
    description: "View fee breakdown",
    requiresVerification: true,
    handler: "handleFeeBreakdown",
  },
  RECEIPT: {
    keywords: ["RECEIPT", "RCPT"],
    description: "Get last payment receipt",
    requiresVerification: true,
    handler: "handleReceiptRequest",
  },
  STATEMENT: {
    keywords: ["STATEMENT", "STMT"],
    description: "Request fee statement",
    requiresVerification: true,
    handler: "handleStatementRequest",
  },
  HISTORY: {
    keywords: ["HISTORY"],
    description: "View payment history",
    requiresVerification: true,
    handler: "handlePaymentHistory",
  },
  HELP: {
    keywords: ["HELP", "?"],
    description: "Show available commands",
    requiresVerification: false,
    handler: "handleHelp",
  },
  MENU: {
    keywords: ["MENU"],
    description: "Show interactive menu",
    requiresVerification: false,
    handler: "handleMenu",
  },
  PAY: {
    keywords: ["PAY"],
    description: "Get payment instructions",
    requiresVerification: true,
    handler: "handlePaymentInstructions",
  },
  STOP: {
    keywords: ["STOP"],
    description: "Opt out of notifications",
    requiresVerification: false,
    handler: "handleOptOut",
  },
  PIN: {
    keywords: ["PIN"],
    description: "Set or change PIN",
    requiresVerification: false,
    handler: "handlePinSetup",
  },
};

/**
 * Format balance message
 */
export function formatBalanceMessage(data: BalanceResponse): string {
  let message = `📚 *Fee Balance for ${data.studentName}*\n`;
  message += `Class: ${data.className}\n\n`;
  message += `💰 *Total Fees:* UGX ${data.totalFees.toLocaleString()}\n`;
  message += `✅ *Paid:* UGX ${data.totalPaid.toLocaleString()}\n`;
  message += `📊 *Balance:* UGX ${data.balance.toLocaleString()}\n`;

  if (data.dueDate) {
    message += `\n📅 *Due Date:* ${data.dueDate.toLocaleDateString("en-UG")}\n`;
  }

  if (data.lastPaymentDate && data.lastPaymentAmount) {
    message += `\n💳 *Last Payment:*\n`;
    message += `   UGX ${data.lastPaymentAmount.toLocaleString()}\n`;
    message += `   on ${data.lastPaymentDate.toLocaleDateString("en-UG")}\n`;
  }

  if (data.breakdown && data.breakdown.length > 0) {
    message += `\n📋 *Breakdown:*\n`;
    for (const item of data.breakdown) {
      const itemBalance = item.amount - item.paid;
      message += `• ${item.category}: UGX ${itemBalance.toLocaleString()}\n`;
    }
  }

  return message;
}

/**
 * Format receipt message
 */
export function formatReceiptMessage(data: ReceiptResponse): string {
  let message = `🧾 *Payment Receipt*\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `Receipt #: ${data.receiptNumber}\n\n`;
  message += `Student: ${data.studentName}\n`;
  message += `Amount: UGX ${data.amount.toLocaleString()}\n`;
  message += `Date: ${data.paymentDate.toLocaleDateString("en-UG")}\n`;
  message += `Method: ${data.paymentMethod}\n`;
  message += `Received by: ${data.receivedBy}\n\n`;
  message += `New Balance: UGX ${data.balance.toLocaleString()}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `Thank you for your payment! 🙏`;

  return message;
}

/**
 * Generate help message
 */
export function generateHelpMessage(): string {
  return `📱 *eBursar WhatsApp Service*

Available Commands:
━━━━━━━━━━━━━━━━━━
📊 *BAL* - Check fee balance
🧾 *RECEIPT* - Get last receipt
📄 *STATEMENT* - Request statement
📜 *HISTORY* - Payment history
💳 *PAY* - Payment instructions
📋 *MENU* - Interactive menu
🔐 *PIN* - Set/change PIN
🛑 *STOP* - Opt out

Reply with any command to continue.
For support, contact: 0800-XXX-XXX`;
}

/**
 * Generate interactive menu
 */
export function generateMenuContent(): InteractiveContent {
  return {
    type: "interactive",
    interactiveType: "list",
    header: { type: "text", text: "📱 eBursar Menu" },
    body: { text: "Select an option:" },
    footer: { text: "Reply HELP for commands" },
    action: {
      button: "View Options",
      sections: [
        {
          title: "Fee Information",
          rows: [
            {
              id: "balance",
              title: "💰 Check Balance",
              description: "View current fee balance",
            },
            {
              id: "breakdown",
              title: "📋 Fee Breakdown",
              description: "Detailed fee categories",
            },
            {
              id: "statement",
              title: "📄 Fee Statement",
              description: "Request PDF statement",
            },
          ],
        },
        {
          title: "Payments",
          rows: [
            {
              id: "receipt",
              title: "🧾 Last Receipt",
              description: "View last payment receipt",
            },
            {
              id: "history",
              title: "📜 Payment History",
              description: "View all payments",
            },
            {
              id: "pay",
              title: "💳 Make Payment",
              description: "Payment instructions",
            },
          ],
        },
        {
          title: "Settings",
          rows: [
            {
              id: "pin",
              title: "🔐 Set PIN",
              description: "Set or change your PIN",
            },
            {
              id: "preferences",
              title: "⚙️ Preferences",
              description: "Notification settings",
            },
          ],
        },
      ],
    },
  };
}

/**
 * Format phone for WhatsApp
 */
export function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Uganda number handling
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "256" + cleaned.substring(1);
  } else if (cleaned.startsWith("7") && cleaned.length === 9) {
    cleaned = "256" + cleaned;
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Validate Uganda phone number
 */
export function isValidUgandaPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Valid formats: 0771234567, 771234567, 256771234567, +256771234567
  const patterns = [
    /^0[73]\d{8}$/, // Local with leading 0
    /^[73]\d{8}$/, // Without leading 0
    /^256[73]\d{8}$/, // With country code
    /^\+256[73]\d{8}$/, // With + prefix
  ];

  return patterns.some((p) => p.test(cleaned));
}

/**
 * Get message status display
 */
export function getMessageStatusDisplay(status: WhatsAppMessageStatus): {
  label: string;
  icon: string;
  color: "gray" | "blue" | "green" | "red";
} {
  const displays: Record<
    WhatsAppMessageStatus,
    { label: string; icon: string; color: "gray" | "blue" | "green" | "red" }
  > = {
    pending: { label: "Pending", icon: "⏳", color: "gray" },
    sent: { label: "Sent", icon: "✓", color: "blue" },
    delivered: { label: "Delivered", icon: "✓✓", color: "blue" },
    read: { label: "Read", icon: "✓✓", color: "green" },
    failed: { label: "Failed", icon: "✗", color: "red" },
  };
  return displays[status];
}
