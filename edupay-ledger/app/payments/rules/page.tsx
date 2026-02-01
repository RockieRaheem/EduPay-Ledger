"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, StatsCard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { formatUGX } from "@/lib/utils";

// Mock data
const mockRules = [
  {
    id: "1",
    name: "Standard 2-Installment Plan",
    minPercent: 50,
    maxInstallments: 2,
    appliesTo: "All Classes",
    status: "active",
    studentsUsing: 245,
  },
  {
    id: "2",
    name: "Flexible 3-Part Plan",
    minPercent: 35,
    maxInstallments: 3,
    appliesTo: "Senior 1-4",
    status: "active",
    studentsUsing: 128,
  },
  {
    id: "3",
    name: "Boarding Students Plan",
    minPercent: 40,
    maxInstallments: 3,
    appliesTo: "Boarding Only",
    status: "active",
    studentsUsing: 89,
  },
  {
    id: "4",
    name: "Emergency Hardship Plan",
    minPercent: 25,
    maxInstallments: 4,
    appliesTo: "By Approval",
    status: "inactive",
    studentsUsing: 12,
  },
];

const classOptions = [
  { value: "all", label: "All Classes" },
  { value: "primary", label: "Primary (P1-P7)" },
  { value: "secondary", label: "Secondary (S1-S6)" },
  { value: "senior", label: "Senior (S1-S4)" },
  { value: "advanced", label: "Advanced (S5-S6)" },
  { value: "boarding", label: "Boarding Students Only" },
  { value: "day", label: "Day Students Only" },
];

