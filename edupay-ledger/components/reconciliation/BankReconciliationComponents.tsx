/**
 * Bank Reconciliation Components
 * UI components for matching bank statements with recorded payments
 */

"use client";

import React, { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { ProgressBar } from "../ui/Progress";
import { Table } from "../ui/Table";
import {
  BankTransactionWithStatus,
  ReconciliationSession,
  ReconciliationSummary,
  PossibleMatch,
  BankImportConfig,
  formatReconciliationStatus,
  getStatusColor,
  UGANDA_BANK_CONFIGS,
} from "../../types/bank-reconciliation";

// ============================================
// RECONCILIATION SUMMARY CARD
// ============================================

interface ReconciliationSummaryCardProps {
  summary: ReconciliationSummary;
}

export function ReconciliationSummaryCard({
  summary,
}: ReconciliationSummaryCardProps) {
  const formatAmount = (amount: number) => `UGX ${amount.toLocaleString()}`;

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Reconciliation Summary</h3>

      {/* Match Rate Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Match Rate</span>
          <span className="font-bold text-lg">
            {summary.matchRate.toFixed(1)}%
          </span>
        </div>
        <ProgressBar value={summary.matchRate} className="h-3" />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-blue-600">
            {formatAmount(summary.totalBankCredits)}
          </p>
          <p className="text-xs text-gray-500">Bank Credits</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-600">
            {formatAmount(summary.totalSystemPayments)}
          </p>
          <p className="text-xs text-gray-500">System Payments</p>
        </div>
        <div className="bg-green-100 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-700">
            {formatAmount(summary.matchedAmount)}
          </p>
          <p className="text-xs text-gray-500">Matched</p>
        </div>
        <div
          className={`rounded-lg p-3 text-center ${
            summary.variance === 0
              ? "bg-green-50"
              : summary.variance > 0
                ? "bg-yellow-50"
                : "bg-red-50"
          }`}
        >
          <p
            className={`text-lg font-bold ${
              summary.variance === 0
                ? "text-green-600"
                : summary.variance > 0
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {summary.variance >= 0 ? "+" : ""}
            {formatAmount(summary.variance)}
          </p>
          <p className="text-xs text-gray-500">Variance</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-500 mb-2">By Status</p>
        <div className="space-y-2">
          {summary.byStatus.map(({ status, count, amount }) => (
            <div
              key={status}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${getStatusColor(status)}`}
                >
                  {formatReconciliationStatus(status)}
                </span>
                <span className="text-gray-500">({count})</span>
              </div>
              <span className="font-medium">{formatAmount(amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unmatched Amounts */}
      {(summary.unmatchedBankAmount > 0 ||
        summary.unmatchedSystemAmount > 0) && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            ⚠️ Attention Required
          </p>
          <div className="space-y-1 text-sm">
            {summary.unmatchedBankAmount > 0 && (
              <p className="text-yellow-700">
                Unmatched bank transactions:{" "}
                {formatAmount(summary.unmatchedBankAmount)}
              </p>
            )}
            {summary.unmatchedSystemAmount > 0 && (
              <p className="text-yellow-700">
                Unmatched system payments:{" "}
                {formatAmount(summary.unmatchedSystemAmount)}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================
// TRANSACTION ROW
// ============================================

interface TransactionRowProps {
  transaction: BankTransactionWithStatus;
  onMatch?: (paymentId: string) => void;
  onUnmatch?: () => void;
  onIgnore?: (reason: string) => void;
  onViewDetails?: () => void;
}

export function TransactionRow({
  transaction,
  onMatch,
  onUnmatch,
  onIgnore,
  onViewDetails,
}: TransactionRowProps) {
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showIgnoreModal, setShowIgnoreModal] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");

  const formatAmount = (amount: number) => `UGX ${amount.toLocaleString()}`;

  return (
    <>
      <div
        className={`p-4 border-b ${
          transaction.status === "unmatched"
            ? "bg-red-50"
            : transaction.status === "matched" ||
                transaction.status === "manual_match"
              ? "bg-green-50"
              : transaction.status === "ignored"
                ? "bg-gray-50"
                : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(transaction.status)}`}
              >
                {formatReconciliationStatus(transaction.status)}
              </span>
              <span className="text-sm text-gray-500">
                {new Date(transaction.transactionDate).toLocaleDateString(
                  "en-UG",
                )}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {transaction.reference}
              </span>
            </div>
            <p className="font-medium text-gray-900 truncate">
              {transaction.description}
            </p>
            {transaction.match && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Matched with{" "}
                {transaction.match.matchType === "auto"
                  ? "confidence"
                  : "manually"}
                {transaction.match.matchType === "auto" &&
                  ` (${transaction.match.matchConfidence}%)`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p
              className={`font-bold text-lg ${
                transaction.type === "credit"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {transaction.type === "credit" ? "+" : "-"}
              {formatAmount(transaction.amount)}
            </p>
            <div className="flex items-center gap-2 mt-2 justify-end">
              {transaction.status === "unmatched" && (
                <>
                  <Button size="sm" onClick={() => setShowMatchModal(true)}>
                    Match
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowIgnoreModal(true)}
                  >
                    Ignore
                  </Button>
                </>
              )}
              {(transaction.status === "matched" ||
                transaction.status === "manual_match") &&
                onUnmatch && (
                  <Button size="sm" variant="outline" onClick={onUnmatch}>
                    Unmatch
                  </Button>
                )}
              <Button size="sm" variant="ghost" onClick={onViewDetails}>
                Details
              </Button>
            </div>
          </div>
        </div>

        {/* Possible Matches */}
        {transaction.status === "unmatched" &&
          transaction.possibleMatches &&
          transaction.possibleMatches.length > 0 && (
            <div className="mt-3 p-3 bg-white rounded-lg border">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Suggested Matches
              </p>
              <div className="space-y-2">
                {transaction.possibleMatches.slice(0, 2).map((match) => (
                  <div
                    key={match.paymentId}
                    className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => onMatch?.(match.paymentId)}
                  >
                    <div>
                      <p className="font-medium">{match.studentName}</p>
                      <p className="text-xs text-gray-500">
                        {formatAmount(match.paymentAmount)} •{" "}
                        {match.receiptNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          match.confidence >= 80
                            ? "bg-green-100 text-green-700"
                            : match.confidence >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {match.confidence}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Match Modal */}
      <Modal
        isOpen={showMatchModal}
        onClose={() => setShowMatchModal(false)}
        title="Select Payment to Match"
      >
        <PossibleMatchesList
          matches={transaction.possibleMatches || []}
          onSelect={(paymentId) => {
            onMatch?.(paymentId);
            setShowMatchModal(false);
          }}
        />
      </Modal>

      {/* Ignore Modal */}
      <Modal
        isOpen={showIgnoreModal}
        onClose={() => setShowIgnoreModal(false)}
        title="Ignore Transaction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This transaction will be marked as ignored and excluded from
            reconciliation.
          </p>
          <div>
            <label className="text-sm font-medium">Reason</label>
            <select
              className="w-full mt-1 border rounded-lg p-2"
              value={ignoreReason}
              onChange={(e) => setIgnoreReason(e.target.value)}
            >
              <option value="">Select reason...</option>
              <option value="bank_charges">Bank Charges</option>
              <option value="interest">Interest</option>
              <option value="reversal">Reversal/Correction</option>
              <option value="non_fee">Non-Fee Transaction</option>
              <option value="duplicate">Duplicate Entry</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                onIgnore?.(ignoreReason);
                setShowIgnoreModal(false);
              }}
              disabled={!ignoreReason}
            >
              Confirm Ignore
            </Button>
            <Button variant="outline" onClick={() => setShowIgnoreModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ============================================
// POSSIBLE MATCHES LIST
// ============================================

interface PossibleMatchesListProps {
  matches: PossibleMatch[];
  onSelect: (paymentId: string) => void;
}

export function PossibleMatchesList({
  matches,
  onSelect,
}: PossibleMatchesListProps) {
  const formatAmount = (amount: number) => `UGX ${amount.toLocaleString()}`;

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No matching payments found</p>
        <p className="text-sm mt-1">
          You may need to record this payment first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto scroll-smooth">
      {matches.map((match) => (
        <div
          key={match.paymentId}
          onClick={() => onSelect(match.paymentId)}
          className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-medium">{match.studentName}</p>
              <p className="text-xs text-gray-500">{match.studentId}</p>
            </div>
            <span
              className={`px-2 py-1 rounded text-sm font-medium ${
                match.confidence >= 80
                  ? "bg-green-100 text-green-700"
                  : match.confidence >= 50
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {match.confidence}% match
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Amount</p>
              <p className="font-medium">{formatAmount(match.paymentAmount)}</p>
            </div>
            <div>
              <p className="text-gray-500">Date</p>
              <p>{new Date(match.paymentDate).toLocaleDateString("en-UG")}</p>
            </div>
            <div>
              <p className="text-gray-500">Receipt</p>
              <p>{match.receiptNumber}</p>
            </div>
          </div>
          {match.matchReasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {match.matchReasons.map((reason, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded"
                >
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// SESSION SELECTOR
// ============================================

interface SessionSelectorProps {
  sessions: ReconciliationSession[];
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onNewImport?: () => void;
}

export function SessionSelector({
  sessions,
  selectedId,
  onSelect,
  onNewImport,
}: SessionSelectorProps) {
  const formatAmount = (amount: number) => `UGX ${amount.toLocaleString()}`;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Reconciliation Sessions</h3>
        {onNewImport && (
          <Button size="sm" onClick={onNewImport}>
            + New Import
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>No reconciliation sessions yet</p>
          <p className="text-sm mt-1">Import a bank statement to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedId === session.id
                  ? "border-blue-500 bg-blue-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">{session.bankAccountName}</p>
                <Badge
                  variant={
                    session.status === "completed"
                      ? "success"
                      : session.status === "in_progress"
                        ? "warning"
                        : "default"
                  }
                >
                  {session.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(session.statementPeriodStart).toLocaleDateString(
                  "en-UG",
                )}{" "}
                -
                {new Date(session.statementPeriodEnd).toLocaleDateString(
                  "en-UG",
                )}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-green-600">
                  ✓ {session.matchedCount} matched
                </span>
                <span className="text-red-600">
                  ✗ {session.unmatchedCount} unmatched
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================
// BANK CONFIG SELECTOR
// ============================================

interface BankConfigSelectorProps {
  selectedBank: string | null;
  onSelect: (bankKey: string, config: BankImportConfig) => void;
  detectedBank?: { key: string; config: BankImportConfig } | null;
}

export function BankConfigSelector({
  selectedBank,
  onSelect,
  detectedBank,
}: BankConfigSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Select Your Bank</h3>

      {detectedBank && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            ✓ Detected: <strong>{detectedBank.config.bankName}</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(UGANDA_BANK_CONFIGS).map(([key, config]) => (
          <div
            key={key}
            onClick={() => onSelect(key, config)}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedBank === key
                ? "border-blue-500 bg-blue-50"
                : "hover:bg-gray-50"
            }`}
          >
            <p className="font-medium">{config.bankName}</p>
            <p className="text-xs text-gray-500">
              Date format: {config.dateFormat}
            </p>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500">
        Don't see your bank? Select the closest match or use custom
        configuration.
      </p>
    </div>
  );
}

// ============================================
// IMPORT PREVIEW
// ============================================

interface ImportPreviewProps {
  transactions: any[];
  onConfirm: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

export function ImportPreview({
  transactions,
  onConfirm,
  onBack,
  isProcessing,
}: ImportPreviewProps) {
  const formatAmount = (amount: number) => `UGX ${amount.toLocaleString()}`;

  const credits = transactions.filter((t) => t.type === "credit");
  const debits = transactions.filter((t) => t.type === "debit");
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Preview Import</h3>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold">{transactions.length}</p>
          <p className="text-xs text-gray-500">Transactions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {formatAmount(totalCredits)}
          </p>
          <p className="text-xs text-gray-500">{credits.length} Credits</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">
            {formatAmount(totalDebits)}
          </p>
          <p className="text-xs text-gray-500">{debits.length} Debits</p>
        </div>
      </div>

      {/* Sample transactions */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-64 overflow-y-auto scroll-smooth">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Description</th>
                <th className="text-right p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">
                    {new Date(tx.transactionDate).toLocaleDateString("en-UG")}
                  </td>
                  <td className="p-2 truncate max-w-xs">{tx.description}</td>
                  <td
                    className={`p-2 text-right font-medium ${
                      tx.type === "credit" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatAmount(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length > 10 && (
          <div className="p-2 text-center text-sm text-gray-500 bg-gray-50 border-t">
            And {transactions.length - 10} more transactions...
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={onConfirm} disabled={isProcessing}>
          {isProcessing ? "Importing..." : "Start Import & Auto-Match"}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Back
        </Button>
      </div>
    </div>
  );
}

// ============================================
// STATUS FILTER TABS
// ============================================

interface StatusFilterTabsProps {
  counts: { [key: string]: number };
  selected: string | null;
  onSelect: (status: string | null) => void;
}

export function StatusFilterTabs({
  counts,
  selected,
  onSelect,
}: StatusFilterTabsProps) {
  const tabs = [
    {
      key: null,
      label: "All",
      count: Object.values(counts).reduce((a, b) => a + b, 0),
    },
    { key: "unmatched", label: "Unmatched", count: counts.unmatched || 0 },
    { key: "matched", label: "Auto-Matched", count: counts.matched || 0 },
    { key: "manual_match", label: "Manual", count: counts.manual_match || 0 },
    { key: "ignored", label: "Ignored", count: counts.ignored || 0 },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key || "all"}
          onClick={() => onSelect(tab.key)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
            selected === tab.key
              ? "bg-white shadow text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                tab.key === "unmatched" && tab.count > 0
                  ? "bg-red-100 text-red-600"
                  : "bg-gray-200"
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
