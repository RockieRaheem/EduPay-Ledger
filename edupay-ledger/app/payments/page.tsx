"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, Pagination } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { formatUGX, formatDate } from "@/lib/utils";
import { useFirebasePayments } from "@/hooks/useFirebaseData";
import type {
  PaymentListItem,
  PaymentActivity,
  ChannelBreakdown,
} from "@/hooks/usePayments";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend?: { value: number; isPositive: boolean };
}

function StatsCard({
  title,
  value,
  subValue,
  icon,
  iconBg,
  iconColor,
  trend,
}: StatsCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-bold text-primary dark:text-white mt-1">
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-slate-500 mt-1">{subValue}</p>
          )}
          {trend && (
            <p
              className={`text-xs mt-2 flex items-center gap-1 ${trend.isPositive ? "text-emerald-600" : "text-red-600"}`}
            >
              <span className="material-symbols-outlined text-xs">
                {trend.isPositive ? "trending_up" : "trending_down"}
              </span>
              {trend.value}% from last week
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <span className={`material-symbols-outlined text-xl ${iconColor}`}>
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}

interface QuickActionCardProps {
  href: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

function QuickActionCard({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  description,
}: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-all cursor-pointer group h-full">
        <div className="flex items-center gap-4">
          <div
            className={`p-4 rounded-xl ${iconBg} group-hover:scale-105 transition-transform`}
          >
            <span className={`material-symbols-outlined text-2xl ${iconColor}`}>
              {icon}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-primary dark:text-white">{title}</h4>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface ChannelBadgeProps {
  channel: string;
}

function ChannelBadge({ channel }: ChannelBadgeProps) {
  const config: Record<string, { icon: string; color: string }> = {
    momo_mtn: {
      icon: "smartphone",
      color:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    momo_airtel: {
      icon: "smartphone",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    bank_transfer: {
      icon: "account_balance",
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    cash: {
      icon: "payments",
      color:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    cheque: {
      icon: "description",
      color:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    },
    other: {
      icon: "receipt",
      color:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    },
  };

  const { icon, color } = config[channel] || config.other;
  const labels: Record<string, string> = {
    momo_mtn: "MTN MoMo",
    momo_airtel: "Airtel Money",
    bank_transfer: "Bank",
    cash: "Cash",
    cheque: "Cheque",
    other: "Other",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}
    >
      <span className="material-symbols-outlined text-xs">{icon}</span>
      {labels[channel] || channel}
    </span>
  );
}

interface PaymentStatusBadgeCustomProps {
  status: string;
}

function PaymentStatusBadgeCustom({ status }: PaymentStatusBadgeCustomProps) {
  const config: Record<
    string,
    { label: string; variant: "success" | "warning" | "danger" | "info" }
  > = {
    cleared: { label: "Cleared", variant: "success" },
    pending: { label: "Pending", variant: "warning" },
    reversed: { label: "Reversed", variant: "danger" },
    failed: { label: "Failed", variant: "danger" },
  };

  const { label, variant } = config[status] || {
    label: status,
    variant: "info",
  };

  return (
    <Badge variant={variant} dot className="uppercase text-[10px]">
      {label}
    </Badge>
  );
}

interface CollectionChartProps {
  data: { date: string; amount: number; count: number }[];
}

function CollectionChart({ data }: CollectionChartProps) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="h-40 flex items-end gap-2">
      {data.map((day, index) => {
        const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
        const dayName = new Date(day.date).toLocaleDateString("en-US", {
          weekday: "short",
        });
        const isToday = index === data.length - 1;

        return (
          <div
            key={day.date}
            className="flex-1 flex flex-col items-center gap-2"
          >
            <div className="w-full relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {formatUGX(day.amount)}
                  <br />
                  {day.count} payments
                </div>
              </div>
              {/* Bar */}
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday
                    ? "bg-gradient-to-t from-primary to-primary/70"
                    : "bg-slate-200 dark:bg-slate-700 hover:bg-primary/50"
                }`}
                style={{ height: `${Math.max(height, 4)}%`, minHeight: "4px" }}
              />
            </div>
            <span
              className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-slate-500"}`}
            >
              {dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface ChannelBreakdownChartProps {
  data: ChannelBreakdown[];
}

function ChannelBreakdownChart({ data }: ChannelBreakdownChartProps) {
  const colors: Record<string, string> = {
    momo_mtn: "bg-yellow-500",
    momo_airtel: "bg-red-500",
    bank_transfer: "bg-blue-500",
    cash: "bg-emerald-500",
    cheque: "bg-purple-500",
    other: "bg-slate-500",
  };

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.channel} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {item.label}
            </span>
            <span className="text-slate-500">{item.percentage}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors[item.channel] || colors.other} rounded-full transition-all`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{formatUGX(item.amount)}</span>
            <span>{item.count} payments</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ActivityFeedProps {
  activities: PaymentActivity[];
}

function ActivityFeed({ activities }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "payment_recorded":
        return {
          icon: "add_card",
          color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30",
        };
      case "payment_verified":
        return {
          icon: "verified",
          color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
        };
      case "payment_reversed":
        return {
          icon: "undo",
          color: "text-red-500 bg-red-100 dark:bg-red-900/30",
        };
      case "receipt_uploaded":
        return {
          icon: "upload_file",
          color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
        };
      default:
        return {
          icon: "receipt",
          color: "text-slate-500 bg-slate-100 dark:bg-slate-800",
        };
    }
  };

  return (
    <div className="space-y-4">
      {activities.slice(0, 5).map((activity) => {
        const { icon, color } = getActivityIcon(activity.type);
        const timeAgo = getTimeAgo(activity.timestamp);

        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${color}`}>
              <span className="material-symbols-outlined text-sm">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                {activity.description}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>{activity.performedBy}</span>
                <span>•</span>
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

// ============================================================================
// FILTER SECTION
// ============================================================================

interface FilterSectionProps {
  filters: {
    search: string;
    channel: string;
    status: string;
  };
  onFilterChange: (
    filters: Partial<{ search: string; channel: string; status: string }>,
  ) => void;
  onReset: () => void;
  availableChannels: string[];
  availableStatuses: string[];
}

function FilterSection({
  filters,
  onFilterChange,
  onReset,
  availableChannels,
  availableStatuses,
}: FilterSectionProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      onFilterChange({ search: value });
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const channelLabels: Record<string, string> = {
    All: "All Channels",
    momo_mtn: "MTN MoMo",
    momo_airtel: "Airtel Money",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    cheque: "Cheque",
    other: "Other",
  };

  const statusLabels: Record<string, string> = {
    All: "All Status",
    pending: "Pending",
    cleared: "Cleared",
    reversed: "Reversed",
    failed: "Failed",
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-4">
      {/* Search */}
      <div className="flex-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
          Search
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Receipt #, student name, transaction ref..."
            className="w-full h-10 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Channel Filter */}
      <div className="w-full lg:w-48">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
          Channel
        </label>
        <select
          value={filters.channel}
          onChange={(e) => onFilterChange({ channel: e.target.value })}
          className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
        >
          {availableChannels.map((ch) => (
            <option key={ch} value={ch}>
              {channelLabels[ch] || ch}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div className="w-full lg:w-40">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
          Status
        </label>
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value })}
          className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
        >
          {availableStatuses.map((st) => (
            <option key={st} value={st}>
              {statusLabels[st] || st}
            </option>
          ))}
        </select>
      </div>

      {/* Reset */}
      <Button variant="ghost" onClick={onReset} className="h-10">
        <span className="material-symbols-outlined text-sm mr-1">refresh</span>
        Reset
      </Button>
    </div>
  );
}

// ============================================================================
// PAYMENT DETAIL MODAL
// ============================================================================

interface PaymentDetailModalProps {
  payment: PaymentListItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function PaymentDetailModal({
  payment,
  isOpen,
  onClose,
}: PaymentDetailModalProps) {
  if (!payment) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Details" size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Receipt Number
            </p>
            <p className="text-xl font-bold text-primary dark:text-white">
              {payment.receiptNumber}
            </p>
          </div>
          <PaymentStatusBadgeCustom status={payment.status} />
        </div>

        {/* Amount */}
        <div className="text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Amount Paid
          </p>
          <p className="text-3xl font-black text-emerald-600">
            {formatUGX(payment.amount)}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Student
            </p>
            <p className="font-bold text-slate-900 dark:text-white">
              {payment.studentName}
            </p>
            <p className="text-sm text-slate-500">
              {payment.studentClass} {payment.studentStream}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Payment Channel
            </p>
            <ChannelBadge channel={payment.channel} />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Transaction Ref
            </p>
            <p className="font-mono text-sm text-slate-700 dark:text-slate-300">
              {payment.transactionRef}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Recorded By
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {payment.recordedBy}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Date & Time
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {formatDate(payment.recordedAt)}
              <br />
              {payment.recordedAt.toLocaleTimeString("en-UG", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Stellar Audit
            </p>
            {payment.stellarAnchored ? (
              <div className="flex items-center gap-1 text-emerald-600">
                <span className="material-symbols-outlined text-sm">
                  verified
                </span>
                <span className="text-sm font-medium">Anchored</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600">
                <span className="material-symbols-outlined text-sm">
                  pending
                </span>
                <span className="text-sm font-medium">Pending</span>
              </div>
            )}
          </div>
        </div>

        {/* Stellar Hash */}
        {payment.stellarTxHash && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Stellar Transaction Hash
            </p>
            <p className="font-mono text-xs text-slate-600 dark:text-slate-400 break-all">
              {payment.stellarTxHash}
            </p>
          </div>
        )}

        {/* Notes */}
        {payment.notes && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              Notes
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
              {payment.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {payment.status === "pending" && (
            <Button variant="primary">
              <span className="material-symbols-outlined text-sm mr-2">
                verified
              </span>
              Verify Payment
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MAIN PAYMENTS PAGE
// ============================================================================

export default function PaymentsPage() {
  const router = useRouter();
  const {
    payments,
    stats,
    activities,
    channelBreakdown,
    collectionTrend,
    filters,
    setFilters,
    resetFilters,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage,
    isLoading,
    error,
    refresh,
    availableChannels,
    availableStatuses,
    isAuthenticated,
    authLoading,
  } = useFirebasePayments({ pageSize: 10 });

  const [selectedPayment, setSelectedPayment] =
    useState<PaymentListItem | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Table columns
  const columns = [
    {
      key: "receipt",
      header: "Receipt / Ref",
      render: (payment: PaymentListItem) => (
        <div>
          <p className="font-bold text-primary dark:text-white">
            {payment.receiptNumber}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {payment.transactionRef}
          </p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      render: (payment: PaymentListItem) => (
        <div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {formatDate(payment.recordedAt)}
          </p>
          <p className="text-[10px] text-slate-400">
            {payment.recordedAt.toLocaleTimeString("en-UG", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (payment: PaymentListItem) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {payment.studentName}
          </p>
          <p className="text-xs text-slate-500">
            {payment.studentClass} {payment.studentStream}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right" as const,
      render: (payment: PaymentListItem) => (
        <span className="font-bold text-emerald-600">
          {formatUGX(payment.amount)}
        </span>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (payment: PaymentListItem) => (
        <ChannelBadge channel={payment.channel} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (payment: PaymentListItem) => (
        <div className="flex items-center gap-2">
          <PaymentStatusBadgeCustom status={payment.status} />
          {payment.stellarAnchored && (
            <span
              className="material-symbols-outlined text-xs text-emerald-500"
              title="Stellar Anchored"
            >
              verified
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (payment: PaymentListItem) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPayment(payment);
          }}
        >
          <span className="material-symbols-outlined text-sm">visibility</span>
        </Button>
      ),
    },
  ];

  const handleExport = (format: string) => {
    console.log(`Exporting as ${format}`);
    setShowExportModal(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"
              ></div>
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <Card className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-red-500 mb-4">
            error
          </span>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-2">
            Failed to Load Payments
          </h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Button onClick={refresh}>
            <span className="material-symbols-outlined mr-2">refresh</span>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <nav className="flex text-sm text-slate-500 mb-2">
            <Link
              href="/dashboard"
              className="hover:text-primary dark:hover:text-white"
            >
              Dashboard
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary dark:text-white font-medium">
              Payments
            </span>
          </nav>
          <h1 className="text-2xl lg:text-3xl font-black text-primary dark:text-white flex items-center gap-3">
            <span className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <span className="material-symbols-outlined text-emerald-600">
                payments
              </span>
            </span>
            Payment Management
          </h1>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={refresh}>
            <span className="material-symbols-outlined">refresh</span>
          </Button>
          <Button variant="outline" onClick={() => setShowExportModal(true)}>
            <span className="material-symbols-outlined text-sm mr-2">
              download
            </span>
            Export
          </Button>
          <Link href="/payments/record">
            <Button variant="primary">
              <span className="material-symbols-outlined text-sm mr-2">
                add_card
              </span>
              Record Payment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Today's Collection"
          value={formatUGX(stats.todayCollection)}
          subValue={`${stats.todayCount} payments`}
          icon="trending_up"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="This Week"
          value={formatUGX(stats.weekCollection)}
          subValue={`${stats.weekCount} payments`}
          icon="date_range"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Pending Verification"
          value={stats.pendingVerification}
          subValue="Awaiting review"
          icon="pending"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600"
        />
        <StatsCard
          title="Average Payment"
          value={formatUGX(stats.averagePayment)}
          subValue={`${stats.clearedCount} cleared`}
          icon="analytics"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <QuickActionCard
          href="/payments/record"
          icon="add_card"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
          title="Record Payment"
          description="Capture new fee payment"
        />
        <QuickActionCard
          href="/payments/rules"
          icon="tune"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          title="Installment Rules"
          description="Configure payment plans"
        />
        <QuickActionCard
          href="/reports"
          icon="summarize"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600"
          title="View Reports"
          description="Financial summaries"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Collection Trend */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Collection Trend</CardTitle>
              <p className="text-xs text-slate-500">Last 7 days</p>
            </div>
            <Badge variant="info">
              {formatUGX(stats.weekCollection)} total
            </Badge>
          </div>
          <CollectionChart data={collectionTrend} />
        </Card>

        {/* Channel Breakdown */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>By Channel</CardTitle>
              <p className="text-xs text-slate-500">Payment methods</p>
            </div>
          </div>
          <ChannelBreakdownChart data={channelBreakdown} />
        </Card>
      </div>

      {/* Activity & Recent Payments Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Recent Activity</CardTitle>
          </div>
          <ActivityFeed activities={activities} />
        </Card>

        {/* Payments Table */}
        <div className="lg:col-span-3">
          <Card className="mb-4">
            <FilterSection
              filters={{
                search: filters.search,
                channel: filters.channel,
                status: filters.status,
              }}
              onFilterChange={setFilters}
              onReset={resetFilters}
              availableChannels={availableChannels}
              availableStatuses={availableStatuses}
            />
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-primary dark:text-white">
                  Payment Transactions
                </h3>
                <p className="text-xs text-slate-500">
                  Showing {payments.length} of {totalItems}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setFilters({
                      sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
                    })
                  }
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title={`Sort ${filters.sortOrder === "asc" ? "descending" : "ascending"}`}
                >
                  <span className="material-symbols-outlined text-slate-500 text-sm">
                    {filters.sortOrder === "asc"
                      ? "arrow_upward"
                      : "arrow_downward"}
                  </span>
                </button>
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">
                  search_off
                </span>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                  No Payments Found
                </h3>
                <p className="text-slate-500 mb-4">
                  Try adjusting your filters
                </p>
                <Button variant="outline" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            ) : (
              <Table
                columns={columns}
                data={payments}
                keyExtractor={(p) => p.id}
                onRowClick={(payment) => setSelectedPayment(payment)}
              />
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <footer className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Payment Gateway Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            MoMo Integration Online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Stellar Anchoring Active
          </span>
        </div>
        <p>© 2026 eBursar Uganda. Built for Security & Trust.</p>
      </footer>

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Payment Data"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Export {totalItems} payment records:
          </p>
          <div className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => handleExport("csv")}
              className="justify-start"
            >
              <span className="material-symbols-outlined mr-3 text-green-500">
                table_chart
              </span>
              Export as CSV
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => handleExport("pdf")}
              className="justify-start"
            >
              <span className="material-symbols-outlined mr-3 text-red-500">
                picture_as_pdf
              </span>
              Export as PDF
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => handleExport("excel")}
              className="justify-start"
            >
              <span className="material-symbols-outlined mr-3 text-emerald-600">
                grid_on
              </span>
              Export as Excel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
