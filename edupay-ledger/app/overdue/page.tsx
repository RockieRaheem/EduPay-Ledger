"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, StatsCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { Table, Pagination } from "@/components/ui/Table";
import { FilterChip } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { formatUGX, formatPhone, formatDate } from "@/lib/utils";
import { useFirebaseOverdue } from "@/hooks/useOverdue";

export default function OverduePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    students: overdueStudents,
    stats,
    filters,
    setFilters,
    currentPage,
    totalPages,
    setCurrentPage,
    isLoading,
    error,
    refresh,
    sendReminder,
    sendBulkReminders,
    isAuthenticated,
    authLoading,
  } = useFirebaseOverdue({ pageSize: 10 });

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState(
    "Dear Parent/Guardian, this is a reminder that school fees balance of {balance} for {student} is overdue. Please make payment at your earliest convenience. - EduPay",
  );

  // Apply URL filter on mount
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "overdue") {
      setFilters({ severity: "critical" });
    }
  }, [searchParams, setFilters]);

  // Redirect to login if not authenticated
  // Don't redirect while loading or if we already have data (user is authenticated)
  useEffect(() => {
    if (
      !authLoading &&
      !isAuthenticated &&
      !isLoading &&
      overdueStudents.length === 0
    ) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isLoading, overdueStudents.length, router]);

  const severityFilters = [
    { label: "All Severities", value: "all", count: stats.totalInArrears },
    {
      label: "Critical (30+ days)",
      value: "critical",
      count: stats.criticalCount,
    },
    { label: "High (15-30 days)", value: "high", count: stats.highCount },
    { label: "Medium (7-14 days)", value: "medium", count: stats.mediumCount },
    { label: "Low (1-7 days)", value: "low", count: stats.lowCount },
  ];

  const handleSeverityChange = (value: string) => {
    setFilters({ severity: value });
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === overdueStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(overdueStudents.map((s) => s.id));
    }
  };

  const handleSendReminders = async () => {
    await sendBulkReminders(selectedStudents);
    setIsSmsModalOpen(false);
    setSelectedStudents([]);
  };

  if (isLoading || authLoading) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={
            selectedStudents.length === overdueStudents.length &&
            overdueStudents.length > 0
          }
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
      ),
      render: (student: (typeof overdueStudents)[0]) => (
        <input
          type="checkbox"
          checked={selectedStudents.includes(student.id)}
          onChange={() => toggleStudentSelection(student.id)}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (student: (typeof overdueStudents)[0]) => (
        <div className="flex items-center gap-3">
          {student.photo ? (
            <img
              src={student.photo}
              alt={student.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {student.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-primary dark:text-white">
              {student.name}
            </p>
            <p className="text-xs text-slate-400">
              {student.className} • {student.streamName}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "balance",
      header: "Balance Due",
      render: (student: (typeof overdueStudents)[0]) => (
        <div>
          <p className="font-bold text-danger">{formatUGX(student.balance)}</p>
          <p className="text-[10px] text-slate-400">
            of {formatUGX(student.totalFees)} total
          </p>
        </div>
      ),
    },
    {
      key: "overdue",
      header: "Days Overdue",
      render: (student: (typeof overdueStudents)[0]) => (
        <div className="flex items-center gap-2">
          <SeverityBadge severity={student.severity} />
          <span className="font-bold">{student.daysOverdue}</span>
        </div>
      ),
    },
    {
      key: "guardian",
      header: "Guardian Contact",
      render: (student: (typeof overdueStudents)[0]) => (
        <div>
          <p className="text-sm font-medium">{student.guardian}</p>
          <p className="text-xs text-primary dark:text-blue-400 font-mono">
            {formatPhone(student.guardianPhone)}
          </p>
        </div>
      ),
    },
    {
      key: "lastContact",
      header: "Last Contact",
      render: (student: (typeof overdueStudents)[0]) => (
        <div>
          {student.lastContactDate ? (
            <>
              <p className="text-sm">{formatDate(student.lastContactDate)}</p>
              <p className="text-[10px] text-slate-400">
                {student.contactAttempts} attempt
                {student.contactAttempts !== 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <span className="text-xs text-slate-400 italic">
              Never contacted
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (student: (typeof overdueStudents)[0]) => (
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-2 hover:bg-primary/10 rounded-lg text-primary"
            title="Send SMS"
            onClick={() => sendReminder(student.id)}
          >
            <span className="material-symbols-outlined text-sm">sms</span>
          </button>
          <button
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            title="Call"
          >
            <span className="material-symbols-outlined text-sm text-slate-500">
              call
            </span>
          </button>
          <Link href={`/students/${student.id}`}>
            <button
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              title="View Profile"
            >
              <span className="material-symbols-outlined text-sm text-slate-500">
                visibility
              </span>
            </button>
          </Link>
        </div>
      ),
    },
  ];

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
              Overdue & Debt Management
            </span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="p-2 bg-danger/10 rounded-lg">
              <span className="material-symbols-outlined text-danger">
                warning
              </span>
            </span>
            Overdue & Debt Management
          </h1>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            icon={
              <span className="material-symbols-outlined text-sm">
                download
              </span>
            }
          >
            Export List
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsSmsModalOpen(true)}
            disabled={selectedStudents.length === 0}
            icon={
              <span className="material-symbols-outlined text-sm">send</span>
            }
          >
            Bulk SMS ({selectedStudents.length})
          </Button>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="mb-6 bg-gradient-to-r from-danger/10 to-warning/10 border-l-4 border-danger">
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-danger text-2xl flex-shrink-0">
            priority_high
          </span>
          <div>
            <h4 className="font-bold text-danger mb-1">
              {stats.criticalCount} Students Require Immediate Attention
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              These students have balances overdue by 30+ days. Consider
              scheduling parent meetings or implementing payment plans.
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Total Overdue"
          value={stats.totalInArrears.toString()}
          icon={
            <span className="material-symbols-outlined text-danger">
              group_off
            </span>
          }
          iconBg="bg-danger/10"
        />
        <StatsCard
          label="Total Amount Due"
          value={formatUGX(stats.totalArrearsAmount)}
          icon={
            <span className="material-symbols-outlined text-warning">
              account_balance_wallet
            </span>
          }
          iconBg="bg-warning/10"
        />
        <StatsCard
          label="SMS Sent Today"
          value={stats.smssSentToday.toString()}
          icon={
            <span className="material-symbols-outlined text-primary">sms</span>
          }
          iconBg="bg-primary/10"
        />
        <StatsCard
          label="Recovered This Week"
          value={formatUGX(stats.recoveredThisWeek)}
          trend={{ value: 15, isPositive: true }}
          icon={
            <span className="material-symbols-outlined text-success">
              trending_up
            </span>
          }
          iconBg="bg-success/10"
        />
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            severity: "critical",
            label: "Critical",
            count: stats.criticalCount,
            color: "bg-red-500",
            textColor: "text-red-600",
            bgColor: "bg-red-50 dark:bg-red-900/20",
          },
          {
            severity: "high",
            label: "High",
            count: stats.highCount,
            color: "bg-orange-500",
            textColor: "text-orange-600",
            bgColor: "bg-orange-50 dark:bg-orange-900/20",
          },
          {
            severity: "medium",
            label: "Medium",
            count: stats.mediumCount,
            color: "bg-yellow-500",
            textColor: "text-yellow-600",
            bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          },
          {
            severity: "low",
            label: "Low",
            count: stats.lowCount,
            color: "bg-blue-500",
            textColor: "text-blue-600",
            bgColor: "bg-blue-50 dark:bg-blue-900/20",
          },
        ].map((item) => (
          <button
            key={item.severity}
            onClick={() => handleSeverityChange(item.severity)}
            className={`p-4 rounded-xl border-2 transition-all ${
              filters.severity === item.severity
                ? `${item.bgColor} border-current ${item.textColor}`
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <span
                className={`text-2xl font-bold ${filters.severity === item.severity ? item.textColor : ""}`}
              >
                {item.count}
              </span>
            </div>
            <p
              className={`text-sm font-medium ${filters.severity === item.severity ? item.textColor : "text-slate-600 dark:text-slate-400"}`}
            >
              {item.label} Priority
            </p>
          </button>
        ))}
      </div>

      {/* Overdue Table */}
      <Card padding="none">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-primary dark:text-white">
                Students with Outstanding Balances
              </h3>
              <p className="text-sm text-slate-500">
                {selectedStudents.length > 0
                  ? `${selectedStudents.length} students selected`
                  : "Select students to send bulk SMS reminders"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search students..."
                  value={filters.search || ""}
                  onChange={(e) => setFilters({ search: e.target.value })}
                  className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary w-full md:w-64"
                />
              </div>
            </div>
          </div>

          {/* Severity Filters */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {severityFilters.map((filter) => (
              <FilterChip
                key={filter.value}
                label={`${filter.label} (${filter.count})`}
                selected={filters.severity === filter.value}
                onClick={() => handleSeverityChange(filter.value)}
              />
            ))}
          </div>
        </div>

        <Table
          columns={columns}
          data={overdueStudents}
          keyExtractor={(s) => s.id}
        />

        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-xs text-slate-500">
            Showing {overdueStudents.length} students with overdue balances
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </Card>

      {/* Bulk SMS Modal */}
      <Modal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        title="Send Bulk SMS Reminders"
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 bg-primary/5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary">
                group
              </span>
              <span className="font-semibold">
                {selectedStudents.length} Recipients Selected
              </span>
            </div>
            <p className="text-sm text-slate-500">
              SMS will be sent to guardians of selected students
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Message Template
            </label>
            <Textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={5}
            />
            <div className="flex justify-between mt-2">
              <p className="text-xs text-slate-400">
                Variables: {"{student}"}, {"{balance}"}, {"{deadline}"}
              </p>
              <p className="text-xs text-slate-400">
                {smsMessage.length}/160 characters
              </p>
            </div>
          </div>

          <div className="p-4 bg-warning/10 rounded-xl">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-warning flex-shrink-0">
                info
              </span>
              <div>
                <p className="text-sm font-semibold text-warning">
                  SMS Cost Estimate
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Approximately UGX{" "}
                  {(selectedStudents.length * 50).toLocaleString()} (
                  {selectedStudents.length} x UGX 50 per SMS)
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setIsSmsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={
                <span className="material-symbols-outlined text-sm">send</span>
              }
            >
              Send {selectedStudents.length} SMS
            </Button>
          </div>
        </div>
      </Modal>

      {/* System Status Bar */}
      <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            SMS Gateway Online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Auto-reminders Active
          </span>
        </div>
        <p>© 2024 EduPay Ledger Uganda. Built for Security & Trust.</p>
      </footer>
    </div>
  );
}
