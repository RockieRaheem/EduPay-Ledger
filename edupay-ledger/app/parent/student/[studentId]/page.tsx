"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, PaymentStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { formatUGX, formatDate } from "@/lib/utils";

// Type for installment status
type InstallmentStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "overdue";

interface Installment {
  id: string;
  name: string;
  amountDue: number;
  amountPaid: number;
  status: InstallmentStatus;
  deadline: Date;
}

// Mock data - would come from Firebase in production
const mockStudentData = {
  id: "1",
  studentId: "EDU-2024-ABC1-P7",
  name: "John Mukasa",
  className: "Primary 7",
  streamName: "Blue",
  photo: null,
  totalFees: 1450000,
  amountPaid: 850000,
  balance: 600000,
  paymentStatus: "partial" as const,
  guardian: {
    name: "Mrs. Sarah Mukasa",
    phone: "+256 772 456 789",
  },
  installments: [
    {
      id: "1",
      name: "First Installment (Deposit)",
      amountDue: 725000,
      amountPaid: 725000,
      status: "completed" as InstallmentStatus,
      deadline: new Date("2024-02-01"),
    },
    {
      id: "2",
      name: "Second Installment",
      amountDue: 435000,
      amountPaid: 125000,
      status: "in_progress" as InstallmentStatus,
      deadline: new Date("2024-03-15"),
    },
    {
      id: "3",
      name: "Final Installment",
      amountDue: 290000,
      amountPaid: 0,
      status: "not_started" as InstallmentStatus,
      deadline: new Date("2024-04-15"),
    },
  ] as Installment[],
  payments: [
    {
      id: "1",
      receiptNumber: "RCP-ABC123",
      amount: 725000,
      date: new Date("2024-02-01"),
      channel: "MTN Mobile Money",
    },
    {
      id: "2",
      receiptNumber: "RCP-DEF456",
      amount: 125000,
      date: new Date("2024-03-01"),
      channel: "Bank Transfer",
    },
  ],
  school: {
    name: "St. Mary's Primary School",
    term: "Term 1",
    year: "2024",
  },
};

export default function ParentStudentView({
  params,
}: {
  params: { studentId: string };
}) {
  const [student, setStudent] = useState(mockStudentData);
  const [activeTab, setActiveTab] = useState<
    "overview" | "payments" | "receipts"
  >("overview");

  const progress = Math.round((student.amountPaid / student.totalFees) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-100";
      case "in_progress":
        return "text-amber-600 bg-amber-100";
      case "overdue":
        return "text-red-600 bg-red-100";
      default:
        return "text-slate-600 bg-slate-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "check_circle";
      case "in_progress":
        return "pending";
      case "overdue":
        return "error";
      default:
        return "schedule";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/parent"
              className="flex items-center gap-2 text-white/70 hover:text-white"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_back
              </span>
              <span className="text-sm">Logout</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">school</span>
              <span className="font-semibold">eBursar</span>
            </div>
          </div>

          {/* School Info */}
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">{student.school.name}</p>
            <p className="text-white/50 text-xs">
              {student.school.term} • {student.school.year}
            </p>
          </div>

          {/* Student Info */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">
                  person
                </span>
              </div>
              <div className="flex-grow">
                <h1 className="text-xl font-bold">{student.name}</h1>
                <p className="text-white/70 text-sm">
                  {student.className} • {student.streamName}
                </p>
                <p className="text-white/50 text-xs font-mono mt-1">
                  {student.studentId}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Balance Card - Floating */}
      <div className="max-w-lg mx-auto px-4 -mt-4">
        <Card className="shadow-lg">
          <div className="text-center mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Outstanding Balance
            </p>
            <p
              className={`text-3xl font-bold ${student.balance === 0 ? "text-green-600" : "text-amber-600"}`}
            >
              {formatUGX(student.balance)}
            </p>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Payment Progress</span>
              <span className="font-bold text-primary">{progress}%</span>
            </div>
            <ProgressBar
              value={progress}
              color={progress === 100 ? "success" : "primary"}
              size="md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-xs text-slate-400">Total Fees</p>
              <p className="font-bold text-slate-700">
                {formatUGX(student.totalFees)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Amount Paid</p>
              <p className="font-bold text-green-600">
                {formatUGX(student.amountPaid)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(["overview", "payments", "receipts"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white shadow text-primary"
                  : "text-slate-500"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-20">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              Installment Breakdown
            </h2>

            {student.installments.map((installment, index) => (
              <Card
                key={installment.id}
                className={`${
                  installment.status === "overdue"
                    ? "border-2 border-red-200"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${getStatusColor(installment.status)}`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {getStatusIcon(installment.status)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {installment.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Due: {formatDate(installment.deadline)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      installment.status === "completed"
                        ? "success"
                        : installment.status === "overdue"
                          ? "danger"
                          : installment.status === "in_progress"
                            ? "warning"
                            : "default"
                    }
                  >
                    {installment.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Amount Due</span>
                    <span className="font-bold">
                      {formatUGX(installment.amountDue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Paid</span>
                    <span className="font-bold text-green-600">
                      {formatUGX(installment.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2">
                    <span className="text-slate-500">Remaining</span>
                    <span
                      className={`font-bold ${
                        installment.amountDue - installment.amountPaid > 0
                          ? "text-amber-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatUGX(
                        installment.amountDue - installment.amountPaid,
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            {/* Payment Instructions */}
            <Card className="bg-blue-50 border-blue-200">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-blue-600">
                  info
                </span>
                <div>
                  <p className="font-semibold text-blue-800">How to Pay</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Payments are made through Mobile Money or bank transfer.
                    Please contact the school bursar for payment details.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              Payment History
            </h2>

            {student.payments.length === 0 ? (
              <Card className="text-center py-8">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                  payments
                </span>
                <p className="text-slate-500">No payments recorded yet</p>
              </Card>
            ) : (
              student.payments.map((payment) => (
                <Card key={payment.id} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-green-600">
                      check_circle
                    </span>
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-slate-800">
                      {formatUGX(payment.amount)}
                    </p>
                    <p className="text-xs text-slate-500">{payment.channel}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(payment.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-slate-400">
                      {payment.receiptNumber}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "receipts" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              Digital Receipts
            </h2>

            {student.payments.length === 0 ? (
              <Card className="text-center py-8">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                  receipt_long
                </span>
                <p className="text-slate-500">No receipts available</p>
              </Card>
            ) : (
              student.payments.map((payment) => (
                <Card key={payment.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">
                          receipt
                        </span>
                      </div>
                      <div>
                        <p className="font-bold font-mono text-sm">
                          {payment.receiptNumber}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDate(payment.date)}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">
                      {formatUGX(payment.amount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      icon={
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      }
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      icon={
                        <span className="material-symbols-outlined text-sm">
                          download
                        </span>
                      }
                    >
                      Download
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
        <div className="max-w-lg mx-auto">
          <p className="text-center text-xs text-slate-400">
            Last updated: {formatDate(new Date())}
            <br />
            <span className="text-slate-300">Powered by eBursar</span>
          </p>
        </div>
      </div>
    </div>
  );
}
