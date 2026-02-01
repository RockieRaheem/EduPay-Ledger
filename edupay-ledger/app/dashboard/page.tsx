"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CollectionProgress } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatRelativeTime } from "@/lib/utils";
import { useFirebaseDashboard } from "@/hooks/useFirebaseData";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import type {
  HeatmapRow,
  ActivityItem,
  InstallmentStat,
} from "@/lib/services/dashboard.service";
import {
  exportDashboardToCSV,
  exportDashboardToPDF,
  exportDashboardToExcel,
} from "@/lib/services/export.service";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  iconBg: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  onClick?: () => void;
}

function DashboardStatsCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
  trendDirection = "neutral",
  onClick,
}: StatsCardProps) {
  const trendColor = {
    up: "text-emerald-600",
    down: "text-red-600",
    neutral: "text-slate-500",
  }[trendDirection];

  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-primary dark:text-white mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-sm font-medium mt-2 ${trendColor}`}>{trend}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <span className="material-symbols-outlined text-2xl text-white">
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}

interface HeatmapProps {
  data: HeatmapRow[];
  onCellClick?: (classId: string, streamName: string) => void;
}

function ArrearsHeatmap({ data, onCellClick }: HeatmapProps) {
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toLocaleString();
  };

  const getHeatmapClass = (level: string) => {
    switch (level) {
      case "high":
        return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800";
      case "med":
        return "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800";
      case "low":
      default:
        return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800";
    }
  };

  // Get all unique streams across all classes
  const allStreams = Array.from(
    new Set(data.flatMap((row) => row.streams.map((s) => s.name))),
  ).sort();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[500px]">
        <thead>
          <tr className="text-[10px] text-slate-400 uppercase tracking-widest">
            <th className="py-2 pr-4 font-medium">Class</th>
            {allStreams.map((stream) => (
              <th key={stream} className="py-2 px-2 text-center font-medium">
                Stream {stream}
              </th>
            ))}
            <th className="py-2 pl-4 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {data.map((row) => (
            <tr
              key={row.class}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              <td className="py-3 pr-4 font-semibold text-primary dark:text-white">
                {row.class}
              </td>
              {allStreams.map((streamName) => {
                const stream = row.streams.find((s) => s.name === streamName);
                if (!stream) {
                  return (
                    <td key={streamName} className="p-1">
                      <div className="h-12 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400">
                        -
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={streamName} className="p-1">
                    <div
                      className={`h-12 rounded-lg flex flex-col items-center justify-center font-bold border cursor-pointer hover:opacity-80 transition-opacity ${getHeatmapClass(stream.level)}`}
                      onClick={() => onCellClick?.(row.classId, stream.name)}
                      title={`${row.class} - Stream ${stream.name}: UGX ${stream.value.toLocaleString()} (${stream.studentCount} students)`}
                    >
                      <span className="text-sm">
                        {formatAmount(stream.value)}
                      </span>
                      <span className="text-[9px] opacity-70">
                        {stream.studentCount} students
                      </span>
                    </div>
                  </td>
                );
              })}
              <td className="py-3 pl-4 text-right font-bold text-primary dark:text-white">
                {formatAmount(row.totalArrears)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 dark:border-slate-700">
            <td className="py-3 pr-4 font-bold text-primary dark:text-white">
              TOTAL
            </td>
            {allStreams.map((streamName) => {
              const total = data.reduce((sum, row) => {
                const stream = row.streams.find((s) => s.name === streamName);
                return sum + (stream?.value || 0);
              }, 0);
              return (
                <td
                  key={streamName}
                  className="py-3 px-2 text-center font-bold text-primary dark:text-white"
                >
                  {formatAmount(total)}
                </td>
              );
            })}
            <td className="py-3 pl-4 text-right font-bold text-lg text-red-600 dark:text-red-400">
              {formatAmount(
                data.reduce((sum, row) => sum + row.totalArrears, 0),
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
  onViewAll?: () => void;
}

function ActivityFeed({
  activities,
  maxItems = 6,
  onViewAll,
}: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-4 overflow-y-auto flex-1 pr-2">
        {displayedActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2">
              inbox
            </span>
            <p>No recent activity</p>
          </div>
        ) : (
          displayedActivities.map((activity) => (
            <Link
              key={activity.id}
              href={activity.link || "#"}
              className="flex gap-4 items-start border-b border-slate-50 dark:border-slate-800 pb-3 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <div
                className={`size-9 ${activity.iconBg} ${activity.iconColor} rounded-full flex items-center justify-center shrink-0`}
              >
                <span className="material-symbols-outlined text-sm">
                  {activity.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {activity.description}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">
                  {formatRelativeTime(activity.time)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
      {activities.length > maxItems && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full mt-4 text-sm font-semibold text-primary dark:text-blue-400 hover:underline"
        >
          View All Activity ({activities.length} total)
        </button>
      )}
    </div>
  );
}

interface InstallmentBreakdownProps {
  stats: InstallmentStat[];
}

function InstallmentBreakdown({ stats }: InstallmentBreakdownProps) {
  const total = stats.reduce((sum, s) => sum + s.value, 0);

  const colorClasses = {
    success: "bg-emerald-500",
    primary: "bg-blue-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };

  const bgColorClasses = {
    success: "bg-emerald-100 dark:bg-emerald-900/30",
    primary: "bg-blue-100 dark:bg-blue-900/30",
    warning: "bg-amber-100 dark:bg-amber-900/30",
    danger: "bg-red-100 dark:bg-red-900/30",
  };

  const textColorClasses = {
    success: "text-emerald-600 dark:text-emerald-400",
    primary: "text-blue-600 dark:text-blue-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Visual Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`${colorClasses[stat.color]} transition-all`}
            style={{ width: `${stat.percentage}%` }}
            title={`${stat.name}: ${stat.value} students (${stat.percentage}%)`}
          />
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className={`p-4 rounded-xl ${bgColorClasses[stat.color]}`}
          >
            <p className={`text-3xl font-bold ${textColorClasses[stat.color]}`}>
              {stat.value}
            </p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
              {stat.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {stat.percentage}% of {total} students
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD PAGE
// ============================================================================

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useFirebaseAuth();
  const { data, isLoading, error, refresh, isAuthenticated, authLoading } =
    useFirebaseDashboard({ realtime: true });
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    classId: string;
    stream: string;
  } | null>(null);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Get user's first name
  const firstName =
    user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return amount.toLocaleString();
  };

  const handleHeatmapCellClick = (classId: string, stream: string) => {
    setSelectedCell({ classId, stream });
  };

  const handleExport = async (format: "pdf" | "csv" | "excel") => {
    try {
      const exportData = {
        schoolName: user?.schoolName || "EduPay School",
        term: data?.currentTerm || "Term 1",
        year: data?.academicYear || "2026",
        stats: data?.stats
          ? {
              totalCollection: data.stats.totalCollected || 0,
              todayCollection: 0, // Not tracked in current stats
              totalStudents: data.stats.totalStudents || 0,
              studentsWithArrears: data.stats.overdueStudents || 0,
              collectionRate: data.stats.collectionProgress || 0,
            }
          : undefined,
        heatmap:
          data?.heatmap?.map((row) => ({
            className: row.class || "",
            stream: row.streams?.[0]?.name || "",
            collected: row.totalArrears ? 0 : 100, // Approximation
            outstanding: row.totalArrears || 0,
          })) || [],
        activities:
          data?.recentActivity?.map((activity) => ({
            type: activity.type,
            description: activity.description,
            timestamp:
              activity.time instanceof Date
                ? activity.time.toISOString()
                : String(activity.time),
          })) || [],
        timestamp: new Date().toISOString(),
      };

      switch (format) {
        case "csv":
          exportDashboardToCSV(exportData);
          break;
        case "pdf":
          exportDashboardToPDF(exportData);
          break;
        case "excel":
          exportDashboardToExcel(exportData);
          break;
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setShowExportModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"
              ></div>
            ))}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <Card className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-red-500 mb-4">
            error
          </span>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-2">
            Failed to Load Dashboard
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

  const { stats, heatmap, recentActivity, installmentStats } = data;

  return (
    <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
      {/* Page Heading */}
      <div className="mb-8 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
        <div>
          <p className="text-slate-500 text-sm mb-1">
            {getGreeting()},{" "}
            <span className="font-semibold text-primary dark:text-white">
              {firstName}
            </span>{" "}
            👋
          </p>
          <h1 className="text-2xl lg:text-3xl font-black text-primary dark:text-white tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time fee collection status • {stats.activeStudents} active
            students
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={refresh} className="text-slate-600">
            <span className="material-symbols-outlined text-lg">refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowExportModal(true)}
            icon={
              <span className="material-symbols-outlined text-lg">
                download
              </span>
            }
          >
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <DashboardStatsCard
          title="Total Collected"
          value={`UGX ${formatAmount(stats.totalCollected)}`}
          subtitle={`of ${formatAmount(stats.collectionTarget)} target`}
          icon="account_balance"
          iconBg="bg-emerald-500"
          trend={stats.percentageChange + " vs last term"}
          trendDirection="up"
          onClick={() => router.push("/payments")}
        />
        <DashboardStatsCard
          title="Outstanding Balance"
          value={`UGX ${formatAmount(stats.outstanding)}`}
          subtitle={`${stats.partialStudents + stats.noPaymentStudents} students`}
          icon="pending"
          iconBg="bg-amber-500"
          onClick={() => router.push("/students?status=partial")}
        />
        <DashboardStatsCard
          title="Overdue (30 Days)"
          value={`UGX ${formatAmount(stats.overdue30Days)}`}
          subtitle={`${stats.overdueStudents} students overdue`}
          icon="warning"
          iconBg="bg-red-500"
          onClick={() => router.push("/arrears?filter=overdue")}
        />
        <DashboardStatsCard
          title="Collection Progress"
          value={`${stats.collectionProgress.toFixed(1)}%`}
          subtitle={`${stats.fullyPaidStudents} fully paid`}
          icon="trending_up"
          iconBg="bg-blue-500"
          onClick={() => router.push("/reports")}
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Collection Progress Card */}
          <Card>
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
                  Term Collection Progress
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-primary dark:text-white mt-1">
                  UGX {formatAmount(stats.totalCollected)}{" "}
                  <span className="text-lg font-normal text-slate-400">
                    / {formatAmount(stats.collectionTarget)}
                  </span>
                </p>
              </div>
              <div className="text-left lg:text-right">
                <Badge variant="success" className="text-sm">
                  {stats.percentageChange} vs last term
                </Badge>
              </div>
            </div>
            <CollectionProgress
              collected={stats.totalCollected}
              target={stats.collectionTarget}
              outstanding={stats.outstanding}
              overdue={stats.overdue30Days}
            />
          </Card>

          {/* Class Arrears Heatmap */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Class/Stream Arrears Heatmap</CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200"></div>
                  <span className="text-slate-500">&lt;2M</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
                  <span className="text-slate-500">2-5M</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                  <span className="text-slate-500">&gt;5M</span>
                </div>
              </div>
            </div>
            <ArrearsHeatmap
              data={heatmap}
              onCellClick={handleHeatmapCellClick}
            />
          </Card>

          {/* Installment Completion Breakdown */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <CardTitle>Installment Completion Breakdown</CardTitle>
              <Link
                href="/reports"
                className="text-sm text-primary dark:text-blue-400 hover:underline"
              >
                View Details →
              </Link>
            </div>
            <InstallmentBreakdown stats={installmentStats} />
          </Card>
        </div>

        {/* Sidebar Section */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardTitle>Quick Actions</CardTitle>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <Link href="/payments/record">
                <Button
                  variant="primary"
                  fullWidth
                  className="justify-between group h-14"
                  icon={
                    <span className="material-symbols-outlined text-white/50 group-hover:translate-x-1 transition-transform">
                      chevron_right
                    </span>
                  }
                  iconPosition="right"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined bg-white/20 p-2 rounded-md">
                      payments
                    </span>
                    <span>Record Payment</span>
                  </div>
                </Button>
              </Link>
              <Link href="/students?action=add">
                <Button
                  variant="secondary"
                  fullWidth
                  className="justify-between group h-14"
                  icon={
                    <span className="material-symbols-outlined text-white/50 group-hover:translate-x-1 transition-transform">
                      chevron_right
                    </span>
                  }
                  iconPosition="right"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined bg-white/20 p-2 rounded-md">
                      person_add
                    </span>
                    <span>Add Student</span>
                  </div>
                </Button>
              </Link>
              <Link href="/reports?type=receipts">
                <Button
                  variant="outline"
                  fullWidth
                  className="justify-between group h-14"
                  icon={
                    <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-1 transition-transform">
                      chevron_right
                    </span>
                  }
                  iconPosition="right"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined bg-slate-200 dark:bg-slate-700 p-2 rounded-md">
                      receipt_long
                    </span>
                    <span>Generate Receipts</span>
                  </div>
                </Button>
              </Link>
              <Link href="/arrears">
                <Button
                  variant="outline"
                  fullWidth
                  className="justify-between group h-14 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  icon={
                    <span className="material-symbols-outlined text-red-400 group-hover:translate-x-1 transition-transform">
                      chevron_right
                    </span>
                  }
                  iconPosition="right"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined bg-red-100 dark:bg-red-900/30 text-red-600 p-2 rounded-md">
                      warning
                    </span>
                    <span>View Arrears ({stats.overdueStudents})</span>
                  </div>
                </Button>
              </Link>
            </div>
          </Card>

          {/* Student Summary */}
          <Card>
            <CardTitle>Student Summary</CardTitle>
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">
                  Total Students
                </span>
                <span className="font-bold text-primary dark:text-white">
                  {stats.totalStudents}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Fully Paid
                </span>
                <span className="font-bold text-emerald-600">
                  {stats.fullyPaidStudents}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Partial Payment
                </span>
                <span className="font-bold text-amber-600">
                  {stats.partialStudents}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Overdue
                </span>
                <span className="font-bold text-red-600">
                  {stats.overdueStudents}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  No Payment
                </span>
                <span className="font-bold text-slate-600">
                  {stats.noPaymentStudents}
                </span>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="h-[450px] flex flex-col">
            <CardTitle>Recent Activity</CardTitle>
            <div className="flex-1 mt-4 overflow-hidden">
              <ActivityFeed
                activities={recentActivity}
                maxItems={6}
                onViewAll={() => setShowActivityModal(true)}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="All Recent Activity"
        size="lg"
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <ActivityFeed activities={recentActivity} maxItems={50} />
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Dashboard Report"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Choose a format to export the dashboard data:
          </p>
          <div className="grid grid-cols-1 gap-3">
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

      {/* Heatmap Cell Detail Modal */}
      {selectedCell && (
        <Modal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          title={`${selectedCell.classId} - Stream ${selectedCell.stream}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              View students with outstanding balances in this class/stream.
            </p>
            <Link
              href={`/students?class=${selectedCell.classId}&stream=${selectedCell.stream}&status=overdue`}
              onClick={() => setSelectedCell(null)}
            >
              <Button variant="primary" fullWidth>
                View Students with Arrears
              </Button>
            </Link>
          </div>
        </Modal>
      )}
    </div>
  );
}
