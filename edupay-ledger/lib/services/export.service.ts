/**
 * Export Service
 *
 * Handles exporting data to CSV, PDF, and Excel formats
 * Supports scheduled exports and multiple data types
 */

import { formatUGX, formatDate } from "@/lib/utils";
import { Payment } from "@/types/payment";
import { Student } from "@/types/student";

// ============================================================================
// EXCEL EXPORT UTILITIES
// ============================================================================

/**
 * Excel column letter helper (0 = A, 1 = B, ..., 26 = AA, etc.)
 */
function getColumnLetter(colIndex: number): string {
  let letter = "";
  while (colIndex >= 0) {
    letter = String.fromCharCode((colIndex % 26) + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}

/**
 * Escapes XML special characters
 */
function escapeXml(str: string | number | boolean | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Excel cell reference helper
 */
function cellRef(row: number, col: number): string {
  return `${getColumnLetter(col)}${row}`;
}

/**
 * Creates an Excel workbook in native XLSX format (Open XML)
 * This is a lightweight implementation that doesn't require external libraries
 */
export async function createExcelWorkbook<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    format?: "text" | "number" | "currency" | "date" | "percentage";
  }>,
  options: {
    sheetName?: string;
    title?: string;
    subtitle?: string;
    includeTimestamp?: boolean;
    headerStyle?: "primary" | "secondary";
  } = {},
): Promise<Blob> {
  const {
    sheetName = "Sheet1",
    title,
    subtitle,
    includeTimestamp = true,
    headerStyle = "primary",
  } = options;

  // Calculate starting row (after title/subtitle)
  let startRow = 1;
  if (title) startRow++;
  if (subtitle) startRow++;
  if (includeTimestamp) startRow++;
  if (title || subtitle || includeTimestamp) startRow++; // Empty row

  const headerRow = startRow;
  const dataStartRow = startRow + 1;

  // Build sheet data XML
  let sheetDataXml = "<sheetData>";

  // Add title row
  let currentRow = 1;
  if (title) {
    sheetDataXml += `<row r="${currentRow}"><c r="A${currentRow}" t="inlineStr"><is><t>${escapeXml(title)}</t></is></c></row>`;
    currentRow++;
  }

  // Add subtitle row
  if (subtitle) {
    sheetDataXml += `<row r="${currentRow}"><c r="A${currentRow}" t="inlineStr"><is><t>${escapeXml(subtitle)}</t></is></c></row>`;
    currentRow++;
  }

  // Add timestamp row
  if (includeTimestamp) {
    sheetDataXml += `<row r="${currentRow}"><c r="A${currentRow}" t="inlineStr"><is><t>Generated: ${formatDate(new Date())}</t></is></c></row>`;
    currentRow++;
  }

  // Empty row before headers
  if (title || subtitle || includeTimestamp) {
    currentRow++;
  }

  // Add header row
  sheetDataXml += `<row r="${headerRow}">`;
  columns.forEach((col, idx) => {
    sheetDataXml += `<c r="${cellRef(headerRow, idx)}" t="inlineStr" s="1"><is><t>${escapeXml(col.header)}</t></is></c>`;
  });
  sheetDataXml += "</row>";

  // Add data rows
  data.forEach((row, rowIdx) => {
    const excelRow = dataStartRow + rowIdx;
    sheetDataXml += `<row r="${excelRow}">`;
    columns.forEach((col, colIdx) => {
      const value = row[col.key];
      const cellAddress = cellRef(excelRow, colIdx);

      if (value == null || value === "") {
        sheetDataXml += `<c r="${cellAddress}"/>`;
      } else if (typeof value === "number") {
        // Format numbers appropriately
        if (col.format === "currency") {
          sheetDataXml += `<c r="${cellAddress}" s="2"><v>${value}</v></c>`;
        } else if (col.format === "percentage") {
          sheetDataXml += `<c r="${cellAddress}" s="3"><v>${value / 100}</v></c>`;
        } else {
          sheetDataXml += `<c r="${cellAddress}"><v>${value}</v></c>`;
        }
      } else if (typeof value === "boolean") {
        sheetDataXml += `<c r="${cellAddress}" t="b"><v>${value ? 1 : 0}</v></c>`;
      } else if (typeof value === "object") {
        // Handle objects by converting to string
        sheetDataXml += `<c r="${cellAddress}" t="inlineStr"><is><t>${escapeXml(JSON.stringify(value))}</t></is></c>`;
      } else {
        // Handle string or other primitive types
        sheetDataXml += `<c r="${cellAddress}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
      }
    });
    sheetDataXml += "</row>";
  });

  sheetDataXml += "</sheetData>";

  // Column widths
  let colsXml = "<cols>";
  columns.forEach((col, idx) => {
    const width = col.width || (col.format === "currency" ? 15 : 12);
    colsXml += `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
  });
  colsXml += "</cols>";

  // Create worksheet XML
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${colsXml}
  ${sheetDataXml}
</worksheet>`;

  // Create styles XML
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="0.00%"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1B2B4B"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

  // Create workbook XML
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // Create relationships
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // Create ZIP file structure for XLSX
  // Using a simple ZIP implementation
  const files: Array<{ name: string; content: string }> = [
    { name: "[Content_Types].xml", content: contentTypesXml },
    { name: "_rels/.rels", content: relsXml },
    { name: "xl/workbook.xml", content: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml },
    { name: "xl/styles.xml", content: stylesXml },
  ];

  // Create ZIP blob using native compression
  return await createZipBlob(files);
}

/**
 * Creates a ZIP blob from file entries (minimal implementation for XLSX)
 */
async function createZipBlob(
  files: Array<{ name: string; content: string }>,
): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const content = encoder.encode(file.content);
    const fileName = encoder.encode(file.name);
    const date = new Date();
    const time =
      ((date.getHours() << 11) |
        (date.getMinutes() << 5) |
        (date.getSeconds() >> 1)) &
      0xffff;
    const dateVal =
      (((date.getFullYear() - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate()) &
      0xffff;

    // CRC32 calculation
    const crc = crc32(content);

    // Local file header
    const localHeader = new Uint8Array(30 + fileName.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method (0 = stored)
    view.setUint16(10, time, true); // File last modification time
    view.setUint16(12, dateVal, true); // File last modification date
    view.setUint32(14, crc, true); // CRC-32
    view.setUint32(18, content.length, true); // Compressed size
    view.setUint32(22, content.length, true); // Uncompressed size
    view.setUint16(26, fileName.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length
    localHeader.set(fileName, 30);

    // Central directory entry
    const centralEntry = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralEntry.buffer);
    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0, true); // General purpose bit flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, time, true); // File last modification time
    centralView.setUint16(14, dateVal, true); // File last modification date
    centralView.setUint32(16, crc, true); // CRC-32
    centralView.setUint32(20, content.length, true); // Compressed size
    centralView.setUint32(24, content.length, true); // Uncompressed size
    centralView.setUint16(28, fileName.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralEntry.set(fileName, 46);

    parts.push(localHeader);
    parts.push(content);
    centralDirectory.push(centralEntry);

    offset += localHeader.length + content.length;
  }

  // End of central directory
  const centralDirSize = centralDirectory.reduce(
    (acc, entry) => acc + entry.length,
    0,
  );
  const endOfCentralDir = new Uint8Array(22);
  const endView = new DataView(endOfCentralDir.buffer);
  endView.setUint32(0, 0x06054b50, true); // End of central directory signature
  endView.setUint16(4, 0, true); // Number of this disk
  endView.setUint16(6, 0, true); // Disk where central directory starts
  endView.setUint16(8, files.length, true); // Number of central directory records on this disk
  endView.setUint16(10, files.length, true); // Total number of central directory records
  endView.setUint32(12, centralDirSize, true); // Size of central directory
  endView.setUint32(16, offset, true); // Offset of start of central directory
  endView.setUint16(20, 0, true); // Comment length

  // Combine all parts
  const allParts = [...parts, ...centralDirectory, endOfCentralDir];
  const totalSize = allParts.reduce((acc, part) => acc + part.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of allParts) {
    result.set(part, pos);
    pos += part.length;
  }

  return new Blob([result], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * CRC32 implementation for ZIP files
 */
function crc32(data: Uint8Array): number {
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Downloads an Excel file
 */
export function downloadExcel(filename: string, blob: Blob): void {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.xlsx`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Converts data to CSV format
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{ key: string; header: string }>,
): string {
  const headers = columns.map((col) => col.header).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        // Escape commas and quotes
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      })
      .join(","),
  );

  return [headers, ...rows].join("\n");
}

/**
 * Downloads data as a CSV file
 */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports payments to CSV
 */
export function exportPaymentsToCSV(
  payments: Payment[],
  filename: string = "payments",
): void {
  const columns = [
    { key: "receiptNumber", header: "Receipt Number" },
    { key: "studentName", header: "Student Name" },
    { key: "studentClass", header: "Class" },
    { key: "amount", header: "Amount (UGX)" },
    { key: "channel", header: "Payment Channel" },
    { key: "transactionRef", header: "Transaction Reference" },
    { key: "installmentName", header: "Installment" },
    { key: "recordedAt", header: "Date" },
    { key: "recordedBy", header: "Recorded By" },
    { key: "stellarAnchored", header: "Blockchain Verified" },
  ];

  const data = payments.map((p) => ({
    receiptNumber: p.receiptNumber,
    studentName: p.studentName,
    studentClass: `${p.studentClass}${p.studentStream ? " - " + p.studentStream : ""}`,
    amount: p.amount,
    channel: p.channelDetails || p.channel,
    transactionRef: p.transactionRef,
    installmentName: p.installmentName,
    recordedAt: p.recordedAt ? formatDate(p.recordedAt.toDate()) : "",
    recordedBy: p.recordedBy,
    stellarAnchored: p.stellarAnchored ? "Yes" : "No",
  }));

  const csv = toCSV(data, columns);
  downloadCSV(filename, csv);
}

/**
 * Exports students to CSV
 */
export function exportStudentsToCSV(
  students: Student[],
  filename: string = "students",
): void {
  const columns = [
    { key: "studentId", header: "Student ID" },
    { key: "name", header: "Full Name" },
    { key: "class", header: "Class" },
    { key: "stream", header: "Stream" },
    { key: "guardianName", header: "Guardian Name" },
    { key: "guardianPhone", header: "Guardian Phone" },
    { key: "totalFees", header: "Total Fees (UGX)" },
    { key: "amountPaid", header: "Amount Paid (UGX)" },
    { key: "balance", header: "Balance (UGX)" },
    { key: "paymentStatus", header: "Payment Status" },
  ];

  const data = students.map((s) => ({
    studentId: s.studentId,
    name: `${s.firstName} ${s.middleName || ""} ${s.lastName}`.trim(),
    class: s.className,
    stream: s.streamName || "N/A",
    guardianName: s.guardian.name,
    guardianPhone: s.guardian.phone,
    totalFees: s.totalFees,
    amountPaid: s.amountPaid,
    balance: s.balance,
    paymentStatus: s.paymentStatus.replace("_", " "),
  }));

  const csv = toCSV(data, columns);
  downloadCSV(filename, csv);
}

/**
 * Exports arrears report to CSV
 */
export function exportArrearsToCSV(
  students: Array<Student & { daysOverdue: number }>,
  filename: string = "arrears_report",
): void {
  const columns = [
    { key: "studentId", header: "Student ID" },
    { key: "name", header: "Full Name" },
    { key: "class", header: "Class" },
    { key: "guardianName", header: "Guardian Name" },
    { key: "guardianPhone", header: "Guardian Phone" },
    { key: "balance", header: "Outstanding (UGX)" },
    { key: "daysOverdue", header: "Days Overdue" },
    { key: "severity", header: "Severity" },
  ];

  const data = students.map((s) => {
    const severity =
      s.daysOverdue >= 30
        ? "Critical"
        : s.daysOverdue >= 15
          ? "High"
          : s.daysOverdue >= 7
            ? "Medium"
            : "Low";
    return {
      studentId: s.studentId,
      name: `${s.firstName} ${s.middleName || ""} ${s.lastName}`.trim(),
      class: `${s.className}${s.streamName ? " - " + s.streamName : ""}`,
      guardianName: s.guardian.name,
      guardianPhone: s.guardian.phone,
      balance: s.balance,
      daysOverdue: s.daysOverdue,
      severity,
    };
  });

  const csv = toCSV(data, columns);
  downloadCSV(filename, csv);
}

/**
 * Generates a summary report in HTML format for printing
 */
export function generateSummaryReportHTML(data: {
  schoolName: string;
  term: string;
  year: string;
  totalStudents: number;
  totalCollected: number;
  totalOutstanding: number;
  fullyPaidCount: number;
  partialCount: number;
  overdueCount: number;
  noPaidCount: number;
  payments: Payment[];
}): string {
  const collectionRate = Math.round(
    (data.totalCollected / (data.totalCollected + data.totalOutstanding)) * 100,
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Fee Collection Report - ${data.term} ${data.year}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          color: #333;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #1b2b4b;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1b2b4b;
          margin: 0 0 10px 0;
        }
        .header p {
          color: #666;
          margin: 5px 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-card .value {
          font-size: 24px;
          font-weight: bold;
          color: #1b2b4b;
        }
        .stat-card .label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-top: 5px;
        }
        .progress-bar {
          height: 20px;
          background: #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          margin: 20px 0;
        }
        .progress-bar .fill {
          height: 100%;
          background: #22c55e;
          border-radius: 10px;
          transition: width 0.3s;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #1b2b4b;
          color: white;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body {
            padding: 20px;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.schoolName}</h1>
        <p>Fee Collection Report</p>
        <p><strong>${data.term} - ${data.year}</strong></p>
        <p>Generated: ${formatDate(new Date())}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${formatUGX(data.totalCollected)}</div>
          <div class="label">Total Collected</div>
        </div>
        <div class="stat-card">
          <div class="value">${formatUGX(data.totalOutstanding)}</div>
          <div class="label">Outstanding Balance</div>
        </div>
        <div class="stat-card">
          <div class="value">${collectionRate}%</div>
          <div class="label">Collection Rate</div>
        </div>
      </div>

      <h2>Collection Progress</h2>
      <div class="progress-bar">
        <div class="fill" style="width: ${collectionRate}%"></div>
      </div>

      <h2>Student Payment Status</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value" style="color: #22c55e">${data.fullyPaidCount}</div>
          <div class="label">Fully Paid</div>
        </div>
        <div class="stat-card">
          <div class="value" style="color: #f59e0b">${data.partialCount}</div>
          <div class="label">Partial Payment</div>
        </div>
        <div class="stat-card">
          <div class="value" style="color: #ef4444">${data.overdueCount + data.noPaidCount}</div>
          <div class="label">Outstanding</div>
        </div>
      </div>

      <h2>Recent Payments</h2>
      <table>
        <thead>
          <tr>
            <th>Receipt #</th>
            <th>Student</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Channel</th>
          </tr>
        </thead>
        <tbody>
          ${data.payments
            .slice(0, 20)
            .map(
              (p) => `
            <tr>
              <td>${p.receiptNumber}</td>
              <td>${p.studentName}</td>
              <td>${formatUGX(p.amount)}</td>
              <td>${p.recordedAt ? formatDate(p.recordedAt.toDate()) : "N/A"}</td>
              <td>${p.channelDetails || p.channel}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <div class="footer">
        <p>This report was generated by eBursar</p>
        <p>All payment records are verified and anchored to the Stellar blockchain for audit integrity.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Opens a print dialog with the report
 */
export function printReport(htmlContent: string): void {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}

// ============================================================================
// DASHBOARD EXPORTS
// ============================================================================

interface DashboardExportData {
  schoolName: string;
  term: string;
  year: string;
  stats?: {
    totalCollection: number;
    todayCollection: number;
    totalStudents: number;
    studentsWithArrears: number;
    collectionRate: number;
  };
  heatmap?: Array<{
    className: string;
    stream: string;
    collected: number;
    outstanding: number;
  }>;
  activities?: Array<{ type: string; description: string; timestamp: string }>;
  timestamp: string;
}

/**
 * Exports dashboard data to CSV
 */
export function exportDashboardToCSV(data: DashboardExportData): void {
  const rows = [
    ["eBursar - Dashboard Export"],
    [`School: ${data.schoolName}`],
    [`Term: ${data.term} ${data.year}`],
    [`Generated: ${new Date(data.timestamp).toLocaleString()}`],
    [],
    ["Summary Statistics"],
    ["Metric", "Value"],
    ["Total Collection", data.stats?.totalCollection?.toLocaleString() || "0"],
    [
      "Today's Collection",
      data.stats?.todayCollection?.toLocaleString() || "0",
    ],
    ["Total Students", data.stats?.totalStudents?.toString() || "0"],
    [
      "Students with Arrears",
      data.stats?.studentsWithArrears?.toString() || "0",
    ],
    ["Collection Rate", `${data.stats?.collectionRate || 0}%`],
    [],
    ["Class Performance"],
    ["Class", "Stream", "Collected (UGX)", "Outstanding (UGX)"],
    ...(data.heatmap || []).map((h) => [
      h.className,
      h.stream,
      h.collected.toString(),
      h.outstanding.toString(),
    ]),
  ];

  const csvContent = rows.map((row) => row.join(",")).join("\n");
  downloadCSV(`dashboard_${data.term}_${data.year}`, csvContent);
}

/**
 * Exports dashboard data to PDF (opens print dialog)
 */
export function exportDashboardToPDF(data: DashboardExportData): void {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard Report - ${data.term} ${data.year}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header { text-align: center; border-bottom: 2px solid #1b2b4b; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1b2b4b; margin: 0; }
        .stats { display: flex; justify-content: space-around; margin: 30px 0; }
        .stat { text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; }
        .stat .value { font-size: 24px; font-weight: bold; color: #1b2b4b; }
        .stat .label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #1b2b4b; color: white; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.schoolName}</h1>
        <p>Dashboard Report - ${data.term} ${data.year}</p>
        <p>Generated: ${new Date(data.timestamp).toLocaleString()}</p>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="value">${formatUGX(data.stats?.totalCollection || 0)}</div>
          <div class="label">Total Collection</div>
        </div>
        <div class="stat">
          <div class="value">${data.stats?.totalStudents || 0}</div>
          <div class="label">Total Students</div>
        </div>
        <div class="stat">
          <div class="value">${data.stats?.collectionRate || 0}%</div>
          <div class="label">Collection Rate</div>
        </div>
      </div>
      <h2>Class Performance</h2>
      <table>
        <thead><tr><th>Class</th><th>Stream</th><th>Collected</th><th>Outstanding</th></tr></thead>
        <tbody>
          ${(data.heatmap || []).map((h) => `<tr><td>${h.className}</td><td>${h.stream}</td><td>${formatUGX(h.collected)}</td><td>${formatUGX(h.outstanding)}</td></tr>`).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;
  printReport(html);
}

/**
 * Exports dashboard data to Excel-compatible format
 */
export async function exportDashboardToExcel(
  data: DashboardExportData,
): Promise<void> {
  // Create summary data
  const summaryData = [
    { metric: "Total Collection", value: data.stats?.totalCollection || 0 },
    { metric: "Today's Collection", value: data.stats?.todayCollection || 0 },
    { metric: "Total Students", value: data.stats?.totalStudents || 0 },
    {
      metric: "Students with Arrears",
      value: data.stats?.studentsWithArrears || 0,
    },
    { metric: "Collection Rate (%)", value: data.stats?.collectionRate || 0 },
  ];

  const summaryColumns = [
    { key: "metric", header: "Metric", width: 25 },
    { key: "value", header: "Value", width: 15, format: "number" as const },
  ];

  const blob = await createExcelWorkbook(summaryData, summaryColumns, {
    sheetName: "Dashboard Summary",
    title: `${data.schoolName} - Dashboard Report`,
    subtitle: `${data.term} ${data.year}`,
    includeTimestamp: true,
  });

  downloadExcel(`dashboard_${data.term}_${data.year}`, blob);
}

// ============================================================================
// STUDENT EXPORTS (PDF & EXCEL)
// ============================================================================

/**
 * Exports students to PDF
 */
export function exportStudentsToPDF(
  students: Student[],
  filename: string = "students",
): void {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Students Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #1b2b4b; margin: 0; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #1b2b4b; color: white; font-size: 10px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .paid { color: #22c55e; }
        .unpaid { color: #ef4444; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Students Report</h1>
        <p>Generated: ${new Date().toLocaleString()} | Total: ${students.length} students</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Class</th>
            <th>Guardian</th>
            <th>Phone</th>
            <th>Total Fees</th>
            <th>Paid</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${students
            .map(
              (s) => `
            <tr>
              <td>${s.studentId}</td>
              <td>${s.firstName} ${s.lastName}</td>
              <td>${s.className}${s.streamName ? " - " + s.streamName : ""}</td>
              <td>${s.guardian.name}</td>
              <td>${s.guardian.phone}</td>
              <td>${formatUGX(s.totalFees)}</td>
              <td class="paid">${formatUGX(s.amountPaid)}</td>
              <td class="${s.balance > 0 ? "unpaid" : "paid"}">${formatUGX(s.balance)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;
  printReport(html);
}

/**
 * Exports students to Excel format (.xlsx)
 */
export async function exportStudentsToExcel(
  students: Student[],
  filename: string = "students",
): Promise<void> {
  const columns = [
    { key: "studentId", header: "Student ID", width: 12 },
    { key: "name", header: "Full Name", width: 25 },
    { key: "class", header: "Class", width: 15 },
    { key: "stream", header: "Stream", width: 10 },
    { key: "guardianName", header: "Guardian Name", width: 20 },
    { key: "guardianPhone", header: "Guardian Phone", width: 15 },
    {
      key: "totalFees",
      header: "Total Fees (UGX)",
      width: 15,
      format: "currency" as const,
    },
    {
      key: "amountPaid",
      header: "Amount Paid (UGX)",
      width: 15,
      format: "currency" as const,
    },
    {
      key: "balance",
      header: "Balance (UGX)",
      width: 15,
      format: "currency" as const,
    },
    { key: "paymentStatus", header: "Payment Status", width: 15 },
  ];

  const data = students.map((s) => ({
    studentId: s.studentId,
    name: `${s.firstName} ${s.middleName || ""} ${s.lastName}`.trim(),
    class: s.className,
    stream: s.streamName || "N/A",
    guardianName: s.guardian.name,
    guardianPhone: s.guardian.phone,
    totalFees: s.totalFees,
    amountPaid: s.amountPaid,
    balance: s.balance,
    paymentStatus: s.paymentStatus.replace("_", " "),
  }));

  const blob = await createExcelWorkbook(data, columns, {
    sheetName: "Students",
    title: "Students Report",
    includeTimestamp: true,
  });

  downloadExcel(filename, blob);
}

/**
 * Exports payments to Excel format (.xlsx)
 */
export async function exportPaymentsToExcel(
  payments: Payment[],
  filename: string = "payments",
): Promise<void> {
  const columns = [
    { key: "receiptNumber", header: "Receipt Number", width: 15 },
    { key: "studentName", header: "Student Name", width: 25 },
    { key: "studentClass", header: "Class", width: 15 },
    {
      key: "amount",
      header: "Amount (UGX)",
      width: 15,
      format: "currency" as const,
    },
    { key: "channel", header: "Payment Channel", width: 15 },
    { key: "transactionRef", header: "Transaction Reference", width: 20 },
    { key: "installmentName", header: "Installment", width: 15 },
    { key: "recordedAt", header: "Date", width: 18 },
    { key: "recordedBy", header: "Recorded By", width: 15 },
    { key: "stellarAnchored", header: "Blockchain Verified", width: 15 },
  ];

  const data = payments.map((p) => ({
    receiptNumber: p.receiptNumber,
    studentName: p.studentName,
    studentClass: `${p.studentClass}${p.studentStream ? " - " + p.studentStream : ""}`,
    amount: p.amount,
    channel: p.channelDetails || p.channel,
    transactionRef: p.transactionRef || "",
    installmentName: p.installmentName || "",
    recordedAt: p.recordedAt ? formatDate(p.recordedAt.toDate()) : "",
    recordedBy: p.recordedBy || "",
    stellarAnchored: p.stellarAnchored ? "Yes" : "No",
  }));

  const blob = await createExcelWorkbook(data, columns, {
    sheetName: "Payments",
    title: "Payment Records",
    includeTimestamp: true,
  });

  downloadExcel(filename, blob);
}

/**
 * Exports arrears report to Excel format (.xlsx)
 */
export async function exportArrearsToExcel(
  students: Array<Student & { daysOverdue: number }>,
  filename: string = "arrears_report",
): Promise<void> {
  const columns = [
    { key: "studentId", header: "Student ID", width: 12 },
    { key: "name", header: "Full Name", width: 25 },
    { key: "class", header: "Class", width: 15 },
    { key: "guardianName", header: "Guardian Name", width: 20 },
    { key: "guardianPhone", header: "Guardian Phone", width: 15 },
    {
      key: "balance",
      header: "Outstanding (UGX)",
      width: 15,
      format: "currency" as const,
    },
    { key: "daysOverdue", header: "Days Overdue", width: 12 },
    { key: "severity", header: "Severity", width: 10 },
  ];

  const data = students.map((s) => {
    const severity =
      s.daysOverdue >= 30
        ? "Critical"
        : s.daysOverdue >= 15
          ? "High"
          : s.daysOverdue >= 7
            ? "Medium"
            : "Low";

    return {
      studentId: s.studentId,
      name: `${s.firstName} ${s.middleName || ""} ${s.lastName}`.trim(),
      class: `${s.className}${s.streamName ? " - " + s.streamName : ""}`,
      guardianName: s.guardian.name,
      guardianPhone: s.guardian.phone,
      balance: s.balance,
      daysOverdue: s.daysOverdue,
      severity,
    };
  });

  const blob = await createExcelWorkbook(data, columns, {
    sheetName: "Arrears Report",
    title: "Arrears Report",
    includeTimestamp: true,
  });

  downloadExcel(filename, blob);
}

// ============================================================================
// SCHEDULED EXPORTS
// ============================================================================

export interface ScheduledExportConfig {
  id: string;
  name: string;
  type: "students" | "payments" | "overdue" | "dashboard";
  format: "csv" | "excel" | "pdf";
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  hour: number; // 0-23
  minute: number; // 0-59
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  recipients?: string[]; // Email addresses
  filters?: {
    classId?: string;
    streamId?: string;
    paymentStatus?: string;
    dateRange?: { start: Date; end: Date };
  };
  createdAt: Date;
  createdBy: string;
}

/**
 * Calculates the next run time for a scheduled export
 */
export function calculateNextRunTime(config: ScheduledExportConfig): Date {
  const now = new Date();
  const next = new Date(now);

  next.setHours(config.hour, config.minute, 0, 0);

  switch (config.frequency) {
    case "daily":
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "weekly":
      const targetDay = config.dayOfWeek ?? 1; // Default to Monday
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }
      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case "monthly":
      const targetDate = config.dayOfMonth ?? 1; // Default to 1st
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      // Handle months with fewer days
      while (next.getDate() !== targetDate) {
        next.setDate(next.getDate() - 1);
      }
      break;
  }

  return next;
}

/**
 * Validates a scheduled export configuration
 */
export function validateScheduledExport(
  config: Partial<ScheduledExportConfig>,
): string[] {
  const errors: string[] = [];

  if (!config.name?.trim()) {
    errors.push("Export name is required");
  }

  if (!config.type) {
    errors.push("Export type is required");
  }

  if (!config.format) {
    errors.push("Export format is required");
  }

  if (!config.frequency) {
    errors.push("Frequency is required");
  }

  if (config.hour === undefined || config.hour < 0 || config.hour > 23) {
    errors.push("Valid hour (0-23) is required");
  }

  if (config.minute === undefined || config.minute < 0 || config.minute > 59) {
    errors.push("Valid minute (0-59) is required");
  }

  if (
    config.frequency === "weekly" &&
    (config.dayOfWeek === undefined ||
      config.dayOfWeek < 0 ||
      config.dayOfWeek > 6)
  ) {
    errors.push("Valid day of week (0-6) is required for weekly exports");
  }

  if (
    config.frequency === "monthly" &&
    (config.dayOfMonth === undefined ||
      config.dayOfMonth < 1 ||
      config.dayOfMonth > 31)
  ) {
    errors.push("Valid day of month (1-31) is required for monthly exports");
  }

  return errors;
}

/**
 * Storage key for scheduled exports
 */
const SCHEDULED_EXPORTS_KEY = "ebursar_scheduled_exports";

/**
 * Gets all scheduled exports from local storage
 */
export function getScheduledExports(): ScheduledExportConfig[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SCHEDULED_EXPORTS_KEY);
    if (!stored) return [];

    const exports = JSON.parse(stored) as ScheduledExportConfig[];
    // Convert date strings back to Date objects
    return exports.map((exp) => ({
      ...exp,
      lastRun: exp.lastRun ? new Date(exp.lastRun) : undefined,
      nextRun: exp.nextRun ? new Date(exp.nextRun) : undefined,
      createdAt: new Date(exp.createdAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Saves a scheduled export
 */
export function saveScheduledExport(config: ScheduledExportConfig): void {
  if (typeof window === "undefined") return;

  const exports = getScheduledExports();
  const existingIndex = exports.findIndex((exp) => exp.id === config.id);

  // Calculate next run time
  config.nextRun = calculateNextRunTime(config);

  if (existingIndex >= 0) {
    exports[existingIndex] = config;
  } else {
    exports.push(config);
  }

  localStorage.setItem(SCHEDULED_EXPORTS_KEY, JSON.stringify(exports));
}

/**
 * Deletes a scheduled export
 */
export function deleteScheduledExport(id: string): void {
  if (typeof window === "undefined") return;

  const exports = getScheduledExports();
  const filtered = exports.filter((exp) => exp.id !== id);
  localStorage.setItem(SCHEDULED_EXPORTS_KEY, JSON.stringify(filtered));
}

/**
 * Checks for due scheduled exports and returns them
 */
export function checkDueExports(): ScheduledExportConfig[] {
  const exports = getScheduledExports();
  const now = new Date();

  return exports.filter(
    (exp) => exp.enabled && exp.nextRun && new Date(exp.nextRun) <= now,
  );
}

/**
 * Marks a scheduled export as completed and updates next run time
 */
export function markExportCompleted(id: string): void {
  const exports = getScheduledExports();
  const exp = exports.find((e) => e.id === id);

  if (exp) {
    exp.lastRun = new Date();
    exp.nextRun = calculateNextRunTime(exp);
    saveScheduledExport(exp);
  }
}
