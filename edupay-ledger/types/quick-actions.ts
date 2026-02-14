/**
 * Quick Actions Types
 * Type definitions for quick action widgets and shortcuts
 */

// Quick Action Types
export type QuickActionType =
  | "record_payment"
  | "send_reminder"
  | "clear_student"
  | "generate_report"
  | "add_student"
  | "view_arrears"
  | "view_overdue"
  | "make_promise"
  | "send_statement"
  | "reconcile_payment"
  | "bulk_action";

export interface QuickAction {
  id: string;
  type: QuickActionType;
  title: string;
  description: string;
  icon: string;
  color: "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "gray";
  href?: string;
  onClick?: () => void;
  shortcut?: string;
  badge?: number;
  isDisabled?: boolean;
  category: "payment" | "student" | "report" | "communication" | "admin";
}

// Daily Summary Stats
export interface DailySummary {
  date: Date;
  totalCollected: number;
  transactionCount: number;
  pendingPromises: number;
  overdueAccounts: number;
  studentsCleared: number;
  topPaymentMethods: {
    method: string;
    amount: number;
    count: number;
  }[];
  recentPayments: {
    id: string;
    studentName: string;
    amount: number;
    time: Date;
    method: string;
  }[];
}

// Pending Tasks
export interface PendingTask {
  id: string;
  type:
    | "promise_due"
    | "follow_up"
    | "clearance_request"
    | "reconciliation"
    | "report_due";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: Date;
  relatedId?: string;
  relatedType?: "student" | "payment" | "promise" | "report";
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// Dashboard Alerts
export interface DashboardAlert {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  expiresAt?: Date;
}

// Favorite/Pinned Items
export interface PinnedItem {
  id: string;
  type: "student" | "class" | "report" | "action";
  title: string;
  subtitle?: string;
  href: string;
  icon?: string;
  pinnedAt: Date;
}

// Quick Search Result
export interface QuickSearchResult {
  id: string;
  type: "student" | "payment" | "promise" | "class";
  title: string;
  subtitle: string;
  href: string;
  highlight?: string;
}

// Dashboard Configuration
export interface DashboardConfig {
  userId: string;
  layout: "default" | "compact" | "detailed";
  showDailySummary: boolean;
  showPendingTasks: boolean;
  showRecentPayments: boolean;
  showAlerts: boolean;
  pinnedActions: string[];
  quickAccessItems: PinnedItem[];
  refreshInterval: number; // in seconds
}

// ============================================
// DEFAULT QUICK ACTIONS
// ============================================

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "record-payment",
    type: "record_payment",
    title: "Record Payment",
    description: "Record a new fee payment",
    icon: "💰",
    color: "green",
    href: "/payments/record",
    shortcut: "Alt+P",
    category: "payment",
  },
  {
    id: "view-overdue",
    type: "view_overdue",
    title: "View Overdue",
    description: "Check outstanding balances",
    icon: "📊",
    color: "red",
    href: "/overdue",
    shortcut: "Alt+A",
    category: "payment",
  },
  {
    id: "send-reminder",
    type: "send_reminder",
    title: "Send Reminder",
    description: "Send payment reminders",
    icon: "📱",
    color: "yellow",
    href: "/communications/reminders",
    shortcut: "Alt+R",
    category: "communication",
  },
  {
    id: "clear-student",
    type: "clear_student",
    title: "Clear Student",
    description: "Issue exam clearance",
    icon: "✅",
    color: "blue",
    href: "/students?action=clear",
    shortcut: "Alt+C",
    category: "student",
  },
  {
    id: "generate-report",
    type: "generate_report",
    title: "Generate Report",
    description: "Create financial reports",
    icon: "📄",
    color: "purple",
    href: "/reports",
    shortcut: "Alt+G",
    category: "report",
  },
  {
    id: "add-student",
    type: "add_student",
    title: "Add Student",
    description: "Register a new student",
    icon: "👤",
    color: "blue",
    href: "/students?action=add",
    shortcut: "Alt+N",
    category: "student",
  },
  {
    id: "make-promise",
    type: "make_promise",
    title: "Record Promise",
    description: "Log a payment promise",
    icon: "🤝",
    color: "orange",
    href: "/promises/new",
    shortcut: "Alt+M",
    category: "payment",
  },
  {
    id: "send-statement",
    type: "send_statement",
    title: "Send Statement",
    description: "Email fee statements",
    icon: "📧",
    color: "blue",
    href: "/statements/send",
    category: "communication",
  },
  {
    id: "reconcile-payment",
    type: "reconcile_payment",
    title: "Reconcile",
    description: "Bank reconciliation",
    icon: "🏦",
    color: "gray",
    href: "/reconciliation",
    category: "admin",
  },
  {
    id: "bulk-import",
    type: "bulk_action",
    title: "Bulk Import",
    description: "Import students from file",
    icon: "📥",
    color: "purple",
    href: "/students/import",
    category: "admin",
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getActionsByCategory(
  actions: QuickAction[],
  category: QuickAction["category"],
): QuickAction[] {
  return actions.filter((a) => a.category === category);
}

export function getPriorityColor(priority: PendingTask["priority"]): string {
  const colors = {
    low: "text-gray-500 bg-gray-100",
    medium: "text-blue-500 bg-blue-100",
    high: "text-orange-500 bg-orange-100",
    urgent: "text-red-500 bg-red-100",
  };
  return colors[priority];
}

export function getAlertColor(type: DashboardAlert["type"]): string {
  const colors = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };
  return colors[type];
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
  });
}

export function sortTasksByPriority(tasks: PendingTask[]): PendingTask[] {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}
