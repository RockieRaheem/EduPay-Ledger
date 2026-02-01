/**
 * Bulk Import Components
 * UI components for Excel/CSV student import wizard
 */

"use client";

import React, { useRef } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ProgressBar } from "../ui/Progress";
import { Input } from "../ui/Input";
import {
  ImportJob,
  ImportRow,
  ImportSummary,
  ColumnMapping,
  StudentImportField,
  DEFAULT_IMPORT_TEMPLATE,
} from "../../types/bulk-import";
import { ImportStep, useFileDrop } from "../../hooks/useBulkImport";
import { ResidenceType } from "../../types/residence";

// ============================================
// FILE UPLOAD COMPONENT
// ============================================

interface FileUploadDropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  onDownloadTemplate: () => void;
}

export function FileUploadDropzone({
  onFileSelect,
  isLoading,
  error,
  onDownloadTemplate,
}: FileUploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
    useFileDrop(onFileSelect);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${isLoading ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragging ? "Drop file here" : "Drag and drop your file here"}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          </div>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Select File"}
          </Button>

          <p className="text-xs text-gray-500">
            Supported formats: CSV, Excel (.xlsx, .xls) • Max 1000 rows
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-500 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900">Need a template?</h4>
            <p className="text-sm text-blue-700 mt-1">
              Download our template with all required columns and sample data to
              get started quickly.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadTemplate}
              className="mt-2"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COLUMN MAPPING COMPONENT
// ============================================

interface ColumnMappingStepProps {
  headers: string[];
  sampleRow: Record<string, string> | null;
  mappings: ColumnMapping[];
  missingRequired: StudentImportField[];
  onUpdateMapping: (
    sourceColumn: string,
    targetField: StudentImportField | null,
  ) => void;
  onBack: () => void;
  onNext: () => void;
}

const AVAILABLE_FIELDS: {
  field: StudentImportField;
  label: string;
  required: boolean;
}[] = [
  { field: "studentId", label: "Student ID", required: true },
  { field: "firstName", label: "First Name", required: true },
  { field: "middleName", label: "Middle Name", required: false },
  { field: "lastName", label: "Last Name", required: true },
  { field: "className", label: "Class", required: true },
  { field: "streamName", label: "Stream", required: false },
  { field: "residenceType", label: "Residence Type", required: false },
  { field: "guardianName", label: "Guardian Name", required: true },
  { field: "guardianPhone", label: "Guardian Phone", required: true },
  { field: "guardianEmail", label: "Guardian Email", required: false },
  { field: "guardianRelation", label: "Relation", required: false },
  { field: "totalFees", label: "Total Fees", required: false },
  { field: "amountPaid", label: "Amount Paid", required: false },
  { field: "dateOfBirth", label: "Date of Birth", required: false },
  { field: "gender", label: "Gender", required: false },
  { field: "nationality", label: "Nationality", required: false },
  { field: "religion", label: "Religion", required: false },
  { field: "address", label: "Address", required: false },
  { field: "admissionDate", label: "Admission Date", required: false },
  { field: "previousSchool", label: "Previous School", required: false },
  { field: "specialNeeds", label: "Special Needs", required: false },
  { field: "notes", label: "Notes", required: false },
];

