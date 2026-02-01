"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, StatsCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerificationBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { Table } from "@/components/ui/Table";
import { formatUGX, formatDate, formatPhone } from "@/lib/utils";
import {
  useFirebaseStudentProfile,
  StudentTransaction,
} from "@/hooks/useStudentProfile";
import { useStudentFeeBreakdown } from "@/hooks/useFeeCategories";
import { useStudentClearance } from "@/hooks/useExamClearance";
import { useStudentScholarships } from "@/hooks/useScholarship";
import { useStudentTermBalance } from "@/hooks/useTermBalance";
import { useStudentResidenceFees } from "@/hooks/useResidenceFees";
import { FeeCategoryBreakdown } from "@/components/fees/FeeCategoryBreakdown";
import { StudentScholarshipCard } from "@/components/scholarship/ScholarshipComponents";
import { ClearanceBadge } from "@/components/clearance/ExamClearanceReport";
import {
  StudentCumulativeBalanceCard,
  CarryoverHistoryList,
} from "@/components/balance/TermBalanceComponents";
import {
  ResidenceTypeBadge,
  StudentFeeAssignmentCard,
} from "@/components/residence/ResidenceComponents";

export default function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const {
    student,
    transactions,
    isLoading,
    error,
    refresh,
    isAuthenticated,
    authLoading,
  } = useFirebaseStudentProfile(params.id);

  // Get fee breakdown for this student
  const { breakdown: feeBreakdown, isLoading: breakdownLoading } =
    useStudentFeeBreakdown(params.id);

  // Get exam clearance status
  const { clearance, isLoading: clearanceLoading } = useStudentClearance(
    params.id,
  );

  // Get cumulative balance across terms
  const {
    balance: cumulativeBalance,
    carryovers,
    isLoading: balanceLoading,
  } = useStudentTermBalance(params.id);

  // Get residence-based fee assignment
  const { fees: residenceFees, isLoading: residenceFeesLoading } =
    useStudentResidenceFees(params.id);

  // Only redirect to login if:
  // 1. Auth loading is complete (authLoading === false)
  // 2. Data loading is complete (isLoading === false)
  // 3. User is definitely not authenticated
  // 4. We don't have student data (to prevent redirect after successful load)
  useEffect(() => {
    // Don't redirect while still loading
    if (authLoading || isLoading) {
      return;
    }

    // Don't redirect if we have student data (user is viewing content)
    if (student) {
      return;
    }

    // Only redirect if not authenticated and no data
    if (!isAuthenticated && !student) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, isLoading, student, router]);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "momo_mtn":
      case "momo_airtel":
        return {
          icon: "smartphone",
          bg: "bg-yellow-400/10",
          color: "text-yellow-600",
        };
      case "bank":
        return {
          icon: "account_balance",
          bg: "bg-blue-100",
          color: "text-blue-700",
        };
      case "cash":
      default:
        return {
          icon: "payments",
          bg: "bg-slate-100",
          color: "text-slate-600",
        };
    }
  };

  const transactionColumns = [
    {
      key: "date",
      header: "Transaction Date",
      render: (tx: StudentTransaction) => (
        <div>
          <p className="text-sm font-semibold">{formatDate(tx.date)}</p>
          <p className="text-[10px] text-slate-400">
            {tx.date.toLocaleTimeString("en-UG", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ),
    },
    {
      key: "refId",
      header: "Ref ID",
      render: (tx: StudentTransaction) => (
        <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          {tx.refId}
        </span>
      ),
    },
    {
      key: "channel",
      header: "Payment Channel",
      render: (tx: StudentTransaction) => {
        const channelStyle = getChannelIcon(tx.channel);
        return (
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded ${channelStyle.bg} flex items-center justify-center`}
            >
              <span
                className={`material-symbols-outlined text-sm ${channelStyle.color}`}
              >
                {channelStyle.icon}
              </span>
            </div>
            <span className="text-sm font-medium">{tx.channelName}</span>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      render: (tx: StudentTransaction) => (
        <span
          className={`font-bold ${tx.status === "reversed" ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}
        >
          {formatUGX(tx.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (tx: StudentTransaction) => (
        <Badge
          variant={
            tx.status === "cleared"
              ? "success"
              : tx.status === "pending"
                ? "warning"
                : "danger"
          }
          className="uppercase text-[10px]"
        >
          {tx.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Action",
      align: "right" as const,
      render: (tx: StudentTransaction) => (
        <button
          className={`${tx.status === "cleared" ? "text-primary dark:text-blue-400" : "text-slate-400"} hover:bg-primary/5 p-1.5 rounded-lg`}
        >
          <span className="material-symbols-outlined text-sm">
            {tx.status === "cleared" ? "print" : "info_outline"}
          </span>
        </button>
      ),
    },
  ];

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state or student not found
  if (error || !student) {
    return (
      <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
        <Card className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-slate-400 mb-4">
            error_outline
          </span>
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
            {error || "Student Not Found"}
          </h2>
          <p className="text-slate-500 mb-6">
            The student you're looking for could not be found.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
            <Link href="/students">
              <Button variant="primary">View All Students</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-background-light dark:bg-background-dark min-h-full">
      {/* Breadcrumbs & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <nav className="flex text-sm text-slate-500 mb-2">
            <Link
              href="/students"
              className="hover:text-primary dark:hover:text-white"
            >
              Directory
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary dark:text-white font-medium">
              Student Profile
            </span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Financial Record Detail
            <Badge
              variant={
                student.status === "active"
                  ? "success"
                  : student.status === "inactive"
                    ? "danger"
                    : "warning"
              }
              className="text-[10px] uppercase"
            >
              {student.status}
            </Badge>
          </h1>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            icon={
              <span className="material-symbols-outlined text-sm">sms</span>
            }
          >
            Send Receipt SMS
          </Button>
          <Link href={`/payments/record?studentId=${params.id}`}>
            <Button
              variant="primary"
              icon={
                <span className="material-symbols-outlined text-sm">
                  add_card
                </span>
              }
            >
              Record Payment
            </Button>
          </Link>
        </div>
      </div>

      {/* Student Profile Card */}
      <Card className="mb-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="flex-shrink-0">
            {student.photo ? (
              <img
                src={student.photo}
                alt="Student Photo"
                className="w-24 h-24 rounded-xl object-cover ring-4 ring-slate-50 dark:ring-slate-800 shadow-sm"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-primary/10 flex items-center justify-center ring-4 ring-slate-50 dark:ring-slate-800 shadow-sm">
                <span className="text-2xl font-bold text-primary">
                  {student.firstName[0]}
                  {student.lastName[0]}
                </span>
              </div>
            )}
          </div>
          <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                Student Name
              </p>
              <h2 className="text-xl font-bold text-primary dark:text-white">
                {student.firstName} {student.middleName} {student.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">
                  ID: {student.studentId}
                </p>
                {residenceFees && (
                  <ResidenceTypeBadge
                    type={residenceFees.residenceType}
                    size="sm"
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                Academic Info
              </p>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                {student.className} • {student.streamName}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Term {student.term}, {student.year}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
                Guardian Contact
              </p>
              <p className="text-slate-700 dark:text-slate-300 font-medium">
                {student.guardian.name}
              </p>
              <p className="text-sm text-primary dark:text-blue-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">phone</span>
                {formatPhone(student.guardian.phone)}
              </p>
            </div>
          </div>
        </div>

        {/* Exam Clearance Status */}
        {clearance && !clearanceLoading && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ClearanceBadge status={clearance.status} size="lg" showIcon />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Exam Clearance Status
                  </p>
                  <p className="text-xs text-slate-500">
                    {clearance.examType === "end_of_term" &&
                      "End of Term Exams"}
                    {clearance.examType === "mock" && "Mock Examinations"}
                    {clearance.examType === "national" &&
                      "National Examinations (UNEB)"}
                    {" • "}Required: {Math.round(clearance.paymentPercentage)}%
                    payment
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Current Payment: {clearance.paymentPercentage.toFixed(1)}%
                </p>
                {clearance.status === "conditional" &&
                  clearance.conditionalDetails && (
                    <p className="text-xs text-warning">
                      Promise:{" "}
                      {formatUGX(clearance.conditionalDetails.promiseAmount)} by{" "}
                      {new Date(
                        clearance.conditionalDetails.promiseDate.toDate(),
                      ).toLocaleDateString()}
                    </p>
                  )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Fee Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Total Fees */}
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <span className="material-symbols-outlined text-primary dark:text-blue-400">
                receipt_long
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              Total Invoiced
            </span>
          </div>
          <p className="text-sm text-slate-500">Term Total Fees</p>
          <h3 className="text-2xl font-bold mt-1">
            {formatUGX(student.totalFees)}
          </h3>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Includes Tuition, Lab, & Uniform fees
          </div>
        </Card>

        {/* Amount Paid */}
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-success/10 rounded-lg">
              <span className="material-symbols-outlined text-success">
                check_circle
              </span>
            </div>
            <span className="text-[10px] font-bold text-success uppercase tracking-tighter">
              Verified Payments
            </span>
          </div>
          <p className="text-sm text-slate-500">Amount Paid to Date</p>
          <h3 className="text-2xl font-bold mt-1 text-success">
            {formatUGX(student.amountPaid)}
          </h3>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1.5 font-medium">
              <span>Progress ({student.paymentProgress}%)</span>
              <span className="text-success">
                {formatUGX(student.balance)} to go
              </span>
            </div>
            <ProgressBar
              value={student.paymentProgress}
              color="success"
              size="sm"
            />
          </div>
        </Card>

        {/* Balance */}
        <Card>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-warning/10 rounded-lg">
              <span className="material-symbols-outlined text-warning">
                pending_actions
              </span>
            </div>
            <span className="text-[10px] font-bold text-warning uppercase tracking-tighter">
              Outstanding Balance
            </span>
          </div>
          <p className="text-sm text-slate-500">Amount Remaining</p>
          <h3 className="text-2xl font-bold mt-1 text-warning">
            {formatUGX(student.balance)}
          </h3>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500 italic">
              Deadline: {student.deadline}
            </span>
            <span className="material-symbols-outlined text-warning text-sm">
              info
            </span>
          </div>
        </Card>
      </div>

      {/* Cumulative Balance (includes previous terms) */}
      {cumulativeBalance && cumulativeBalance.carryoverBalance > 0 && (
        <div className="mb-8">
          <StudentCumulativeBalanceCard
            balance={cumulativeBalance}
            isLoading={balanceLoading}
            onRecordPayment={() =>
              router.push(`/payments/record?studentId=${params.id}`)
            }
          />
          {carryovers.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-3">
                Balance Carryover History
              </h4>
              <CarryoverHistoryList
                carryovers={carryovers}
                isLoading={balanceLoading}
              />
            </div>
          )}
        </div>
      )}

      {/* Fee Category Breakdown */}
      <div className="mb-8">
        <FeeCategoryBreakdown
          breakdown={feeBreakdown}
          isLoading={breakdownLoading}
          showDetails={true}
          showPaymentHistory={true}
          onRecordPayment={() =>
            router.push(`/payments/record?studentId=${params.id}`)
          }
        />
      </div>

      {/* Scholarship Information */}
      <div className="mb-8">
        <StudentScholarshipCard studentId={params.id} showDetails={true} />
      </div>

      {/* Transaction History */}
      <Card padding="none">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold text-primary dark:text-white">
            Transaction Logs
          </h3>
          <div className="flex gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary w-full md:w-64"
                placeholder="Search logs..."
                type="text"
              />
            </div>
            <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100">
              <span className="material-symbols-outlined text-slate-600 text-sm">
                filter_list
              </span>
            </button>
          </div>
        </div>
        <Table
          columns={transactionColumns}
          data={transactions}
          keyExtractor={(tx) => tx.id}
        />
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center text-xs text-slate-500">
          <span>Showing {transactions.length} transactions</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-sm opacity-50 cursor-not-allowed">
              Previous
            </button>
            <button className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-sm hover:bg-slate-50">
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* System Status Bar */}
      <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Bank Gateway Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            SMS Gateway Online
          </span>
        </div>
        <p>© 2024 EduPay Ledger Uganda. Built for Security & Trust.</p>
      </footer>
    </div>
  );
}
