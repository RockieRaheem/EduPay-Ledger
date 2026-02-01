/**
 * Quick Actions Dashboard Components
 * UI components for bursar quick action dashboard
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import {
  QuickAction,
  DailySummary,
  PendingTask,
  DashboardAlert,
  QuickSearchResult,
  formatTimeAgo,
  getPriorityColor,
  getAlertColor,
} from "../../types/quick-actions";

// ============================================
// QUICK ACTION BUTTON
// ============================================

interface QuickActionButtonProps {
  action: QuickAction;
  isPinned?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
}

export function QuickActionButton({
  action,
  isPinned,
  onPin,
  onUnpin,
}: QuickActionButtonProps) {
  const colorClasses = {
    blue: "bg-blue-100 hover:bg-blue-200 text-blue-700",
    green: "bg-green-100 hover:bg-green-200 text-green-700",
    yellow: "bg-yellow-100 hover:bg-yellow-200 text-yellow-700",
    red: "bg-red-100 hover:bg-red-200 text-red-700",
    purple: "bg-purple-100 hover:bg-purple-200 text-purple-700",
    orange: "bg-orange-100 hover:bg-orange-200 text-orange-700",
    gray: "bg-gray-100 hover:bg-gray-200 text-gray-700",
  };

  return (
    <div className="relative group">
      <Link href={action.href || "#"}>
        <div
          className={`p-4 rounded-xl transition-all cursor-pointer ${colorClasses[action.color]} 
            hover:shadow-md hover:-translate-y-0.5`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{action.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{action.title}</p>
              <p className="text-xs opacity-70 truncate">
                {action.description}
              </p>
            </div>
            {action.badge && action.badge > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {action.badge}
              </span>
            )}
          </div>
          {action.shortcut && (
            <p className="text-xs opacity-50 mt-2">{action.shortcut}</p>
          )}
        </div>
      </Link>

      {/* Pin/Unpin button */}
      {(onPin || onUnpin) && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            isPinned ? onUnpin?.() : onPin?.();
          }}
          className="absolute top-1 right-1 p-1 rounded-full bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
          title={isPinned ? "Unpin" : "Pin to dashboard"}
        >
          <span className="text-sm">{isPinned ? "📌" : "📍"}</span>
        </button>
      )}
    </div>
  );
}

// ============================================
// QUICK ACTIONS GRID
// ============================================

interface QuickActionsGridProps {
  actions: QuickAction[];
  title?: string;
  columns?: 2 | 3 | 4;
  onPin?: (actionId: string) => void;
  onUnpin?: (actionId: string) => void;
  pinnedIds?: string[];
}

