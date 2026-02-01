/**
 * Email Notification Service
 *
 * Professional email service for eBursar
 * Supports multiple providers: SendGrid, Mailgun, SMTP
 * Optimized for Ugandan schools with HTML/plain text templates
 */

import { formatUGX, formatDate } from '@/lib/utils';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type EmailProvider = 'sendgrid' | 'mailgun' | 'smtp' | 'mock';

export interface EmailConfig {
  provider: EmailProvider;
  apiKey?: string;
  domain?: string; // For Mailgun
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  // SMTP specific
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
}

export type EmailTemplateType =
  | 'payment_receipt'
  | 'payment_reminder'
  | 'arrears_notice'
  | 'clearance_granted'
  | 'fee_structure'
  | 'term_report'
  | 'welcome'
  | 'password_reset'
  | 'account_verification'
  | 'bulk_reminder'
  | 'custom';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  encoding?: 'base64' | 'utf-8';
}

export interface SendEmailRequest {
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  type: EmailTemplateType;
  templateData: Record<string, string | number | boolean | undefined>;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  timestamp: Date;
  status: 'sent' | 'queued' | 'failed' | 'bounced';
  error?: string;
  provider: EmailProvider;
}

export interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  results: EmailResult[];
  timestamp: Date;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Email templates with HTML and plain text versions
 */
