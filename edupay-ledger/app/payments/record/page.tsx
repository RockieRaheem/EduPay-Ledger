"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";
import { formatUGX } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

// Mock data
const mockStudentSearch = {
  id: "EDU-2023-045-KC",
  name: "Mugisha Ivan Brian",
  class: "Senior 4",
  stream: "East Wing",
  photo:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA0CnWYOn8jgUsEOhUTX7qeTe9V1C0bEWnzP9LGgDmV9isuZqckxogBtA06czEVBCXtb4FHQFSCIxjsRJ0oDLM_1gbq8L72FBxdMZJqnY12IBgQxEk9qy6mT1EynTF8w-DYpnctJon298ne5QMe1UEuPIlOdD__r6bx71PWNeAV5rbJVe1wPGSTAvxKyJXhlGqJMCEHpuszOMeLCAPlz72rPiGcga82FNaeEkaZKXbI5V_VTuG1pxGB_Jq3ZRhiP1ppeLE77VQct5s",
  totalFees: 1450000,
  amountPaid: 850000,
  balance: 600000,
  progress: 58,
  guardian: "Mrs. Sarah Namugisha",
  guardianPhone: "+256772456789",
};

const paymentChannels = [
  { value: "cash", label: "Direct Cash", icon: "payments" },
  { value: "momo_mtn", label: "MTN Mobile Money", icon: "smartphone" },
  { value: "momo_airtel", label: "Airtel Money", icon: "smartphone" },
  { value: "bank", label: "Bank Transfer", icon: "account_balance" },
];

const installmentTypes = [
  { value: "partial", label: "Partial / Installment", minPercent: 30 },
  { value: "full", label: "Full Payment", minPercent: 100 },
];