export function QuickActionsGrid({
  actions,
  title,
  columns = 4,
  onPin,
  onUnpin,
  pinnedIds = [],
}: QuickActionsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div>
      {title && <h3 className="font-semibold mb-3">{title}</h3>}
      <div className={`grid ${gridCols[columns]} gap-3`}>
        {actions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            isPinned={pinnedIds.includes(action.id)}
            onPin={onPin ? () => onPin(action.id) : undefined}
            onUnpin={onUnpin ? () => onUnpin(action.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// DAILY SUMMARY WIDGET
// ============================================

interface DailySummaryWidgetProps {
  summary: DailySummary;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DailySummaryWidget({
  summary,
  onRefresh,
  isRefreshing,
}: DailySummaryWidgetProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Today's Summary</h3>
          <p className="text-xs text-gray-500">
            {new Date(summary.date).toLocaleDateString("en-UG", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "⏳" : "🔄"}
          </Button>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            UGX {summary.totalCollected.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Collected Today</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {summary.transactionCount}
          </p>
          <p className="text-xs text-gray-500">Transactions</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="font-bold text-orange-600">{summary.pendingPromises}</p>
          <p className="text-xs text-gray-500">Promises</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="font-bold text-red-600">{summary.overdueAccounts}</p>
          <p className="text-xs text-gray-500">Overdue</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <p className="font-bold text-green-600">{summary.studentsCleared}</p>
          <p className="text-xs text-gray-500">Cleared</p>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Payment Methods
        </p>
        <div className="space-y-2">
          {summary.topPaymentMethods.slice(0, 3).map((method, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-600">{method.method}</span>
              <span className="font-medium">
                UGX {method.amount.toLocaleString()} ({method.count})
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// RECENT PAYMENTS WIDGET
// ============================================

interface RecentPaymentsWidgetProps {
  payments: DailySummary["recentPayments"];
  onViewAll?: () => void;
}

export function RecentPaymentsWidget({
  payments,
  onViewAll,
}: RecentPaymentsWidgetProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Recent Payments</h3>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All →
          </Button>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No payments today
        </p>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600">💵</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {payment.studentName}
                </p>
                <p className="text-xs text-gray-500">{payment.method}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600 text-sm">
                  +{payment.amount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">
                  {formatTimeAgo(payment.time)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================
// PENDING TASKS WIDGET
// ============================================

interface PendingTasksWidgetProps {
  tasks: PendingTask[];
  onTaskClick?: (task: PendingTask) => void;
  onViewAll?: () => void;
  maxItems?: number;
}

export function PendingTasksWidget({
  tasks,
  onTaskClick,
  onViewAll,
  maxItems = 5,
}: PendingTasksWidgetProps) {
  const displayTasks = tasks.slice(0, maxItems);

  const typeIcons = {
    promise_due: "🤝",
    follow_up: "📞",
    clearance_request: "✅",
    reconciliation: "🏦",
    report_due: "📊",
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Pending Tasks</h3>
          {tasks.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </div>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All →
          </Button>
        )}
      </div>

      {displayTasks.length === 0 ? (
        <div className="text-center py-6">
          <span className="text-3xl mb-2 block">✨</span>
          <p className="text-gray-500 text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{typeIcons[task.type] || "📋"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <Badge
                      variant={
                        task.priority === "urgent"
                          ? "danger"
                          : task.priority === "high"
                            ? "warning"
                            : "secondary"
                      }
                      className="shrink-0"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {task.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Due:{" "}
                    {new Date(task.dueDate).toLocaleDateString("en-UG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================
// DASHBOARD ALERTS WIDGET
// ============================================

interface AlertsWidgetProps {
  alerts: DashboardAlert[];
  onMarkRead?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
}

export function AlertsWidget({
  alerts,
  onMarkRead,
  onDismiss,
}: AlertsWidgetProps) {
  if (alerts.length === 0) return null;

  const alertIcons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded-lg border ${getAlertColor(alert.type)} ${
            !alert.isRead ? "border-l-4" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{alertIcons[alert.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{alert.title}</p>
              <p className="text-xs mt-0.5">{alert.message}</p>
              {alert.action && (
                <Link
                  href={alert.action.href || "#"}
                  className="text-xs font-medium mt-1 inline-block"
                >
                  {alert.action.label} →
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!alert.isRead && onMarkRead && (
                <button
                  onClick={() => onMarkRead(alert.id)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  title="Mark as read"
                >
                  ✓
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  title="Dismiss"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// QUICK SEARCH BOX
// ============================================

interface QuickSearchBoxProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: QuickSearchResult[];
  isSearching: boolean;
  onClear: () => void;
  placeholder?: string;
}

export function QuickSearchBox({
  query,
  onQueryChange,
  results,
  isSearching,
  onClear,
  placeholder = "Search students, payments...",
}: QuickSearchBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsOpen(query.length > 0);
  }, [query]);

  const typeIcons = {
    student: "👤",
    payment: "💰",
    promise: "🤝",
    class: "📚",
  };

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => query && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {query && (
          <button
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-80 overflow-y-auto scroll-smooth scrollbar-thin">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <span className="animate-spin inline-block">⏳</span> Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={result.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                >
                  <span className="text-lg">{typeIcons[result.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SHORTCUT HINTS DISPLAY
// ============================================

interface ShortcutHintsProps {
  actions: QuickAction[];
  show: boolean;
  onClose: () => void;
}

export function ShortcutHints({ actions, show, onClose }: ShortcutHintsProps) {
  const actionsWithShortcuts = actions.filter((a) => a.shortcut);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Card className="p-6 max-w-md w-full m-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Keyboard Shortcuts</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {actionsWithShortcuts.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span>{action.icon}</span>
                  <span className="text-sm">{action.title}</span>
                </div>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                  {action.shortcut}
                </kbd>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            Press Alt+? to toggle shortcuts
          </p>
        </Card>
      </div>
    </div>
  );
}
