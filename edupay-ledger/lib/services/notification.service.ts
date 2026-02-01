/**
 * Notification Service
 *
 * Handles SMS and Email notifications to parents/guardians
 *
 * SMS Notifications:
 * - Payment receipts
 * - Deadline reminders (7 days, 3 days, overdue)
 * - Balance alerts
 *
 * Email Notifications:
 * - Payment receipts with PDF attachment
 * - Monthly statements (optional)
 */

import { httpsCallable } from "firebase/functions";
import { functions, initializeFirebase } from "@/lib/firebase";
import { formatUGX } from "@/lib/utils";

// Notification types
export interface SMSNotification {
  phoneNumber: string;
  message: string;
  priority?: "high" | "normal" | "low";
}

export interface EmailNotification {
  email: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: Array<{
    filename: string;
    url: string;
  }>;
}

export interface PaymentReceiptSMSData {
  phoneNumber: string;
  studentName: string;
  amount: number;
  balance: number;
  receiptNumber: string;
}

export interface PaymentReceiptEmailData {
  email: string;
  studentName: string;
  amount: number;
  balance: number;
  receiptNumber: string;
  receiptUrl?: string;
}

export interface DeadlineReminderData {
  phoneNumber: string;
  studentName: string;
  installmentName: string;
  amountDue: number;
  deadline: Date;
  daysUntilDeadline: number;
}

export interface OverdueAlertData {
  phoneNumber: string;
  studentName: string;
  installmentName: string;
  amountOverdue: number;
  daysOverdue: number;
}

/**
 * Formats a Ugandan phone number for SMS sending
 * Ensures number starts with +256
 */
function formatUgandanPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, "");

  if (cleaned.startsWith("+256")) {
    return cleaned;
  }

  if (cleaned.startsWith("256")) {
    return "+" + cleaned;
  }

  if (cleaned.startsWith("0")) {
    return "+256" + cleaned.substring(1);
  }

  return "+256" + cleaned;
}

/**
 * Sends an SMS notification
 * Uses Firebase Cloud Functions to handle actual SMS sending
 */
async function sendSMS(notification: SMSNotification): Promise<boolean> {
  initializeFirebase();

  try {
    // In production, this would call a Cloud Function that uses an SMS provider
    // like Africa's Talking, Twilio, or a local Ugandan SMS gateway
    const sendSMSFunction = httpsCallable(functions, "sendSMS");

    await sendSMSFunction({
      to: formatUgandanPhone(notification.phoneNumber),
      message: notification.message,
      priority: notification.priority || "normal",
    });

    console.log(`SMS sent to ${notification.phoneNumber}`);
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    // In production, queue for retry
    return false;
  }
}

/**
 * Sends an email notification
 * Uses Firebase Cloud Functions to handle actual email sending
 */
async function sendEmail(notification: EmailNotification): Promise<boolean> {
  initializeFirebase();

  try {
    const sendEmailFunction = httpsCallable(functions, "sendEmail");

    await sendEmailFunction({
      to: notification.email,
      subject: notification.subject,
      text: notification.body,
      html: notification.htmlBody,
      attachments: notification.attachments,
    });

    console.log(`Email sent to ${notification.email}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Sends payment receipt SMS to parent/guardian
 */
export async function sendPaymentReceiptSMS(
  data: PaymentReceiptSMSData,
): Promise<boolean> {
  const message =
    `eBursar: Payment received for ${data.studentName}.\n` +
    `Amount: ${formatUGX(data.amount)}\n` +
    `New Balance: ${formatUGX(data.balance)}\n` +
    `Receipt: ${data.receiptNumber}\n` +
    `Thank you!`;

  return sendSMS({
    phoneNumber: data.phoneNumber,
    message,
    priority: "high",
  });
}

/**
 * Sends payment receipt email with PDF attachment
 */
export async function sendPaymentReceiptEmail(
  data: PaymentReceiptEmailData,
): Promise<boolean> {
  const subject = `Payment Receipt - ${data.receiptNumber}`;

  const body = `Dear Parent/Guardian,

This is to confirm that we have received payment for ${data.studentName}.

Payment Details:
- Amount: ${formatUGX(data.amount)}
- Receipt Number: ${data.receiptNumber}
- Outstanding Balance: ${formatUGX(data.balance)}

${data.balance === 0 ? "The school fees are now fully paid. Thank you!" : `Please settle the remaining balance at your earliest convenience.`}

Best regards,
School Accounts Office

---
This is an automated message from eBursar.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1b2b4b;">Payment Receipt</h2>
      <p>Dear Parent/Guardian,</p>
      <p>This is to confirm that we have received payment for <strong>${data.studentName}</strong>.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1b2b4b;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Amount:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #22c55e;">${formatUGX(data.amount)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">Receipt Number:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${data.receiptNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Outstanding Balance:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${data.balance === 0 ? "#22c55e" : "#f59e0b"};">${formatUGX(data.balance)}</td>
          </tr>
        </table>
      </div>
      
      ${
        data.balance === 0
          ? '<p style="color: #22c55e; font-weight: bold;">✓ The school fees are now fully paid. Thank you!</p>'
          : "<p>Please settle the remaining balance at your earliest convenience.</p>"
      }
      
      <p style="margin-top: 30px;">Best regards,<br>School Accounts Office</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">This is an automated message from eBursar.</p>
    </div>
  `;

  return sendEmail({
    email: data.email,
    subject,
    body,
    htmlBody,
    attachments: data.receiptUrl
      ? [
          {
            filename: `Receipt_${data.receiptNumber}.pdf`,
            url: data.receiptUrl,
          },
        ]
      : undefined,
  });
}

/**
 * Sends deadline reminder SMS
 * Should be sent 7 days, 3 days before deadline
 */
export async function sendDeadlineReminderSMS(
  data: DeadlineReminderData,
): Promise<boolean> {
  const message =
    data.daysUntilDeadline <= 0
      ? `eBursar Alert: ${data.installmentName} for ${data.studentName} is now OVERDUE. Amount: ${formatUGX(data.amountDue)}. Please pay immediately.`
      : `eBursar Reminder: ${data.installmentName} for ${data.studentName} is due in ${data.daysUntilDeadline} day(s). Amount: ${formatUGX(data.amountDue)}. Deadline: ${data.deadline.toLocaleDateString()}.`;

  return sendSMS({
    phoneNumber: data.phoneNumber,
    message,
    priority: data.daysUntilDeadline <= 3 ? "high" : "normal",
  });
}

/**
 * Sends overdue alert SMS
 */
export async function sendOverdueAlertSMS(
  data: OverdueAlertData,
): Promise<boolean> {
  const message = `eBursar URGENT: ${data.installmentName} for ${data.studentName} is ${data.daysOverdue} day(s) overdue. Amount: ${formatUGX(data.amountOverdue)}. Please clear immediately to avoid penalties.`;

  return sendSMS({
    phoneNumber: data.phoneNumber,
    message,
    priority: "high",
  });
}

/**
 * Batch send deadline reminders
 * Should be called daily by a scheduled function
 */
export async function sendScheduledReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  // This would be implemented as a Firebase Cloud Function
  // that runs daily and checks for upcoming deadlines
  console.log("Sending scheduled reminders...");
  return { sent: 0, failed: 0 };
}