const EMAIL_TEMPLATES: Record<EmailTemplateType, { subject: string; html: string; text: string }> = {
  payment_receipt: {
    subject: 'Payment Receipt - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .receipt-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .receipt-row:last-child { border-bottom: none; }
    .label { color: #64748b; }
    .value { font-weight: 600; color: #1e293b; }
    .amount { font-size: 28px; color: #22c55e; font-weight: bold; text-align: center; margin: 20px 0; }
    .balance { background: #fef3c7; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }
    .balance.paid { background: #dcfce7; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    .btn { display: inline-block; background: #1b2b4b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{schoolName}</h1>
      <p>Payment Receipt</p>
    </div>
    <div class="content">
      <p>Dear {guardianName},</p>
      <p>We have received your payment. Thank you for your prompt remittance.</p>
      
      <div class="amount">UGX {amount}</div>
      
      <div class="receipt-box">
        <div class="receipt-row">
          <span class="label">Receipt Number</span>
          <span class="value">{receiptNumber}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Student Name</span>
          <span class="value">{studentName}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Student ID</span>
          <span class="value">{studentId}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Class</span>
          <span class="value">{className}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Payment Date</span>
          <span class="value">{paymentDate}</span>
        </div>
        <div class="receipt-row">
          <span class="label">Payment Channel</span>
          <span class="value">{paymentChannel}</span>
        </div>
      </div>
      
      <div class="balance {balanceClass}">
        <strong>Outstanding Balance: UGX {balance}</strong>
      </div>
      
      <p>This receipt serves as official confirmation of your payment. Please keep it for your records.</p>
      
      <p>For any inquiries, please contact the school bursar's office.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar - Secure School Fee Management</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
PAYMENT RECEIPT - {schoolName}

Dear {guardianName},

We have received your payment of UGX {amount}. Thank you for your prompt remittance.

RECEIPT DETAILS:
- Receipt Number: {receiptNumber}
- Student Name: {studentName}
- Student ID: {studentId}
- Class: {className}
- Payment Date: {paymentDate}
- Payment Channel: {paymentChannel}

Outstanding Balance: UGX {balance}

This receipt serves as official confirmation of your payment. Please keep it for your records.

For any inquiries, please contact the school bursar's office.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  payment_reminder: {
    subject: 'Payment Reminder - {studentName} - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #f59e0b; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; }
    .amount { font-size: 28px; color: #dc2626; font-weight: bold; text-align: center; margin: 20px 0; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Reminder</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Dear {guardianName},</p>
      
      <div class="alert-box">
        <strong>This is a friendly reminder</strong> that school fees for {studentName} are due.
      </div>
      
      <div class="amount">Outstanding: UGX {balance}</div>
      
      <div class="details">
        <p><strong>Student:</strong> {studentName}</p>
        <p><strong>Class:</strong> {className}</p>
        <p><strong>Due Date:</strong> {dueDate}</p>
        <p><strong>Term:</strong> {term}</p>
      </div>
      
      <p>Please make your payment at your earliest convenience to avoid any inconvenience to your child's education.</p>
      
      <p><strong>Payment Options:</strong></p>
      <ul>
        <li>Mobile Money (MTN, Airtel)</li>
        <li>Bank Transfer</li>
        <li>Cash at the Bursar's Office</li>
      </ul>
      
      <p>If you have already made this payment, please disregard this reminder.</p>
      
      <p>Thank you for your cooperation.</p>
    </div>
    <div class="footer">
      <p>This is an automated reminder from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
PAYMENT REMINDER - {schoolName}

Dear {guardianName},

This is a friendly reminder that school fees for {studentName} are due.

Outstanding Balance: UGX {balance}

STUDENT DETAILS:
- Student: {studentName}
- Class: {className}
- Due Date: {dueDate}
- Term: {term}

Please make your payment at your earliest convenience.

Payment Options:
- Mobile Money (MTN, Airtel)
- Bank Transfer
- Cash at the Bursar's Office

If you have already made this payment, please disregard this reminder.

Thank you for your cooperation.

---
This is an automated reminder from {schoolName}
Powered by eBursar
    `,
  },

  arrears_notice: {
    subject: 'URGENT: Outstanding Fees Notice - {studentName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Arrears Notice</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .urgent-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; }
    .amount { font-size: 28px; color: #dc2626; font-weight: bold; text-align: center; margin: 20px 0; }
    .overdue { background: #fee2e2; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; color: #991b1b; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ URGENT: Arrears Notice</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Dear {guardianName},</p>
      
      <div class="urgent-box">
        <strong>IMPORTANT:</strong> The fees for {studentName} are now significantly overdue and require immediate attention.
      </div>
      
      <div class="amount">Outstanding: UGX {balance}</div>
      
      <div class="overdue">
        <strong>{daysOverdue} days overdue</strong>
      </div>
      
      <p>Despite previous reminders, the outstanding balance remains unpaid. We kindly request that you settle this amount immediately to:</p>
      
      <ul>
        <li>Ensure uninterrupted education for your child</li>
        <li>Maintain eligibility for examinations</li>
        <li>Avoid additional administrative measures</li>
      </ul>
      
      <p>If you are experiencing financial difficulties, please contact the school administration to discuss a payment arrangement.</p>
      
      <p><strong>Contact:</strong> {schoolPhone}</p>
      
      <p>We appreciate your immediate attention to this matter.</p>
    </div>
    <div class="footer">
      <p>This is an automated notice from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
⚠️ URGENT: ARREARS NOTICE - {schoolName}

Dear {guardianName},

IMPORTANT: The fees for {studentName} are now significantly overdue and require immediate attention.

Outstanding Balance: UGX {balance}
Days Overdue: {daysOverdue}

Despite previous reminders, the outstanding balance remains unpaid. We kindly request that you settle this amount immediately to:
- Ensure uninterrupted education for your child
- Maintain eligibility for examinations
- Avoid additional administrative measures

If you are experiencing financial difficulties, please contact the school administration to discuss a payment arrangement.

Contact: {schoolPhone}

We appreciate your immediate attention to this matter.

---
This is an automated notice from {schoolName}
Powered by eBursar
    `,
  },

  clearance_granted: {
    subject: 'Exam Clearance Granted - {studentName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clearance Granted</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #22c55e; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .success-box { background: #dcfce7; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0; text-align: center; }
    .checkmark { font-size: 48px; margin-bottom: 10px; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Exam Clearance Granted</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Dear {guardianName},</p>
      
      <div class="success-box">
        <div class="checkmark">✅</div>
        <h2>Clearance Approved!</h2>
        <p>{studentName} has been cleared to sit for examinations.</p>
      </div>
      
      <div class="details">
        <p><strong>Student:</strong> {studentName}</p>
        <p><strong>Student ID:</strong> {studentId}</p>
        <p><strong>Class:</strong> {className}</p>
        <p><strong>Clearance ID:</strong> {clearanceId}</p>
        <p><strong>Valid Until:</strong> {validUntil}</p>
      </div>
      
      <p>Thank you for ensuring your child's fees are up to date. We wish {studentName} the best in their upcoming examinations.</p>
      
      <p>Please ensure your child reports for exams on time with all necessary materials.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
✓ EXAM CLEARANCE GRANTED - {schoolName}

Dear {guardianName},

Great news! {studentName} has been cleared to sit for examinations.

CLEARANCE DETAILS:
- Student: {studentName}
- Student ID: {studentId}
- Class: {className}
- Clearance ID: {clearanceId}
- Valid Until: {validUntil}

Thank you for ensuring your child's fees are up to date. We wish {studentName} the best in their upcoming examinations.

Please ensure your child reports for exams on time with all necessary materials.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  fee_structure: {
    subject: 'Fee Structure - {term} {year} - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fee Structure</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; }
    .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 20px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{schoolName}</h1>
      <p>Fee Structure - {term} {year}</p>
    </div>
    <div class="content">
      <p>Dear Parent/Guardian,</p>
      <p>Please find below the fee structure for {term} {year}.</p>
      
      <table>
        <thead>
          <tr>
            <th>Fee Category</th>
            <th style="text-align: right;">Amount (UGX)</th>
          </tr>
        </thead>
        <tbody>
          {feeItems}
        </tbody>
      </table>
      
      <div class="total">
        Total: UGX {totalFees}
      </div>
      
      <p><strong>Payment Deadline:</strong> {deadline}</p>
      
      <p>Please ensure payments are made before the deadline to avoid any inconvenience.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
FEE STRUCTURE - {term} {year} - {schoolName}

Dear Parent/Guardian,

Please find below the fee structure for {term} {year}.

{feeItemsText}

Total: UGX {totalFees}

Payment Deadline: {deadline}

Please ensure payments are made before the deadline to avoid any inconvenience.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  term_report: {
    subject: 'Term Summary Report - {term} {year}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Term Report</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat { text-align: center; padding: 20px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #1b2b4b; }
    .stat-label { font-size: 12px; color: #64748b; }
    .progress { height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden; margin: 20px 0; }
    .progress-bar { height: 100%; background: #22c55e; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{schoolName}</h1>
      <p>Term Summary Report - {term} {year}</p>
    </div>
    <div class="content">
      <p>Dear Administrator,</p>
      <p>Here is the fee collection summary for {term} {year}.</p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">UGX {totalCollected}</div>
          <div class="stat-label">COLLECTED</div>
        </div>
        <div class="stat">
          <div class="stat-value">UGX {totalOutstanding}</div>
          <div class="stat-label">OUTSTANDING</div>
        </div>
        <div class="stat">
          <div class="stat-value">{collectionRate}%</div>
          <div class="stat-label">RATE</div>
        </div>
      </div>
      
      <h3>Collection Progress</h3>
      <div class="progress">
        <div class="progress-bar" style="width: {collectionRate}%"></div>
      </div>
      
      <h3>Student Status</h3>
      <ul>
        <li>Fully Paid: {fullyPaidCount}</li>
        <li>Partial Payment: {partialCount}</li>
        <li>No Payment: {noPaidCount}</li>
      </ul>
      
      <p>This report was automatically generated. Please log in to the system for detailed analytics.</p>
    </div>
    <div class="footer">
      <p>Generated: {generatedAt}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
TERM SUMMARY REPORT - {term} {year} - {schoolName}

Fee Collection Summary:
- Total Collected: UGX {totalCollected}
- Total Outstanding: UGX {totalOutstanding}
- Collection Rate: {collectionRate}%

Student Status:
- Fully Paid: {fullyPaidCount}
- Partial Payment: {partialCount}
- No Payment: {noPaidCount}

This report was automatically generated.

Generated: {generatedAt}
Powered by eBursar
    `,
  },

  welcome: {
    subject: 'Welcome to {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .welcome-box { background: #dbeafe; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .btn { display: inline-block; background: #1b2b4b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {schoolName}!</h1>
    </div>
    <div class="content">
      <p>Dear {guardianName},</p>
      
      <div class="welcome-box">
        <h2>🎉 Welcome!</h2>
        <p>We are pleased to have {studentName} join our school family.</p>
      </div>
      
      <p>Your child has been enrolled with the following details:</p>
      <ul>
        <li><strong>Student ID:</strong> {studentId}</li>
        <li><strong>Class:</strong> {className}</li>
        <li><strong>Term:</strong> {term} {year}</li>
      </ul>
      
      <p>You can access the parent portal to:</p>
      <ul>
        <li>View fee balances and payment history</li>
        <li>Make online payments</li>
        <li>Download receipts</li>
        <li>Track your child's fee status</li>
      </ul>
      
      <p>If you have any questions, please don't hesitate to contact us.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
WELCOME TO {schoolName}!

Dear {guardianName},

We are pleased to have {studentName} join our school family.

Enrollment Details:
- Student ID: {studentId}
- Class: {className}
- Term: {term} {year}

You can access the parent portal to:
- View fee balances and payment history
- Make online payments
- Download receipts
- Track your child's fee status

If you have any questions, please don't hesitate to contact us.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  password_reset: {
    subject: 'Password Reset Request - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .code-box { background: #f8fafc; border: 2px dashed #1b2b4b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1b2b4b; }
    .warning { background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the code below to complete the process:</p>
      
      <div class="code-box">
        <div class="code">{resetCode}</div>
        <p style="margin-top: 10px; font-size: 12px; color: #64748b;">This code expires in {expiryMinutes} minutes</p>
      </div>
      
      <div class="warning">
        ⚠️ If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
PASSWORD RESET - {schoolName}

Hello,

We received a request to reset your password. Use the code below to complete the process:

Reset Code: {resetCode}

This code expires in {expiryMinutes} minutes.

If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  account_verification: {
    subject: 'Verify Your Email - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify Email</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .btn { display: inline-block; background: #22c55e; color: white; padding: 15px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; }
    .code-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Hello {userName},</p>
      <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{verificationLink}" class="btn">Verify Email Address</a>
      </div>
      
      <p>Or use this verification code:</p>
      <div class="code-box">
        <strong style="font-size: 24px; letter-spacing: 3px;">{verificationCode}</strong>
      </div>
      
      <p>This link/code expires in 24 hours.</p>
    </div>
    <div class="footer">
      <p>If you didn't create an account, please ignore this email.</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
VERIFY YOUR EMAIL - {schoolName}

Hello {userName},

Thank you for registering. Please verify your email address to complete your account setup.

Verification Code: {verificationCode}

Or visit: {verificationLink}

This link/code expires in 24 hours.

If you didn't create an account, please ignore this email.

---
Powered by eBursar
    `,
  },

  bulk_reminder: {
    subject: 'Fee Payment Reminder - {schoolName}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fee Reminder</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #f59e0b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Fee Payment Reminder</h1>
      <p>{schoolName}</p>
    </div>
    <div class="content">
      <p>Dear Parent/Guardian,</p>
      <p>{message}</p>
      <p>Thank you for your continued support.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from {schoolName}</p>
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `
FEE PAYMENT REMINDER - {schoolName}

Dear Parent/Guardian,

{message}

Thank you for your continued support.

---
This is an automated message from {schoolName}
Powered by eBursar
    `,
  },

  custom: {
    subject: '{subject}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1b2b4b; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{schoolName}</h1>
    </div>
    <div class="content">
      {htmlContent}
    </div>
    <div class="footer">
      <p>Powered by eBursar</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `{textContent}`,
  },
};

// ============================================================================
// TEMPLATE RENDERING
// ============================================================================

/**
 * Renders an email template with the provided data
 */
export function renderEmailTemplate(
  type: EmailTemplateType,
  data: Record<string, string | number | boolean | undefined>
): { subject: string; html: string; text: string } {
  const template = EMAIL_TEMPLATES[type];

  const render = (str: string): string => {
    return str.replace(/\{(\w+)\}/g, (_, key) => {
      const value = data[key];
      return value !== undefined ? String(value) : `{${key}}`;
    });
  };

  return {
    subject: render(template.subject),
    html: render(template.html),
    text: render(template.text),
  };
}

// ============================================================================
// EMAIL SERVICE CLASS
// ============================================================================

/**
 * Default email configuration
 */
const DEFAULT_CONFIG: EmailConfig = {
  provider: 'mock',
  fromEmail: 'noreply@school.edu.ug',
  fromName: 'eBursar',
};

/**
 * Email Service for sending notifications
 */
class EmailService {
  private config: EmailConfig;
  private sentEmails: EmailResult[] = [];
  private readonly maxRetries = 3;

  constructor(config: Partial<EmailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Updates the service configuration
   */
  configure(config: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Checks if the service is properly configured
   */
  isConfigured(): boolean {
    if (this.config.provider === 'mock') return true;

    switch (this.config.provider) {
      case 'sendgrid':
        return !!this.config.apiKey;
      case 'mailgun':
        return !!this.config.apiKey && !!this.config.domain;
      case 'smtp':
        return !!this.config.smtpHost && !!this.config.smtpUser;
      default:
        return false;
    }
  }

  /**
   * Validates an email address
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sends an email
   */
  async send(request: SendEmailRequest): Promise<EmailResult> {
    const recipients = Array.isArray(request.to) ? request.to : [request.to];

    // Validate recipients
    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient.email)) {
        return {
          success: false,
          recipient: recipient.email,
          timestamp: new Date(),
          status: 'failed',
          error: `Invalid email address: ${recipient.email}`,
          provider: this.config.provider,
        };
      }
    }

    // Render template
    const { subject, html, text } = renderEmailTemplate(request.type, request.templateData);

    // Send based on provider
    switch (this.config.provider) {
      case 'sendgrid':
        return this.sendViaSendGrid(recipients, subject, html, text, request);
      case 'mailgun':
        return this.sendViaMailgun(recipients, subject, html, text, request);
      case 'smtp':
        return this.sendViaSMTP(recipients, subject, html, text, request);
      case 'mock':
      default:
        return this.sendMock(recipients, subject, html, text);
    }
  }

  /**
   * Sends email via SendGrid
   */
  private async sendViaSendGrid(
    recipients: EmailRecipient[],
    subject: string,
    html: string,
    text: string,
    request: SendEmailRequest
  ): Promise<EmailResult> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: recipients.map(r => ({ email: r.email, name: r.name })),
            cc: request.cc?.map(r => ({ email: r.email, name: r.name })),
            bcc: request.bcc?.map(r => ({ email: r.email, name: r.name })),
          }],
          from: { email: this.config.fromEmail, name: this.config.fromName },
          reply_to: this.config.replyTo ? { email: this.config.replyTo } : undefined,
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
          attachments: request.attachments?.map(a => ({
            content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
            filename: a.filename,
            type: a.contentType,
            disposition: 'attachment',
          })),
          tracking_settings: {
            open_tracking: { enable: request.trackOpens ?? false },
            click_tracking: { enable: request.trackClicks ?? false },
          },
        }),
      });

      const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}`;

      const result: EmailResult = {
        success: response.ok,
        messageId,
        recipient: recipients.map(r => r.email).join(', '),
        timestamp: new Date(),
        status: response.ok ? 'sent' : 'failed',
        error: response.ok ? undefined : `SendGrid error: ${response.status}`,
        provider: 'sendgrid',
      };

      this.sentEmails.push(result);
      return result;
    } catch (error) {
      const result: EmailResult = {
        success: false,
        recipient: recipients.map(r => r.email).join(', '),
        timestamp: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'sendgrid',
      };
      this.sentEmails.push(result);
      return result;
    }
  }

  /**
   * Sends email via Mailgun
   */
  private async sendViaMailgun(
    recipients: EmailRecipient[],
    subject: string,
    html: string,
    text: string,
    request: SendEmailRequest
  ): Promise<EmailResult> {
    try {
      const formData = new FormData();
      formData.append('from', `${this.config.fromName} <${this.config.fromEmail}>`);
      formData.append('to', recipients.map(r => `${r.name} <${r.email}>`).join(', '));
      formData.append('subject', subject);
      formData.append('text', text);
      formData.append('html', html);

      if (request.cc?.length) {
        formData.append('cc', request.cc.map(r => `${r.name} <${r.email}>`).join(', '));
      }
      if (request.bcc?.length) {
        formData.append('bcc', request.bcc.map(r => `${r.name} <${r.email}>`).join(', '));
      }

      const response = await fetch(
        `https://api.mailgun.net/v3/${this.config.domain}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`api:${this.config.apiKey}`)}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      const result: EmailResult = {
        success: response.ok,
        messageId: data.id,
        recipient: recipients.map(r => r.email).join(', '),
        timestamp: new Date(),
        status: response.ok ? 'queued' : 'failed',
        error: response.ok ? undefined : data.message,
        provider: 'mailgun',
      };

      this.sentEmails.push(result);
      return result;
    } catch (error) {
      const result: EmailResult = {
        success: false,
        recipient: recipients.map(r => r.email).join(', '),
        timestamp: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'mailgun',
      };
      this.sentEmails.push(result);
      return result;
    }
  }

  /**
   * Sends email via SMTP (placeholder - needs Node.js nodemailer)
   */
  private async sendViaSMTP(
    recipients: EmailRecipient[],
    subject: string,
    html: string,
    text: string,
    request: SendEmailRequest
  ): Promise<EmailResult> {
    // Note: SMTP requires server-side implementation with nodemailer
    // This is a placeholder that would need to be implemented on the server
    console.warn('SMTP sending requires server-side implementation');

    // For now, fall back to mock
    return this.sendMock(recipients, subject, html, text);
  }

  /**
   * Mock email sending for development/testing
   */
  private async sendMock(
    recipients: EmailRecipient[],
    subject: string,
    html: string,
    text: string
  ): Promise<EmailResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('📧 [MOCK EMAIL]');
    console.log(`   To: ${recipients.map(r => r.email).join(', ')}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${text.substring(0, 100)}...`);

    const result: EmailResult = {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient: recipients.map(r => r.email).join(', '),
      timestamp: new Date(),
      status: 'sent',
      provider: 'mock',
    };

    this.sentEmails.push(result);
    return result;
  }

  /**
   * Sends bulk emails
   */
  async sendBulk(requests: SendEmailRequest[]): Promise<BulkEmailResult> {
    const results: EmailResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const request of requests) {
      const result = await this.send(request);
      results.push(result);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
      // Add small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
      total: requests.length,
      sent,
      failed,
      results,
      timestamp: new Date(),
    };
  }

  /**
   * Gets sent email history
   */
  getSentEmails(): EmailResult[] {
    return [...this.sentEmails];
  }

  /**
   * Clears sent email history
   */
  clearHistory(): void {
    this.sentEmails = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const emailService = new EmailService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Sends a payment receipt email
 */
export async function sendPaymentReceiptEmail(params: {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentId: string;
  className: string;
  amount: number;
  balance: number;
  receiptNumber: string;
  paymentDate: Date;
  paymentChannel: string;
  schoolName: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: { email: params.guardianEmail, name: params.guardianName },
    subject: `Payment Receipt - ${params.schoolName}`,
    type: 'payment_receipt',
    templateData: {
      guardianName: params.guardianName,
      studentName: params.studentName,
      studentId: params.studentId,
      className: params.className,
      amount: formatUGX(params.amount),
      balance: formatUGX(params.balance),
      balanceClass: params.balance === 0 ? 'paid' : '',
      receiptNumber: params.receiptNumber,
      paymentDate: formatDate(params.paymentDate),
      paymentChannel: params.paymentChannel,
      schoolName: params.schoolName,
    },
  });
}

