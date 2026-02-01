/**
 * Receipt Service
 *
 * Generates digital and printable PDF receipts for payments
 */

import { Payment } from "@/types/payment";
import { Student } from "@/types/student";
import { formatUGX } from "@/lib/utils";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage, initializeFirebase } from "@/lib/firebase";

export interface ReceiptData {
  payment: Payment;
  student: Student;
  newBalance: number;
}

export interface Receipt {
  receiptNumber: string;
  date: string;
  studentName: string;
  studentId: string;
  className: string;
  streamName?: string;
  guardianName: string;
  guardianPhone: string;
  amount: number;
  amountWords: string;
  paymentChannel: string;
  transactionRef: string;
  installmentName: string;
  previousBalance: number;
  newBalance: number;
  schoolName: string;
  schoolAddress: string;
  stellarHash?: string;
}

/**
 * Converts a number to words (for receipt amounts)
 */
function numberToWords(num: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  if (num === 0) return "Zero";

  const convertGroup = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + convertGroup(n % 100) : "")
    );
  };

  let result = "";

  if (num >= 1000000) {
    result += convertGroup(Math.floor(num / 1000000)) + " Million ";
    num %= 1000000;
  }

  if (num >= 1000) {
    result += convertGroup(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }

  if (num > 0) {
    result += convertGroup(num);
  }

  return result.trim() + " Shillings Only";
}

/**
 * Generates receipt data from payment
 */
