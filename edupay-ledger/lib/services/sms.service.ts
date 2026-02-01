/**
 * SMS Notification Service
 *
 * Professional SMS service for eBursar using Africa's Talking API
 * Optimized for Uganda (MTN, Airtel, Africell networks)
 */

// ============================================================================
// Types
// ============================================================================

export type SMSProvider = "africastalking" | "twilio" | "mock";

export type SMSMessageType =
  | "payment_receipt"
  | "payment_reminder"
  | "arrears_notice"
  | "clearance_granted"
  | "fee_deadline"
  | "promise_reminder"
  | "balance_inquiry"
  | "welcome"
  | "custom";

export interface SMSRecipient {
  phoneNumber: string;
  name?: string;
  studentId?: string;
  studentName?: string;
}

export interface SMSMessage {
  to: SMSRecipient | SMSRecipient[];
  type: SMSMessageType;
  templateData?: Record<string, string | number>;
  customMessage?: string;
  scheduledAt?: Date;
}

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  cost?: number;
  status: "sent" | "queued" | "failed" | "rejected";
  errorMessage?: string;
  timestamp: Date;
}

export interface SMSBulkResult {
  totalSent: number;
  totalFailed: number;
  totalCost: number;
  results: SMSSendResult[];
}

export interface SMSBalance {
  balance: string;
  currency: string;
}

export interface SMSDeliveryReport {
  messageId: string;
  status: "Sent" | "Submitted" | "Buffered" | "Rejected" | "Success" | "Failed";
  failureReason?: string;
  phoneNumber: string;
  networkCode?: string;
  retryCount?: number;
}

// ============================================================================
// Configuration
// ============================================================================

interface SMSConfig {
  provider: SMSProvider;
  apiKey: string;
  username: string;
  senderId: string;
  shortCode?: string;
  environment: "sandbox" | "production";
}

const getConfig = (): SMSConfig => ({
  provider:
    (process.env.NEXT_PUBLIC_SMS_PROVIDER as SMSProvider) || "africastalking",
  apiKey: process.env.AFRICASTALKING_API_KEY || "",
  username: process.env.AFRICASTALKING_USERNAME || "sandbox",
  senderId: process.env.AFRICASTALKING_SENDER_ID || "eBursar",
  shortCode: process.env.AFRICASTALKING_SHORT_CODE,
  environment: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});

// ============================================================================
// Phone Number Utilities
// ============================================================================

/**
 * Formats a Ugandan phone number to international format
 */
export function formatUgandanPhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Handle different formats
  if (cleaned.startsWith("256")) {
    // Already in international format
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0")) {
    // Local format (0772xxx)
    return `+256${cleaned.slice(1)}`;
  } else if (
    cleaned.startsWith("7") ||
    cleaned.startsWith("3") ||
    cleaned.startsWith("4")
  ) {
    // Without leading 0 (772xxx)
    return `+256${cleaned}`;
  }

  // Return as-is with + prefix if already formatted
  return phone.startsWith("+") ? phone : `+${cleaned}`;
}

/**
 * Validates a Ugandan phone number
 */
export function isValidUgandanPhone(phone: string): boolean {
  const formatted = formatUgandanPhone(phone);
  // Uganda numbers: +256 7XX XXX XXX (MTN, Airtel) or +256 3XX XXX XXX (landlines)
  const ugandaRegex = /^\+256[37]\d{8}$/;
  return ugandaRegex.test(formatted);
}

/**
 * Detects the mobile network from phone number
 */
export function detectNetwork(
  phone: string,
): "MTN" | "Airtel" | "Africell" | "Unknown" {
  const formatted = formatUgandanPhone(phone);
  const prefix = formatted.slice(4, 6); // Get the prefix after +256

  // MTN Uganda prefixes
  if (["77", "78", "76", "39"].includes(prefix)) {
    return "MTN";
  }
  // Airtel Uganda prefixes
  if (["70", "75", "74"].includes(prefix)) {
    return "Airtel";
  }
  // Africell Uganda prefixes
  if (["79"].includes(prefix)) {
    return "Africell";
  }

  return "Unknown";
}