/**
 * Sends a payment reminder email
 */
export async function sendPaymentReminderEmail(params: {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  className: string;
  balance: number;
  dueDate: string;
  term: string;
  schoolName: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: { email: params.guardianEmail, name: params.guardianName },
    subject: `Payment Reminder - ${params.studentName}`,
    type: 'payment_reminder',
    templateData: {
      guardianName: params.guardianName,
      studentName: params.studentName,
      className: params.className,
      balance: formatUGX(params.balance),
      dueDate: params.dueDate,
      term: params.term,
      schoolName: params.schoolName,
    },
  });
}

/**
 * Sends an arrears notice email
 */
export async function sendArrearsNoticeEmail(params: {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  balance: number;
  daysOverdue: number;
  schoolName: string;
  schoolPhone: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: { email: params.guardianEmail, name: params.guardianName },
    subject: `URGENT: Outstanding Fees Notice - ${params.studentName}`,
    type: 'arrears_notice',
    priority: 'high',
    templateData: {
      guardianName: params.guardianName,
      studentName: params.studentName,
      balance: formatUGX(params.balance),
      daysOverdue: params.daysOverdue,
      schoolName: params.schoolName,
      schoolPhone: params.schoolPhone,
    },
  });
}

/**
 * Sends an exam clearance notification email
 */