export function createReceiptData(data: ReceiptData): Receipt {
  const { payment, student, newBalance } = data;

  return {
    receiptNumber: payment.receiptNumber,
    date: payment.recordedAt.toDate().toLocaleDateString("en-UG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    studentName:
      `${student.firstName} ${student.middleName || ""} ${student.lastName}`.trim(),
    studentId: student.studentId,
    className: student.className,
    streamName: student.streamName,
    guardianName: student.guardian.name,
    guardianPhone: student.guardian.phone,
    amount: payment.amount,
    amountWords: numberToWords(payment.amount),
    paymentChannel: payment.channelDetails || payment.channel,
    transactionRef: payment.transactionRef,
    installmentName: payment.installmentName,
    previousBalance: newBalance + payment.amount,
    newBalance: newBalance,
    schoolName: "School Name", // Would come from school settings
    schoolAddress: "School Address", // Would come from school settings
    stellarHash: payment.stellarTxHash,
  };
}

/**
 * Generates HTML receipt for display and printing
 */
export function generateReceiptHTML(receipt: Receipt): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Payment Receipt - ${receipt.receiptNumber}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #f5f5f5;
          padding: 20px;
        }
        .receipt {
          max-width: 400px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .receipt-header {
          background: linear-gradient(135deg, #1b2b4b, #2d4a7c);
          color: white;
          padding: 24px;
          text-align: center;
        }
        .receipt-header h1 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .receipt-header p {
          font-size: 12px;
          opacity: 0.8;
        }
        .receipt-number {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 8px 16px;
          display: inline-block;
          margin-top: 12px;
          font-size: 14px;
          font-weight: 600;
        }
        .receipt-body {
          padding: 24px;
        }
        .receipt-date {
          text-align: center;
          color: #666;
          font-size: 13px;
          margin-bottom: 20px;
        }
        .student-info {
          background: #f8fafc;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .student-name {
          font-size: 16px;
          font-weight: 700;
          color: #1b2b4b;
          margin-bottom: 4px;
        }
        .student-details {
          font-size: 12px;
          color: #666;
        }
        .amount-section {
          text-align: center;
          padding: 20px;
          background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .amount-label {
          font-size: 12px;
          color: #166534;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .amount-value {
          font-size: 28px;
          font-weight: 800;
          color: #166534;
        }
        .amount-words {
          font-size: 11px;
          color: #166534;
          font-style: italic;
          margin-top: 8px;
        }
        .details-grid {
          display: grid;
          gap: 12px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-size: 12px;
          color: #666;
        }
        .detail-value {
          font-size: 13px;
          font-weight: 600;
          color: #1b2b4b;
        }
        .balance-section {
          margin-top: 20px;
          padding: 16px;
          background: ${receipt.newBalance === 0 ? "#dcfce7" : "#fef3c7"};
          border-radius: 8px;
          text-align: center;
        }
        .balance-label {
          font-size: 12px;
          color: ${receipt.newBalance === 0 ? "#166534" : "#92400e"};
        }
        .balance-value {
          font-size: 20px;
          font-weight: 700;
          color: ${receipt.newBalance === 0 ? "#166534" : "#92400e"};
        }
        .stellar-badge {
          margin-top: 20px;
          padding: 12px;
          background: #f1f5f9;
          border-radius: 8px;
          text-align: center;
        }
        .stellar-badge .icon {
          font-size: 20px;
          margin-bottom: 4px;
        }
        .stellar-badge .label {
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stellar-badge .hash {
          font-size: 11px;
          font-family: monospace;
          color: #1b2b4b;
          word-break: break-all;
          margin-top: 4px;
        }
        .receipt-footer {
          padding: 16px 24px;
          background: #f8fafc;
          text-align: center;
          font-size: 11px;
          color: #666;
        }
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .receipt {
            box-shadow: none;
            max-width: 100%;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-header">
          <h1>${receipt.schoolName}</h1>
          <p>${receipt.schoolAddress}</p>
          <div class="receipt-number">Receipt #${receipt.receiptNumber}</div>
        </div>
        
        <div class="receipt-body">
          <p class="receipt-date">${receipt.date}</p>
          
          <div class="student-info">
            <p class="student-name">${receipt.studentName}</p>
            <p class="student-details">
              ID: ${receipt.studentId} • ${receipt.className}${receipt.streamName ? " • " + receipt.streamName : ""}
            </p>
          </div>
          
          <div class="amount-section">
            <p class="amount-label">Amount Received</p>
            <p class="amount-value">UGX ${receipt.amount.toLocaleString()}</p>
            <p class="amount-words">${receipt.amountWords}</p>
          </div>
          
          <div class="details-grid">
            <div class="detail-row">
              <span class="detail-label">Payment For</span>
              <span class="detail-value">${receipt.installmentName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Method</span>
              <span class="detail-value">${receipt.paymentChannel}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Reference</span>
              <span class="detail-value">${receipt.transactionRef}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guardian</span>
              <span class="detail-value">${receipt.guardianName}</span>
            </div>
          </div>
          
          <div class="balance-section">
            <p class="balance-label">${receipt.newBalance === 0 ? "Fully Paid ✓" : "Outstanding Balance"}</p>
            <p class="balance-value">UGX ${receipt.newBalance.toLocaleString()}</p>
          </div>
          
          ${
            receipt.stellarHash
              ? `
            <div class="stellar-badge">
              <div class="icon">🔒</div>
              <p class="label">Blockchain Verified</p>
              <p class="hash">${receipt.stellarHash}</p>
            </div>
          `
              : ""
          }
        </div>
        
        <div class="receipt-footer">
          <p>Thank you for your payment</p>
          <p>Powered by eBursar</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates a receipt and stores it
 * Returns the URL to the receipt
 */
export async function generateReceipt(
  data: ReceiptData,
): Promise<string | undefined> {
  initializeFirebase();

  try {
    const receipt = createReceiptData(data);
    const html = generateReceiptHTML(receipt);

    // Store receipt HTML in Firebase Storage
    const receiptRef = ref(
      storage,
      `receipts/${data.payment.schoolId}/${data.payment.receiptNumber}.html`,
    );
    await uploadString(receiptRef, html, "raw", { contentType: "text/html" });

    const url = await getDownloadURL(receiptRef);
    return url;
  } catch (error) {
    console.error("Failed to generate receipt:", error);
    return undefined;
  }
}

/**
 * Generates printable PDF receipt
 * In production, this would use a PDF generation library
 */
export function generatePrintableReceipt(receipt: Receipt): string {
  return generateReceiptHTML(receipt);
}
