"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Progress";

// Step data
const steps = [
  { id: 1, label: "School Info", icon: "school" },
  { id: 2, label: "Academic Structure", icon: "account_tree" },
  { id: 3, label: "Fee Configuration", icon: "payments" },
  { id: 4, label: "Review & Launch", icon: "rocket_launch" },
];

// Class templates
const classTemplates = {
  primary: [
    { name: "Primary 1", shortName: "P1" },
    { name: "Primary 2", shortName: "P2" },
    { name: "Primary 3", shortName: "P3" },
    { name: "Primary 4", shortName: "P4" },
    { name: "Primary 5", shortName: "P5" },
    { name: "Primary 6", shortName: "P6" },
    { name: "Primary 7", shortName: "P7" },
  ],
  secondary: [
    { name: "Senior 1", shortName: "S1" },
    { name: "Senior 2", shortName: "S2" },
    { name: "Senior 3", shortName: "S3" },
    { name: "Senior 4", shortName: "S4" },
    { name: "Senior 5", shortName: "S5" },
    { name: "Senior 6", shortName: "S6" },
  ],
};

const streamTemplates = [
  { name: "East Wing", shortName: "E" },
  { name: "West Wing", shortName: "W" },
  { name: "North Wing", shortName: "N" },
  { name: "South Wing", shortName: "S" },
];