// ============================================================================
// Message Templates
// ============================================================================

const MESSAGE_TEMPLATES: Record<SMSMessageType, string> = {
  payment_receipt: `Dear {guardianName}, payment of UGX {amount} received for {studentName} ({studentId}). Balance: UGX {balance}. Receipt: {receiptNumber}. Thank you! - {schoolName}`,

  payment_reminder: `Dear {guardianName}, reminder: {studentName}'s school fees balance is UGX {balance}. Due date: {dueDate}. Pay via Mobile Money to avoid late fees. - {schoolName}`,

  arrears_notice: `Dear {guardianName}, {studentName} has an outstanding balance of UGX {balance}, overdue by {daysOverdue} days. Please clear to avoid clearance issues. - {schoolName}`,

  clearance_granted: `Dear {guardianName}, {studentName} has been granted exam clearance for {term}. All fees are up to date. Thank you for your prompt payment! - {schoolName}`,

  fee_deadline: `Dear {guardianName}, reminder: School fees deadline for {term} is {deadline}. {studentName}'s balance: UGX {balance}. Pay now to avoid penalties. - {schoolName}`,

  promise_reminder: `Dear {guardianName}, reminder: Your payment promise of UGX {promiseAmount} for {studentName} is due on {promiseDate}. Current balance: UGX {balance}. - {schoolName}`,

  balance_inquiry: `Dear {guardianName}, {studentName}'s fee status: Total fees: UGX {totalFees}, Paid: UGX {amountPaid}, Balance: UGX {balance}. {paymentStatus}. - {schoolName}`,

  welcome: `Welcome to {schoolName}! {studentName} ({studentId}) has been enrolled. Total fees: UGX {totalFees}. SMS notifications enabled. Reply STOP to opt out.`,

  custom: `{message}`,
};

/**
 * Renders a message template with data
 */