export default function InstallmentRulesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<
    (typeof mockRules)[0] | null
  >(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    minPercent: 30,
    maxInstallments: 2,
    appliesTo: "all",
    notes: "",
  });

  const handleEdit = (rule: (typeof mockRules)[0]) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      minPercent: rule.minPercent,
      maxInstallments: rule.maxInstallments,
      appliesTo: rule.appliesTo.toLowerCase().replace(" ", "_"),
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setFormData({
      name: "",
      minPercent: 30,
      maxInstallments: 2,
      appliesTo: "all",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (rule: (typeof mockRules)[0]) => {
    setSelectedRule(rule);
    setIsDeleteModalOpen(true);
  };

  const columns = [
    {
      key: "name",
      header: "Rule Name",
      render: (rule: (typeof mockRules)[0]) => (
        <div>
          <p className="font-semibold text-primary dark:text-white">
            {rule.name}
          </p>
          <p className="text-xs text-slate-400">{rule.appliesTo}</p>
        </div>
      ),
    },
    {
      key: "minPercent",
      header: "Min. First Payment",
      render: (rule: (typeof mockRules)[0]) => (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {rule.minPercent}%
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "maxInstallments",
      header: "Max Installments",
      render: (rule: (typeof mockRules)[0]) => (
        <div className="flex items-center gap-1">
          {Array.from({ length: rule.maxInstallments }).map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded bg-emerald-soft/20 flex items-center justify-center"
            >
              <span className="text-xs font-bold text-emerald-soft">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "studentsUsing",
      header: "Students Using",
      render: (rule: (typeof mockRules)[0]) => (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-sm">
            group
          </span>
          <span className="font-semibold">{rule.studentsUsing}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (rule: (typeof mockRules)[0]) => (
        <Badge
          variant={rule.status === "active" ? "success" : "secondary"}
          className="uppercase text-[10px]"
        >
          {rule.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (rule: (typeof mockRules)[0]) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleEdit(rule)}
            className="p-2 hover:bg-primary/10 rounded-lg text-primary"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <button
            onClick={() => handleDelete(rule)}
            className="p-2 hover:bg-danger/10 rounded-lg text-danger"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
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
            <Link
              href="/payments"
              className="hover:text-primary dark:hover:text-white"
            >
              Payments
            </Link>
            <span className="mx-2">/</span>
            <span className="text-primary dark:text-white font-medium">
              Installment Rules
            </span>
          </nav>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="p-2 bg-primary/10 rounded-lg">
              <span className="material-symbols-outlined text-primary">
                tune
              </span>
            </span>
            Installment Rules Configuration
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          icon={<span className="material-symbols-outlined text-sm">add</span>}
        >
          Create New Rule
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 bg-gradient-to-r from-primary/5 to-emerald-soft/5 border-l-4 border-primary">
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary text-2xl flex-shrink-0">
            info
          </span>
          <div>
            <h4 className="font-bold text-primary dark:text-white mb-1">
              About Installment Rules
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Installment rules define how students can pay their fees in parts.
              Each rule specifies the minimum percentage for the first payment
              and the maximum number of installments allowed. Rules are enforced
              automatically during payment recording.
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Active Rules"
          value={mockRules
            .filter((r) => r.status === "active")
            .length.toString()}
          icon={
            <span className="material-symbols-outlined text-success">
              check_circle
            </span>
          }
          iconBg="bg-success/10"
        />
        <StatsCard
          label="Students on Plans"
          value="474"
          icon={
            <span className="material-symbols-outlined text-primary">
              group
            </span>
          }
          iconBg="bg-primary/10"
        />
        <StatsCard
          label="Avg. First Payment"
          value="42%"
          icon={
            <span className="material-symbols-outlined text-warning">
              percent
            </span>
          }
          iconBg="bg-warning/10"
        />
        <StatsCard
          label="Compliance Rate"
          value="96%"
          trend={{ value: 2.5, isPositive: true }}
          icon={
            <span className="material-symbols-outlined text-emerald-soft">
              verified
            </span>
          }
          iconBg="bg-emerald-soft/10"
        />
      </div>

      {/* Rules Table */}
      <Card padding="none" className="mb-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-primary dark:text-white">
            Configured Installment Rules
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Manage payment plan options available to students
          </p>
        </div>
        <Table columns={columns} data={mockRules} keyExtractor={(r) => r.id} />
      </Card>

      {/* Default Settings */}
      <Card>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            settings
          </span>
          Global Default Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              System Minimum First Payment
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                defaultValue={30}
                min={10}
                max={100}
                className="w-24 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-lg"
              />
              <span className="text-xl font-bold text-slate-400">%</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Absolute minimum across all plans
            </p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Payment Deadline Warning
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                defaultValue={7}
                min={1}
                max={30}
                className="w-24 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-lg"
              />
              <span className="text-sm font-medium text-slate-400">
                days before
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              SMS reminder before deadline
            </p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Grace Period
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                defaultValue={3}
                min={0}
                max={14}
                className="w-24 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-lg"
              />
              <span className="text-sm font-medium text-slate-400">
                days after deadline
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Before marking as overdue
            </p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="primary">Save Default Settings</Button>
        </div>
      </Card>

      {/* Create/Edit Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedRule ? "Edit Installment Rule" : "Create New Rule"}
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Rule Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Standard 2-Installment Plan"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Minimum First Payment (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={25}
                  max={75}
                  value={formData.minPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minPercent: Number(e.target.value),
                    })
                  }
                  className="flex-grow accent-primary"
                />
                <span className="w-16 px-3 py-2 bg-primary/10 rounded-lg text-center font-bold text-primary">
                  {formData.minPercent}%
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Maximum Installments
              </label>
              <div className="flex gap-2">
                {[2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, maxInstallments: num })
                    }
                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                      formData.maxInstallments === num
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-slate-700 text-slate-400"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Applies To
            </label>
            <Select
              value={formData.appliesTo}
              onChange={(e) =>
                setFormData({ ...formData, appliesTo: e.target.value })
              }
            >
              {classOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
              Notes (Optional)
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Add any notes about when to use this rule..."
              rows={3}
            />
          </div>

          {/* Visual Preview */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Payment Schedule Preview (for UGX 1,000,000 fee)
            </p>
            <div className="flex gap-2">
              {Array.from({ length: formData.maxInstallments }).map((_, i) => {
                const firstAmount = 1000000 * (formData.minPercent / 100);
                const remaining = 1000000 - firstAmount;
                const perInstallment =
                  i === 0
                    ? firstAmount
                    : remaining / (formData.maxInstallments - 1);
                return (
                  <div
                    key={i}
                    className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-lg text-center"
                  >
                    <p className="text-[10px] text-slate-400 uppercase">
                      {i === 0
                        ? "First"
                        : `${i + 1}${i === 1 ? "nd" : i === 2 ? "rd" : "th"}`}
                    </p>
                    <p className="font-bold text-primary">
                      {formatUGX(perInstallment)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {i === 0
                        ? `${formData.minPercent}%`
                        : `${Math.round((perInstallment / 1000000) * 100)}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={
                <span className="material-symbols-outlined text-sm">save</span>
              }
            >
              {selectedRule ? "Save Changes" : "Create Rule"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => {
          // Delete logic
          setIsDeleteModalOpen(false);
        }}
        title="Delete Installment Rule"
        message={`Are you sure you want to delete "${selectedRule?.name}"? ${selectedRule?.studentsUsing} students are currently using this plan and will need to be reassigned.`}
        confirmText="Delete Rule"
        variant="danger"
      />

      {/* System Status Bar */}
      <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Rule Engine Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            Compliance Monitoring On
          </span>
        </div>
        <p>© 2024 eBursar Uganda. Built for Security & Trust.</p>
      </footer>
    </div>
  );
}