export async function sendClearanceGrantedEmail(params: {
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentId: string;
  className: string;
  clearanceId: string;
  validUntil: string;
  schoolName: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: { email: params.guardianEmail, name: params.guardianName },
    subject: `Exam Clearance Granted - ${params.studentName}`,
    type: 'clearance_granted',
    templateData: {
      guardianName: params.guardianName,
      studentName: params.studentName,
      studentId: params.studentId,
      className: params.className,
      clearanceId: params.clearanceId,
      validUntil: params.validUntil,
      schoolName: params.schoolName,
    },
  });
}

/**
 * Sends a term report email to administrators
 */
export async function sendTermReportEmail(params: {
  adminEmail: string;
  adminName: string;
  term: string;
  year: string;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  fullyPaidCount: number;
  partialCount: number;
  noPaidCount: number;
  schoolName: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: { email: params.adminEmail, name: params.adminName },
    subject: `Term Summary Report - ${params.term} ${params.year}`,
    type: 'term_report',
    templateData: {
      term: params.term,
      year: params.year,
      totalCollected: formatUGX(params.totalCollected),
      totalOutstanding: formatUGX(params.totalOutstanding),
      collectionRate: params.collectionRate,
      fullyPaidCount: params.fullyPaidCount,
      partialCount: params.partialCount,
      noPaidCount: params.noPaidCount,
      schoolName: params.schoolName,
      generatedAt: formatDate(new Date()),
    },
  });
}

/**
 * Sends a custom email
 */
export async function sendCustomEmail(params: {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
  schoolName: string;
}): Promise<EmailResult> {
  return emailService.send({
    to: params.to,
    subject: params.subject,
    type: 'custom',
    templateData: {
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
      schoolName: params.schoolName,
    },
  });
}