export function renderTemplate(
  type: SMSMessageType,
  data: Record<string, string | number>,
): string {
  let message = MESSAGE_TEMPLATES[type];

  Object.entries(data).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{${key}}`, "g"), String(value));
  });

  return message;
}

// ============================================================================
// SMS Service Class
// ============================================================================

class SMSService {
  private config: SMSConfig;
  private baseUrl: string;

  constructor() {
    this.config = getConfig();
    this.baseUrl =
      this.config.environment === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1"
        : "https://api.africastalking.com/version1";
  }

  /**
   * Check if SMS service is configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.username);
  }

  /**
   * Send SMS to a single recipient
   */
  async send(message: SMSMessage): Promise<SMSSendResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    if (recipients.length === 0) {
      return {
        success: false,
        recipient: "",
        status: "failed",
        errorMessage: "No recipients specified",
        timestamp: new Date(),
      };
    }

    const results = await this.sendBulk({ ...message, to: recipients });
    return results.results[0];
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendBulk(message: SMSMessage): Promise<SMSBulkResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const results: SMSSendResult[] = [];
    let totalCost = 0;

    // Check configuration
    if (!this.isConfigured()) {
      // Return mock results in development
      if (process.env.NODE_ENV === "development") {
        return this.mockSendBulk(message);
      }

      return {
        totalSent: 0,
        totalFailed: recipients.length,
        totalCost: 0,
        results: recipients.map((r) => ({
          success: false,
          recipient: typeof r === "string" ? r : r.phoneNumber,
          status: "failed" as const,
          errorMessage:
            "SMS service not configured. Set AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME.",
          timestamp: new Date(),
        })),
      };
    }

    // Prepare message content
    let messageText: string;
    if (message.type === "custom" && message.customMessage) {
      messageText = message.customMessage;
    } else {
      messageText = renderTemplate(message.type, message.templateData || {});
    }

    // Format phone numbers
    const formattedRecipients = recipients
      .map((r) => {
        const phone = typeof r === "string" ? r : r.phoneNumber;
        return formatUgandanPhone(phone);
      })
      .filter(isValidUgandanPhone);

    if (formattedRecipients.length === 0) {
      return {
        totalSent: 0,
        totalFailed: recipients.length,
        totalCost: 0,
        results: recipients.map((r) => ({
          success: false,
          recipient: typeof r === "string" ? r : r.phoneNumber,
          status: "rejected" as const,
          errorMessage: "Invalid phone number format",
          timestamp: new Date(),
        })),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/messaging`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: this.config.apiKey,
        },
        body: new URLSearchParams({
          username: this.config.username,
          to: formattedRecipients.join(","),
          message: messageText,
          from: this.config.senderId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse Africa's Talking response
      if (data.SMSMessageData?.Recipients) {
        for (const recipient of data.SMSMessageData.Recipients) {
          const success =
            recipient.status === "Success" || recipient.statusCode === 101;
          results.push({
            success,
            messageId: recipient.messageId,
            recipient: recipient.number,
            cost: parseFloat(recipient.cost?.replace("UGX ", "") || "0"),
            status: success ? "sent" : "failed",
            errorMessage: success ? undefined : recipient.status,
            timestamp: new Date(),
          });

          if (success) {
            totalCost += parseFloat(recipient.cost?.replace("UGX ", "") || "0");
          }
        }
      }
    } catch (error) {
      // Handle network or API errors
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      for (const phone of formattedRecipients) {
        results.push({
          success: false,
          recipient: phone,
          status: "failed",
          errorMessage,
          timestamp: new Date(),
        });
      }
    }

    return {
      totalSent: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      totalCost,
      results,
    };
  }

  /**
   * Mock send for development/testing
   */
  private mockSendBulk(message: SMSMessage): SMSBulkResult {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    let messageText: string;
    if (message.type === "custom" && message.customMessage) {
      messageText = message.customMessage;
    } else {
      messageText = renderTemplate(message.type, message.templateData || {});
    }

    console.log(`[SMS Mock] Sending to ${recipients.length} recipients:`);
    console.log(`[SMS Mock] Message: ${messageText}`);

    const results: SMSSendResult[] = recipients.map((r) => {
      const phone = typeof r === "string" ? r : r.phoneNumber;
      const formatted = formatUgandanPhone(phone);
      const valid = isValidUgandanPhone(formatted);

      console.log(`[SMS Mock] → ${formatted} (${valid ? "valid" : "invalid"})`);

      return {
        success: valid,
        messageId: valid
          ? `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`
          : undefined,
        recipient: formatted,
        cost: valid ? 30 : 0, // ~30 UGX per SMS in Uganda
        status: valid ? ("sent" as const) : ("rejected" as const),
        errorMessage: valid ? undefined : "Invalid phone number",
        timestamp: new Date(),
      };
    });

    return {
      totalSent: results.filter((r) => r.success).length,
      totalFailed: results.filter((r) => !r.success).length,
      totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
      results,
    };
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<SMSBalance | null> {
    if (!this.isConfigured()) {
      return { balance: "N/A (Not configured)", currency: "UGX" };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/user?username=${this.config.username}`,
        {
          headers: {
            Accept: "application/json",
            apiKey: this.config.apiKey,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        balance: data.UserData?.balance || "0",
        currency: "UGX",
      };
    } catch (error) {
      console.error("Failed to get SMS balance:", error);
      return null;
    }
  }

  /**
   * Fetch delivery reports
   */
  async getDeliveryReports(messageId?: string): Promise<SMSDeliveryReport[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const params = new URLSearchParams({ username: this.config.username });
      if (messageId) {
        params.append("messageId", messageId);
      }

      const response = await fetch(
        `${this.baseUrl}/messaging?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            apiKey: this.config.apiKey,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.SMSMessageData?.Messages || [];
    } catch (error) {
      console.error("Failed to get delivery reports:", error);
      return [];
    }
  }
}