export function ColumnMappingStep({
  headers,
  sampleRow,
  mappings,
  missingRequired,
  onUpdateMapping,
  onBack,
  onNext,
}: ColumnMappingStepProps) {
  const mappedFields = mappings
    .filter((m) => m.targetField)
    .map((m) => m.targetField);

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-yellow-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-yellow-800">
            {missingRequired.length > 0
              ? `Missing required fields: ${missingRequired.join(", ")}`
              : "All required fields mapped"}
          </span>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  File Column
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Sample Value
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Map To Field
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {headers.map((header) => {
                const mapping = mappings.find((m) => m.sourceColumn === header);
                const currentField = mapping?.targetField || "";

                return (
                  <tr key={header}>
                    <td className="px-4 py-3 font-medium">{header}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm max-w-xs truncate">
                      {sampleRow?.[header] || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={currentField}
                        onChange={(e) =>
                          onUpdateMapping(
                            header,
                            e.target.value
                              ? (e.target.value as StudentImportField)
                              : null,
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Skip this column --</option>
                        {AVAILABLE_FIELDS.map(({ field, label, required }) => (
                          <option
                            key={field}
                            value={field}
                            disabled={
                              mappedFields.includes(field) &&
                              currentField !== field
                            }
                          >
                            {label} {required ? "*" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {currentField ? (
                        <Badge variant="success">Mapped</Badge>
                      ) : (
                        <Badge variant="secondary">Skipped</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext} disabled={missingRequired.length > 0}>
          Validate Data →
        </Button>
      </div>
    </div>
  );
}

// ============================================
// PREVIEW & VALIDATION COMPONENT
// ============================================

interface ImportPreviewStepProps {
  job: ImportJob;
  onBack: () => void;
  onImport: () => void;
  isLoading: boolean;
}

export function ImportPreviewStep({
  job,
  onBack,
  onImport,
  isLoading,
}: ImportPreviewStepProps) {
  const errorRows = job.rows.filter((r) => r.status === "error");
  const warningRows = job.rows.filter((r) => r.status === "warning");
  const validRows = job.rows.filter((r) => r.status === "valid");

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{job.totalRows}</p>
          <p className="text-sm text-gray-500">Total Rows</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{job.validRows}</p>
          <p className="text-sm text-gray-500">Valid</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {job.warningRows}
          </p>
          <p className="text-sm text-gray-500">Warnings</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{job.errorRows}</p>
          <p className="text-sm text-gray-500">Errors</p>
        </Card>
      </div>

      {/* Error List */}
      {errorRows.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            Rows with Errors (will be skipped)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto scroll-smooth">
            {errorRows.slice(0, 10).map((row) => (
              <div
                key={row.rowNumber}
                className="bg-red-50 rounded p-3 text-sm"
              >
                <span className="font-medium">Row {row.rowNumber}:</span>
                {row.errors.map((err, i) => (
                  <span key={i} className="ml-2 text-red-600">
                    {err.field}: {err.message}
                  </span>
                ))}
              </div>
            ))}
            {errorRows.length > 10 && (
              <p className="text-sm text-gray-500">
                ...and {errorRows.length - 10} more errors
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Warning List */}
      {warningRows.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Rows with Warnings (will be imported with corrections)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto scroll-smooth">
            {warningRows.slice(0, 10).map((row) => (
              <div
                key={row.rowNumber}
                className="bg-yellow-50 rounded p-3 text-sm"
              >
                <span className="font-medium">Row {row.rowNumber}:</span>
                {row.warnings.map((warn, i) => (
                  <span key={i} className="ml-2 text-yellow-700">
                    {warn.field}: {warn.message}
                    {warn.suggestion && (
                      <span className="text-green-600">
                        {" "}
                        → {warn.suggestion}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            ))}
            {warningRows.length > 10 && (
              <p className="text-sm text-gray-500">
                ...and {warningRows.length - 10} more warnings
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Preview Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Preview (First 5 valid rows)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Student ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Residence
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Guardian
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Phone
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {validRows.slice(0, 5).map((row) => (
                <tr key={row.rowNumber}>
                  <td className="px-4 py-3">{row.mappedData.studentId}</td>
                  <td className="px-4 py-3">
                    {row.mappedData.firstName} {row.mappedData.lastName}
                  </td>
                  <td className="px-4 py-3">{row.mappedData.className}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        row.mappedData.residenceType === "boarder"
                          ? "primary"
                          : "secondary"
                      }
                    >
                      {row.mappedData.residenceType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{row.mappedData.guardianName}</td>
                  <td className="px-4 py-3">{row.mappedData.guardianPhone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Mapping
        </Button>
        <Button
          onClick={onImport}
          disabled={isLoading || job.validRows + job.warningRows === 0}
        >
          {isLoading
            ? "Importing..."
            : `Import ${job.validRows + job.warningRows} Students`}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// IMPORTING PROGRESS COMPONENT
// ============================================

interface ImportingProgressProps {
  job: ImportJob;
}

export function ImportingProgress({ job }: ImportingProgressProps) {
  const progress =
    job.totalRows > 0
      ? Math.round((job.importedRows / job.totalRows) * 100)
      : 0;

  return (
    <Card className="p-8 text-center">
      <div className="mb-6">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2">Importing Students...</h3>
      <p className="text-gray-500 mb-6">Please don't close this window</p>

      <div className="mb-4">
        <ProgressBar value={progress} className="h-3" />
      </div>

      <p className="text-sm text-gray-600">
        {job.importedRows} of {job.totalRows} rows processed
      </p>
    </Card>
  );
}

// ============================================
// IMPORT COMPLETE COMPONENT
// ============================================

interface ImportCompleteProps {
  job: ImportJob;
  onNewImport: () => void;
  onViewStudents: () => void;
}

export function ImportComplete({
  job,
  onNewImport,
  onViewStudents,
}: ImportCompleteProps) {
  const summary = job.summary;

  return (
    <div className="space-y-6">
      <Card className="p-8 text-center bg-green-50 border-green-200">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-green-800 mb-2">
          Import Complete!
        </h3>
        <p className="text-green-700">
          Successfully imported {job.importedRows} students from {job.fileName}
        </p>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {summary?.totalProcessed || job.totalRows}
          </p>
          <p className="text-sm text-gray-500">Total Processed</p>
        </Card>
        <Card className="p-4 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-600">
            {summary?.successfullyImported || job.importedRows}
          </p>
          <p className="text-sm text-gray-500">Imported</p>
        </Card>
        <Card className="p-4 text-center bg-gray-50">
          <p className="text-2xl font-bold text-gray-600">
            {summary?.skipped || job.skippedRows}
          </p>
          <p className="text-sm text-gray-500">Skipped</p>
        </Card>
        <Card className="p-4 text-center bg-red-50">
          <p className="text-2xl font-bold text-red-600">
            {summary?.failed || 0}
          </p>
          <p className="text-sm text-gray-500">Failed</p>
        </Card>
      </div>

      {/* By Class Breakdown */}
      {summary?.byClass && summary.byClass.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Students by Class</h3>
          <div className="flex flex-wrap gap-2">
            {summary.byClass.map(({ className, count }) => (
              <Badge key={className} variant="outline">
                {className}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* By Residence Type */}
      {summary?.byResidenceType && summary.byResidenceType.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Students by Residence Type</h3>
          <div className="flex flex-wrap gap-2">
            {summary.byResidenceType.map(({ type, count }) => (
              <Badge
                key={type}
                variant={type === "boarder" ? "primary" : "secondary"}
              >
                {type}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Error Summary */}
      {summary?.errorsByType && summary.errorsByType.length > 0 && (
        <Card className="p-4 border-red-200">
          <h3 className="font-semibold text-red-700 mb-3">
            Errors Encountered
          </h3>
          <div className="space-y-2">
            {summary.errorsByType.map(({ type, count, examples }) => (
              <div key={type} className="text-sm">
                <span className="font-medium">{type}</span>
                <span className="text-gray-500"> ({count} occurrences)</span>
                {examples.length > 0 && (
                  <span className="text-gray-400">
                    {" "}
                    e.g., {examples.join(", ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={onNewImport}>
          Import More Students
        </Button>
        <Button onClick={onViewStudents}>View Student Directory →</Button>
      </div>
    </div>
  );
}

// ============================================
// IMPORT CONFIG PANEL
// ============================================

interface ImportConfigType {
  year: number;
  term: string;
  duplicateHandling: "skip" | "update" | "error";
  autoAssignFees: boolean;
  defaultResidenceType: ResidenceType;
  defaultStream?: string;
}

interface ImportConfigPanelProps {
  config: ImportConfigType;
  onUpdate: (updates: Partial<ImportConfigType>) => void;
}

export function ImportConfigPanel({
  config,
  onUpdate,
}: ImportConfigPanelProps) {
  return (
    <Card className="p-4 bg-gray-50">
      <h3 className="font-semibold mb-4">Import Settings</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Academic Year
          </label>
          <select
            value={config.year}
            onChange={(e) => onUpdate({ year: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Term
          </label>
          <select
            value={config.term}
            onChange={(e) => onUpdate({ term: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="term_1">Term 1</option>
            <option value="term_2">Term 2</option>
            <option value="term_3">Term 3</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duplicate Handling
          </label>
          <select
            value={config.duplicateHandling}
            onChange={(e) =>
              onUpdate({ duplicateHandling: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="skip">Skip duplicates</option>
            <option value="update">Update existing</option>
            <option value="error">Report as error</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Residence Type
          </label>
          <select
            value={config.defaultResidenceType}
            onChange={(e) =>
              onUpdate({
                defaultResidenceType: e.target.value as ResidenceType,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="day_scholar">Day Scholar</option>
            <option value="boarder">Boarder</option>
            <option value="half_boarder">Half Boarder</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Stream
          </label>
          <Input
            value={config.defaultStream}
            onChange={(e) => onUpdate({ defaultStream: e.target.value })}
            placeholder="e.g., A, Science, Arts"
            className="w-full"
          />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.autoAssignFees}
              onChange={(e) => onUpdate({ autoAssignFees: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              Auto-assign fees based on residence type
            </span>
          </label>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// WIZARD STEPPER
// ============================================

interface WizardStepperProps {
  currentStep: ImportStep;
  steps: { key: ImportStep; label: string }[];
}

export function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const isActive = step.key === currentStep;
        const isComplete = index < currentIndex;

        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? "bg-blue-600 text-white" : ""}
                  ${isComplete ? "bg-green-500 text-white" : ""}
                  ${!isActive && !isComplete ? "bg-gray-200 text-gray-600" : ""}
                `}
              >
                {isComplete ? (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`ml-2 text-sm ${isActive ? "font-medium" : "text-gray-500"}`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-4 ${isComplete ? "bg-green-500" : "bg-gray-200"}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