export default function RecordPaymentPage() {
  const router = useRouter();
  const { success, error: showError, warning } = useToast();
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(mockStudentSearch);
  const [paymentChannel, setPaymentChannel] = useState("cash");
  const [installmentType, setInstallmentType] = useState("partial");
  const [amount, setAmount] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountNumber = Number(amount.replace(/,/g, "")) || 0;
  const minRequired = selectedStudent
    ? Math.ceil(selectedStudent.totalFees * 0.3)
    : 0;
  const maxAllowed = selectedStudent?.balance || 0;
  const isValidAmount =
    amountNumber >= minRequired && amountNumber <= maxAllowed;

  const handleSearch = () => {
    // In real app, search Firestore
    setSelectedStudent(mockStudentSearch);
    success(
      "Student Found",
      `${mockStudentSearch.name} - ${mockStudentSearch.class}`,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidAmount) {
      showError(
        "Invalid Amount",
        `Amount must be between ${formatUGX(minRequired)} and ${formatUGX(maxAllowed)}`,
      );
      return;
    }

    if (paymentChannel !== "cash" && !refNumber.trim()) {
      warning(
        "Reference Required",
        "Please enter the transaction reference number",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit payment logic
      console.log("Payment submitted", {
        studentId: selectedStudent?.id,
        amount: amountNumber,
        channel: paymentChannel,
        installmentType,
        refNumber,
        notes,
        sendSms,
      });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      success(
        "Payment Recorded",
        `${formatUGX(amountNumber)} received for ${selectedStudent?.name}`,
      );

      if (sendSms) {
        success(
          "SMS Sent",
          `Receipt sent to ${selectedStudent?.guardianPhone}`,
        );
      }

      // Reset form or redirect
      router.push("/payments");
    } catch (err) {
      showError(
        "Payment Failed",
        "Could not record payment. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Record Fee Payment
            </span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="p-2 bg-success/10 rounded-lg">
              <span className="material-symbols-outlined text-success">
                add_card
              </span>
            </span>
            Record New Payment
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="info" className="text-xs uppercase tracking-wide">
            <span className="material-symbols-outlined text-xs mr-1">
              verified_user
            </span>
            Stellar Audit Ready
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Student Search & Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student Search */}
            <Card>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  person_search
                </span>
                Find Student
              </h3>
              <div className="flex gap-3 mb-4">
                <div className="flex-grow relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by Student ID, Name or Guardian Phone..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <Button type="button" variant="primary" onClick={handleSearch}>
                  Search
                </Button>
              </div>

              {/* Selected Student Card */}
              {selectedStudent && (
                <div className="border-2 border-success/30 bg-success/5 rounded-xl p-4 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Badge variant="success" className="text-[10px] uppercase">
                      <span className="material-symbols-outlined text-xs mr-0.5">
                        check_circle
                      </span>
                      Selected
                    </Badge>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <img
                      src={selectedStudent.photo}
                      alt="Student"
                      className="w-16 h-16 rounded-xl object-cover ring-2 ring-white shadow-md"
                    />
                    <div className="flex-grow">
                      <p className="text-xs text-slate-400 font-mono">
                        {selectedStudent.id}
                      </p>
                      <h4 className="text-lg font-bold text-primary dark:text-white">
                        {selectedStudent.name}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {selectedStudent.class} • {selectedStudent.stream}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-xs text-slate-400">Current Balance</p>
                      <p className="text-xl font-bold text-warning">
                        {formatUGX(selectedStudent.balance)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedStudent.progress}% paid of{" "}
                        {formatUGX(selectedStudent.totalFees)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-success/20">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">Payment Progress</span>
                      <span className="text-success font-semibold">
                        {selectedStudent.progress}%
                      </span>
                    </div>
                    <ProgressBar
                      value={selectedStudent.progress}
                      color="success"
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Payment Details */}
            <Card>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  receipt_long
                </span>
                Payment Details
              </h3>

              {/* Payment Channel */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                  Payment Channel
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {paymentChannels.map((channel) => (
                    <button
                      key={channel.value}
                      type="button"
                      onClick={() => setPaymentChannel(channel.value)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentChannel === channel.value
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-2xl ${
                          paymentChannel === channel.value
                            ? "text-primary"
                            : "text-slate-400"
                        }`}
                      >
                        {channel.icon}
                      </span>
                      <p
                        className={`text-xs mt-2 font-semibold ${
                          paymentChannel === channel.value
                            ? "text-primary"
                            : "text-slate-500"
                        }`}
                      >
                        {channel.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Installment Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Payment Type
                  </label>
                  <Select
                    value={installmentType}
                    onChange={(e) => setInstallmentType(e.target.value)}
                  >
                    {installmentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-400 mt-2">
                    <span className="material-symbols-outlined text-xs align-middle mr-1">
                      info
                    </span>
                    Minimum 30% required for installments
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Amount (UGX)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      UGX
                    </span>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className={`w-full pl-14 pr-4 py-3 border-2 rounded-xl text-xl font-bold focus:outline-none ${
                        amount && !isValidAmount
                          ? "border-danger bg-danger/5 text-danger"
                          : "border-slate-200 dark:border-slate-700 focus:border-primary"
                      }`}
                    />
                  </div>
                  {selectedStudent && (
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-slate-400">
                        Min: {formatUGX(minRequired)}
                      </span>
                      <span className="text-slate-400">
                        Max: {formatUGX(maxAllowed)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reference Number (for non-cash) */}
              {paymentChannel !== "cash" && (
                <div className="mb-6">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Transaction Reference Number
                  </label>
                  <Input
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. MTN-1234567890 or Bank Ref"
                    icon={
                      <span className="material-symbols-outlined text-sm">
                        tag
                      </span>
                    }
                  />
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Internal Notes (Optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this payment..."
                  rows={3}
                />
              </div>

              {/* SMS Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">
                    sms
                  </span>
                  <div>
                    <p className="font-semibold text-sm">
                      Send Receipt via SMS
                    </p>
                    <p className="text-xs text-slate-400">
                      Notify {selectedStudent?.guardian || "guardian"} at{" "}
                      {selectedStudent?.guardianPhone || "phone"}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                </label>
              </div>
            </Card>
          </div>

          {/* Right Column - Summary & Submit */}
          <div className="space-y-6">
            {/* Payment Summary */}
            <Card className="sticky top-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  summarize
                </span>
                Payment Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Student</span>
                  <span className="font-semibold text-right">
                    {selectedStudent?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Class</span>
                  <span className="font-semibold">
                    {selectedStudent
                      ? `${selectedStudent.class} • ${selectedStudent.stream}`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Payment Channel</span>
                  <span className="font-semibold capitalize">
                    {paymentChannels.find((c) => c.value === paymentChannel)
                      ?.label || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Payment Type</span>
                  <span className="font-semibold">
                    {installmentTypes.find((t) => t.value === installmentType)
                      ?.label || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-4 bg-primary/5 -mx-6 px-6 rounded-lg">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Amount to Record
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {amountNumber > 0 ? formatUGX(amountNumber) : "-"}
                  </span>
                </div>

                {selectedStudent && amountNumber > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-400 mb-2">
                      After this payment:
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">New Balance</span>
                      <span className="font-bold text-success">
                        {formatUGX(
                          Math.max(0, selectedStudent.balance - amountNumber),
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  disabled={!selectedStudent || !isValidAmount}
                  icon={
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                  }
                >
                  Confirm & Record Payment
                </Button>
                <Link href="/students">
                  <Button type="button" variant="outline" fullWidth>
                    Cancel
                  </Button>
                </Link>
              </div>

              {/* Blockchain Notice */}
              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-primary flex-shrink-0">
                    shield
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Stellar Blockchain Audit
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      This payment will be cryptographically anchored to the
                      Stellar blockchain for immutable audit trail verification.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-white">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">bolt</span>
                Quick Actions
              </h4>
              <div className="space-y-2">
                <button className="w-full text-left p-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">
                    history
                  </span>
                  View Recent Payments
                </button>
                <button className="w-full text-left p-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">
                    calculate
                  </span>
                  Fee Calculator
                </button>
                <button className="w-full text-left p-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">
                    help
                  </span>
                  Payment Guidelines
                </button>
              </div>
            </Card>
          </div>
        </div>
      </form>

      {/* System Status Bar */}
      <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Payment Gateway Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Stellar Network Connected
          </span>
        </div>
        <p>© 2024 eBursar Uganda. Built for Security & Trust.</p>
      </footer>
    </div>
  );
}