export default function SchoolOnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: School Info
    schoolName: "",
    schoolType: "secondary",
    address: "",
    district: "",
    phone: "",
    email: "",
    motto: "",

    // Step 2: Academic Structure
    selectedClasses: [] as string[],
    selectedStreams: [] as string[],
    currentTerm: "2",
    currentYear: "2024",

    // Step 3: Fee Configuration
    tuitionFee: "",
    boardingFee: "",
    labFee: "",
    uniformFee: "",
    otherFees: "",
    feeNotes: "",
  });

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleClass = (className: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedClasses: prev.selectedClasses.includes(className)
        ? prev.selectedClasses.filter((c) => c !== className)
        : [...prev.selectedClasses, className],
    }));
  };

  const toggleStream = (streamName: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedStreams: prev.selectedStreams.includes(streamName)
        ? prev.selectedStreams.filter((s) => s !== streamName)
        : [...prev.selectedStreams, streamName],
    }));
  };

  const progress = (currentStep / steps.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  School Name *
                </label>
                <Input
                  value={formData.schoolName}
                  onChange={(e) => updateFormData("schoolName", e.target.value)}
                  placeholder="e.g., Kampala Secondary School"
                  icon={
                    <span className="material-symbols-outlined text-sm">
                      school
                    </span>
                  }
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  School Type *
                </label>
                <Select
                  value={formData.schoolType}
                  onChange={(e) => updateFormData("schoolType", e.target.value)}
                >
                  <option value="primary">Primary School</option>
                  <option value="secondary">Secondary School</option>
                  <option value="both">Primary & Secondary</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  District *
                </label>
                <Select
                  value={formData.district}
                  onChange={(e) => updateFormData("district", e.target.value)}
                >
                  <option value="">Select District</option>
                  <option value="kampala">Kampala</option>
                  <option value="wakiso">Wakiso</option>
                  <option value="mukono">Mukono</option>
                  <option value="jinja">Jinja</option>
                  <option value="mbale">Mbale</option>
                  <option value="gulu">Gulu</option>
                  <option value="mbarara">Mbarara</option>
                </Select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Physical Address
                </label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => updateFormData("address", e.target.value)}
                  placeholder="Enter school address..."
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Phone Number *
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value)}
                  placeholder="+256 7XX XXX XXX"
                  icon={
                    <span className="material-symbols-outlined text-sm">
                      phone
                    </span>
                  }
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Email Address
                </label>
                <Input
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="admin@school.ac.ug"
                  type="email"
                  icon={
                    <span className="material-symbols-outlined text-sm">
                      email
                    </span>
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  School Motto (Optional)
                </label>
                <Input
                  value={formData.motto}
                  onChange={(e) => updateFormData("motto", e.target.value)}
                  placeholder="e.g., Excellence in Education"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            {/* Term & Year */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Current Term
                </label>
                <Select
                  value={formData.currentTerm}
                  onChange={(e) =>
                    updateFormData("currentTerm", e.target.value)
                  }
                >
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Academic Year
                </label>
                <Select
                  value={formData.currentYear}
                  onChange={(e) =>
                    updateFormData("currentYear", e.target.value)
                  }
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </Select>
              </div>
            </div>

            {/* Classes */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                Select Classes/Levels *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(formData.schoolType === "primary" ||
                  formData.schoolType === "both") &&
                  classTemplates.primary.map((cls) => (
                    <button
                      key={cls.name}
                      type="button"
                      onClick={() => toggleClass(cls.name)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.selectedClasses.includes(cls.name)
                          ? "border-primary bg-primary/10"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`text-lg font-bold ${
                          formData.selectedClasses.includes(cls.name)
                            ? "text-primary"
                            : "text-slate-500"
                        }`}
                      >
                        {cls.shortName}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{cls.name}</p>
                    </button>
                  ))}
                {(formData.schoolType === "secondary" ||
                  formData.schoolType === "both") &&
                  classTemplates.secondary.map((cls) => (
                    <button
                      key={cls.name}
                      type="button"
                      onClick={() => toggleClass(cls.name)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.selectedClasses.includes(cls.name)
                          ? "border-primary bg-primary/10"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className={`text-lg font-bold ${
                          formData.selectedClasses.includes(cls.name)
                            ? "text-primary"
                            : "text-slate-500"
                        }`}
                      >
                        {cls.shortName}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{cls.name}</p>
                    </button>
                  ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {formData.selectedClasses.length} classes selected
              </p>
            </div>

            {/* Streams */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                Streams/Sections per Class
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {streamTemplates.map((stream) => (
                  <button
                    key={stream.name}
                    type="button"
                    onClick={() => toggleStream(stream.name)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.selectedStreams.includes(stream.name)
                        ? "border-emerald-soft bg-emerald-soft/10"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`text-lg font-bold ${
                        formData.selectedStreams.includes(stream.name)
                          ? "text-emerald-soft"
                          : "text-slate-500"
                      }`}
                    >
                      {stream.shortName}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{stream.name}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {formData.selectedStreams.length} streams selected • Total:{" "}
                {formData.selectedClasses.length *
                  formData.selectedStreams.length}{" "}
                class-stream combinations
              </p>
            </div>

            {/* Custom Stream */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-primary">
                  add_circle
                </span>
                <span className="font-semibold">Add Custom Stream</span>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Stream Name" className="flex-grow" />
                <Button variant="outline">Add</Button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border-l-4 border-primary mb-6">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-primary flex-shrink-0">
                  info
                </span>
                <div>
                  <p className="font-semibold text-primary">
                    Fee Structure Setup
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure the base fees for Term {formData.currentTerm},{" "}
                    {formData.currentYear}. Individual student fees can be
                    adjusted later.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Tuition Fee (per term) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    UGX
                  </span>
                  <input
                    type="text"
                    value={formData.tuitionFee}
                    onChange={(e) =>
                      updateFormData("tuitionFee", e.target.value)
                    }
                    placeholder="0"
                    className="w-full pl-14 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Boarding Fee (if applicable)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    UGX
                  </span>
                  <input
                    type="text"
                    value={formData.boardingFee}
                    onChange={(e) =>
                      updateFormData("boardingFee", e.target.value)
                    }
                    placeholder="0"
                    className="w-full pl-14 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Lab Fee
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    UGX
                  </span>
                  <input
                    type="text"
                    value={formData.labFee}
                    onChange={(e) => updateFormData("labFee", e.target.value)}
                    placeholder="0"
                    className="w-full pl-14 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Uniform Fee
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    UGX
                  </span>
                  <input
                    type="text"
                    value={formData.uniformFee}
                    onChange={(e) =>
                      updateFormData("uniformFee", e.target.value)
                    }
                    placeholder="0"
                    className="w-full pl-14 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Other Fees (comma-separated)
                </label>
                <Textarea
                  value={formData.otherFees}
                  onChange={(e) => updateFormData("otherFees", e.target.value)}
                  placeholder="e.g., Sports Fee: 50000, Library Fee: 30000"
                  rows={2}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Fee Policy Notes
                </label>
                <Textarea
                  value={formData.feeNotes}
                  onChange={(e) => updateFormData("feeNotes", e.target.value)}
                  placeholder="Any additional notes about fee payment policies..."
                  rows={3}
                />
              </div>
            </div>

            {/* Fee Summary */}
            <Card className="bg-slate-50 dark:bg-slate-800">
              <h4 className="font-bold mb-4">
                Estimated Total Fee per Student
              </h4>
              <div className="space-y-2">
                {formData.tuitionFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tuition</span>
                    <span className="font-semibold">
                      UGX{" "}
                      {Number(
                        formData.tuitionFee.replace(/,/g, ""),
                      ).toLocaleString() || 0}
                    </span>
                  </div>
                )}
                {formData.boardingFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Boarding</span>
                    <span className="font-semibold">
                      UGX{" "}
                      {Number(
                        formData.boardingFee.replace(/,/g, ""),
                      ).toLocaleString() || 0}
                    </span>
                  </div>
                )}
                {formData.labFee && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Lab Fee</span>
                    <span className="font-semibold">
                      UGX{" "}
                      {Number(
                        formData.labFee.replace(/,/g, ""),
                      ).toLocaleString() || 0}
                    </span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary text-lg">
                    UGX{" "}
                    {(
                      (Number(formData.tuitionFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.boardingFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.labFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.uniformFee?.replace(/,/g, "")) || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-success">
                  check_circle
                </span>
              </div>
              <h3 className="text-2xl font-bold text-primary dark:text-white mb-2">
                Ready to Launch!
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Review your school setup below. Once confirmed, you can start
                enrolling students and recording payments.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* School Info Summary */}
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-primary">
                      school
                    </span>
                  </div>
                  <h4 className="font-bold">School Information</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name</span>
                    <span className="font-medium">
                      {formData.schoolName || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium capitalize">
                      {formData.schoolType}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">District</span>
                    <span className="font-medium capitalize">
                      {formData.district || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-medium">{formData.phone || "-"}</span>
                  </div>
                </div>
              </Card>

              {/* Academic Structure Summary */}
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-soft/10 rounded-lg">
                    <span className="material-symbols-outlined text-emerald-soft">
                      account_tree
                    </span>
                  </div>
                  <h4 className="font-bold">Academic Structure</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Term</span>
                    <span className="font-medium">
                      Term {formData.currentTerm}, {formData.currentYear}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Classes</span>
                    <span className="font-medium">
                      {formData.selectedClasses.length} levels
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Streams</span>
                    <span className="font-medium">
                      {formData.selectedStreams.length} streams
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Combinations</span>
                    <span className="font-medium text-primary">
                      {formData.selectedClasses.length *
                        formData.selectedStreams.length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Fee Summary */}
            <Card className="bg-gradient-to-br from-primary/5 to-emerald-soft/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <span className="material-symbols-outlined text-primary">
                    payments
                  </span>
                </div>
                <h4 className="font-bold">Fee Configuration</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase">Tuition</p>
                  <p className="font-bold text-lg mt-1">
                    {formData.tuitionFee
                      ? `UGX ${Number(formData.tuitionFee.replace(/,/g, "")).toLocaleString()}`
                      : "-"}
                  </p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase">Boarding</p>
                  <p className="font-bold text-lg mt-1">
                    {formData.boardingFee
                      ? `UGX ${Number(formData.boardingFee.replace(/,/g, "")).toLocaleString()}`
                      : "-"}
                  </p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase">Lab Fee</p>
                  <p className="font-bold text-lg mt-1">
                    {formData.labFee
                      ? `UGX ${Number(formData.labFee.replace(/,/g, "")).toLocaleString()}`
                      : "-"}
                  </p>
                </div>
                <div className="text-center p-4 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase">Total/Term</p>
                  <p className="font-bold text-lg mt-1 text-success">
                    UGX{" "}
                    {(
                      (Number(formData.tuitionFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.boardingFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.labFee?.replace(/,/g, "")) || 0) +
                      (Number(formData.uniformFee?.replace(/,/g, "")) || 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Blockchain Notice */}
            <Card className="bg-gradient-to-r from-primary to-primary/80 text-white">
              <div className="flex gap-4">
                <div className="p-3 bg-white/20 rounded-xl flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">
                    shield
                  </span>
                </div>
                <div>
                  <h4 className="font-bold mb-1">
                    Stellar Blockchain Integration
                  </h4>
                  <p className="text-sm text-white/80">
                    All financial transactions will be automatically anchored to
                    the Stellar blockchain for immutable audit trail
                    verification. This provides regulatory compliance and
                    complete transparency.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        );

      default:
        return null;
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
              School Setup
            </span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">
                settings
              </span>
            </span>
            School Onboarding Setup
          </h1>
        </div>
        <Badge variant="info" className="text-xs uppercase tracking-wide">
          <span className="material-symbols-outlined text-xs mr-1">
            new_releases
          </span>
          New Setup
        </Badge>
      </div>

      {/* Progress Indicator */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-500">
            Setup Progress
          </span>
          <span className="text-sm font-bold text-primary">
            {Math.round(progress)}%
          </span>
        </div>
        <ProgressBar value={progress} color="primary" size="md" />

        {/* Steps */}
        <div className="flex justify-between mt-6">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col items-center gap-2 flex-1 ${
                step.id < currentStep
                  ? "text-success"
                  : step.id === currentStep
                    ? "text-primary"
                    : "text-slate-400"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  step.id < currentStep
                    ? "bg-success text-white"
                    : step.id === currentStep
                      ? "bg-primary text-white"
                      : "bg-slate-100 dark:bg-slate-800"
                }`}
              >
                {step.id < currentStep ? (
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-sm">
                    {step.icon}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium hidden md:block">
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="mb-8">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            {steps[currentStep - 1].icon}
          </span>
          {steps[currentStep - 1].label}
        </h3>
        {renderStep()}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          icon={
            <span className="material-symbols-outlined text-sm">
              arrow_back
            </span>
          }
        >
          Previous
        </Button>

        {currentStep < steps.length ? (
          <Button
            variant="primary"
            onClick={() =>
              setCurrentStep(Math.min(steps.length, currentStep + 1))
            }
            icon={
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            }
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={
              <span className="material-symbols-outlined text-sm">
                rocket_launch
              </span>
            }
          >
            Launch School
          </Button>
        )}
      </div>

      {/* System Status Bar */}
      <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Auto-save Enabled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Data Validated
          </span>
        </div>
        <p>© 2024 eBursar Uganda. Built for Security & Trust.</p>
      </footer>
    </div>
  );
}