// ============================================================================
// Singleton Instance & Convenience Functions
// ============================================================================

export const smsService = new SMSService();

/**
 * Send payment receipt SMS
 */
export async function sendPaymentReceiptSMS(data: {
  guardianPhone: string;
  guardianName: string;
  studentName: string;
  studentId: string;
  amount: number;
  balance: number;
  receiptNumber: string;
  schoolName: string;
}): Promise<SMSSendResult> {
  return smsService.send({
    to: { phoneNumber: data.guardianPhone, name: data.guardianName },
    type: "payment_receipt",
    templateData: {
      guardianName: data.guardianName,
      studentName: data.studentName,
      studentId: data.studentId,
      amount: data.amount.toLocaleString(),
      balance: data.balance.toLocaleString(),
      receiptNumber: data.receiptNumber,
      schoolName: data.schoolName,
    },
  });
}

/**
 * Send payment reminder SMS
 */
export async function sendPaymentReminderSMS(data: {
  guardianPhone: string;
  guardianName: string;
  studentName: string;
  balance: number;
  dueDate: string;
  schoolName: string;
}): Promise<SMSSendResult> {
  return smsService.send({
    to: { phoneNumber: data.guardianPhone, name: data.guardianName },
    type: "payment_reminder",
    templateData: {
      guardianName: data.guardianName,
      studentName: data.studentName,
      balance: data.balance.toLocaleString(),
      dueDate: data.dueDate,
      schoolName: data.schoolName,
    },
  });
}

/**
 * Send arrears notice SMS
 */
export async function sendArrearsNoticeSMS(data: {
  guardianPhone: string;
  guardianName: string;
  studentName: string;
  balance: number;
  daysOverdue: number;
  schoolName: string;
}): Promise<SMSSendResult> {
  return smsService.send({
    to: { phoneNumber: data.guardianPhone, name: data.guardianName },
    type: "arrears_notice",
    templateData: {
      guardianName: data.guardianName,
      studentName: data.studentName,
      balance: data.balance.toLocaleString(),
      daysOverdue: data.daysOverdue,
      schoolName: data.schoolName,
    },
  });
}

/**
 * Send clearance granted SMS
 */
export async function sendClearanceGrantedSMS(data: {
  guardianPhone: string;
  guardianName: string;
  studentName: string;
  term: string;
  schoolName: string;
}): Promise<SMSSendResult> {
  return smsService.send({
    to: { phoneNumber: data.guardianPhone, name: data.guardianName },
    type: "clearance_granted",
    templateData: {
      guardianName: data.guardianName,
      studentName: data.studentName,
      term: data.term,
      schoolName: data.schoolName,
    },
  });
}

/**
 * Send bulk payment reminders
 */
export async function sendBulkPaymentReminders(
  recipients: Array<{
    guardianPhone: string;
    guardianName: string;
    studentName: string;
    balance: number;
  }>,
  dueDate: string,
  schoolName: string,
): Promise<SMSBulkResult> {
  // For bulk, we need to send individual messages due to template personalization
  const results: SMSSendResult[] = [];
  let totalCost = 0;

  for (const recipient of recipients) {
    const result = await sendPaymentReminderSMS({
      ...recipient,
      dueDate,
      schoolName,
    });
    results.push(result);
    totalCost += result.cost || 0;
  }

  return {
    totalSent: results.filter((r) => r.success).length,
    totalFailed: results.filter((r) => !r.success).length,
    totalCost,
    results,
  };
}

/**
 * Send custom SMS
 */
export async function sendCustomSMS(
  recipients: SMSRecipient[],
  message: string,
): Promise<SMSBulkResult> {
  return smsService.sendBulk({
    to: recipients,
    type: "custom",
    customMessage: message,
  });
}

export default smsService;
