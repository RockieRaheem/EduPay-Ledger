"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { PaymentStatusBadge, Badge } from "@/components/ui/Badge";
import { Table, Pagination } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { formatUGX } from "@/lib/utils";
import { useFirebaseStudents } from "@/hooks/useFirebaseData";
import { useToast } from "@/components/ui/Toast";
import {
  exportStudentsToCSV,
  exportStudentsToPDF,
  exportStudentsToExcel,
} from "@/lib/services/export.service";
import {
  createStudent,
  type CreateStudentInput,
} from "@/lib/services/student.service";
import type { StudentListItem } from "@/hooks/useStudents";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendUp?: boolean;
}

function StatsCard({
  title,
  value,
  icon,
  iconBg,
  iconColor,
  trend,
  trendUp,
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
          {trend && (
            <p
              className={`text-xs mt-2 ${trendUp ? "text-emerald-600" : "text-red-600"}`}
            >
              {trend}
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

interface FilterDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  icon?: string;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  icon,
}: FilterDropdownProps) {
  return (
    <div className="relative">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            {icon}
          </span>
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-10 ${icon ? "pl-9" : "pl-3"} pr-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
          expand_more
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ADD STUDENT MODAL
// ============================================================================

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId?: string;
  onSuccess?: (studentName: string) => void;
}

function AddStudentModal({
  isOpen,
  onClose,
  schoolId = "school-001",
  onSuccess,
}: AddStudentModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    gender: "male",
    className: "",
    streamName: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "parent",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const studentInput: CreateStudentInput = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        gender: formData.gender as "male" | "female",
        schoolId: schoolId,
        classId: formData.className,
        className: formData.className,
        streamId: formData.streamName || undefined,
        streamName: formData.streamName || undefined,
        academicYear: new Date().getFullYear().toString(),
        term: 1,
        guardian: {
          name: formData.guardianName,
          phone: formData.guardianPhone,
          relationship: formData.guardianRelationship as
            | "mother"
            | "father"
            | "guardian"
            | "other",
        },
        feeStructureId: `fee-${formData.className}-2026`,
      };

      const result = await createStudent(studentInput);

      if (result.success) {
        onClose();
        onSuccess?.(`${formData.firstName} ${formData.lastName}`);
      } else {
        setSubmitError(result.error || "Failed to create student");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "An error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Student" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Information */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">person</span>
            Student Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, firstName: e.target.value }))
              }
              required
            />
            <Input
              label="Middle Name"
              value={formData.middleName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, middleName: e.target.value }))
              }
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, lastName: e.target.value }))
              }
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Select
              label="Gender"
              value={formData.gender}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, gender: e.target.value }))
              }
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
            />
            <Select
              label="Class"
              value={formData.className}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, className: e.target.value }))
              }
              options={[
                { value: "", label: "Select Class" },
                { value: "P.1", label: "Primary 1" },
                { value: "P.2", label: "Primary 2" },
                { value: "P.3", label: "Primary 3" },
                { value: "P.4", label: "Primary 4" },
                { value: "P.5", label: "Primary 5" },
                { value: "P.6", label: "Primary 6" },
                { value: "P.7", label: "Primary 7" },
                { value: "S.1", label: "Senior 1" },
                { value: "S.2", label: "Senior 2" },
                { value: "S.3", label: "Senior 3" },
                { value: "S.4", label: "Senior 4" },
                { value: "S.5", label: "Senior 5" },
                { value: "S.6", label: "Senior 6" },
              ]}
              required
            />
            <Select
              label="Stream"
              value={formData.streamName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, streamName: e.target.value }))
              }
              options={[
                { value: "", label: "Select Stream" },
                { value: "Blue", label: "Blue" },
                { value: "Red", label: "Red" },
                { value: "Green", label: "Green" },
                { value: "Yellow", label: "Yellow" },
                { value: "East", label: "East" },
                { value: "West", label: "West" },
              ]}
            />
          </div>
        </div>

        {/* Guardian Information */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">
              family_restroom
            </span>
            Guardian Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Guardian Name"
              value={formData.guardianName}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  guardianName: e.target.value,
                }))
              }
              required
            />
            <Input
              label="Guardian Phone"
              value={formData.guardianPhone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  guardianPhone: e.target.value,
                }))
              }
              placeholder="+256..."
              required
            />
          </div>
          <div className="mt-4">
            <Select
              label="Relationship"
              value={formData.guardianRelationship}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  guardianRelationship: e.target.value,
                }))
              }
              options={[
                { value: "father", label: "Father" },
                { value: "mother", label: "Mother" },
                { value: "guardian", label: "Guardian" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
        </div>

        {/* Error Display */}
        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {submitError}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            <span className="material-symbols-outlined text-sm mr-2">
              person_add
            </span>
            {isSubmitting ? "Adding..." : "Add Student"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// MAIN STUDENTS PAGE
// ============================================================================

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();
  const showAddModal = searchParams.get("action") === "add";

  const {
    students,
    stats,
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
    availableClasses,
    availableStreams,
    isAuthenticated,
    authLoading,
  } = useFirebaseStudents({ pageSize: 10 });

  const [showExportModal, setShowExportModal] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle search with debounce
  const handleSearch = (value: string) => {
    setSearchInput(value);
    // Simple debounce
    const timeoutId = setTimeout(() => {
      setFilters({ search: value });
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const handleExport = async (format: "csv" | "pdf" | "excel") => {
    try {
      const studentsForExport = students.map((s) => ({
        ...s,
        middleName: "",
        guardian: {
          name: s.guardianName,
          phone: s.guardianPhone,
          relationship: "parent" as const,
        },
      }));

      switch (format) {
        case "csv":
          exportStudentsToCSV(
            studentsForExport as any,
            `students_${new Date().toISOString().split("T")[0]}`,
          );
          break;
        case "pdf":
          exportStudentsToPDF(
            studentsForExport as any,
            `students_${new Date().toISOString().split("T")[0]}`,
          );
          break;
        case "excel":
          exportStudentsToExcel(
            studentsForExport as any,
            `students_${new Date().toISOString().split("T")[0]}`,
          );
          break;
      }
      success(
        "Export Complete",
        `Students exported to ${format.toUpperCase()}`,
      );
    } catch (error) {
      console.error("Export failed:", error);
      showError(
        "Export Failed",
        "Could not export students. Please try again.",
      );
    } finally {
      setShowExportModal(false);
    }
  };

  const handleRowClick = (student: StudentListItem) => {
    router.push(`/students/${student.id}`);
  };

  const closeAddModal = () => {
    router.push("/students");
  };

  const handleStudentAdded = (studentName: string) => {
    success("Student Added", `${studentName} has been enrolled successfully`);
    refresh();
  };

  // Table columns
  const columns = [
    {
      key: "name",
      header: "Student Name & ID",
      render: (student: StudentListItem) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={`${student.firstName} ${student.lastName}`}
            src={student.photo}
            size="md"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {student.firstName} {student.lastName}
            </span>
            <span className="text-xs text-gray-500 font-medium uppercase tracking-tighter">
              {student.studentId}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "class",
      header: "Class / Stream",
      render: (student: StudentListItem) => (
        <div className="flex gap-2">
          <Badge variant="default">{student.className}</Badge>
          {student.streamName && (
            <Badge variant="secondary">{student.streamName}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "guardian",
      header: "Guardian",
      render: (student: StudentListItem) => (
        <div className="flex flex-col">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {student.guardianName}
          </span>
          <span className="text-xs text-slate-500">
            {student.guardianPhone}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Payment Status",
      render: (student: StudentListItem) => (
        <PaymentStatusBadge status={student.paymentStatus} />
      ),
    },
    {
      key: "balance",
      header: "Outstanding Balance",
      align: "right" as const,
      render: (student: StudentListItem) => (
        <span
          className={`font-mono text-sm font-bold ${
            student.balance > 0 && student.paymentStatus === "overdue"
              ? "text-red-600"
              : student.balance === 0
                ? "text-emerald-600"
                : "text-gray-900 dark:text-white"
          }`}
        >
          {formatUGX(student.balance)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right" as const,
      render: (student: StudentListItem) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/payments/record?studentId=${student.id}`}
            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="Record Payment"
          >
            <span className="material-symbols-outlined text-sm">add_card</span>
          </Link>
          <Link
            href={`/students/${student.id}`}
            className="text-primary dark:text-blue-400 text-sm font-bold hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </Link>
        </div>
      ),
    },
  ];

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
            Failed to Load Students
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
      {/* Page Heading */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-primary dark:text-white tracking-tight">
            Student Directory
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and track fee payments for {stats.totalStudents} students
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
            Export
          </Button>
          <Link href="/students?action=add">
            <Button
              variant="primary"
              icon={
                <span className="material-symbols-outlined text-lg">
                  person_add
                </span>
              }
            >
              Add Student
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Outstanding"
          value={formatUGX(stats.totalOutstanding)}
          icon="account_balance_wallet"
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600"
        />
        <StatsCard
          title="Total Collected"
          value={formatUGX(stats.totalCollected)}
          icon="payments"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
          trend={`${stats.fullyPaidCount} fully paid`}
          trendUp={true}
        />
        <StatsCard
          title="Partial Payments"
          value={stats.partialCount}
          icon="schedule"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Overdue Accounts"
          value={stats.overdueCount}
          icon="warning"
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600"
          trend={
            stats.noPaymentCount > 0
              ? `${stats.noPaymentCount} no payment`
              : undefined
          }
          trendUp={false}
        />
      </div>

      {/* Filters Section */}
      <Card className="mb-6">
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
                placeholder="Search by name, ID, or guardian..."
                className="w-full h-10 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FilterDropdown
              label="Class"
              value={filters.className}
              options={availableClasses}
              onChange={(value) => setFilters({ className: value })}
              icon="school"
            />
            <FilterDropdown
              label="Stream"
              value={filters.streamName}
              options={availableStreams}
              onChange={(value) => setFilters({ streamName: value })}
              icon="groups"
            />
            <FilterDropdown
              label="Status"
              value={filters.paymentStatus}
              options={[
                "All",
                "fully_paid",
                "partial",
                "overdue",
                "no_payment",
              ]}
              onChange={(value) => setFilters({ paymentStatus: value })}
              icon="filter_list"
            />
            <FilterDropdown
              label="Sort By"
              value={filters.sortBy}
              options={["name", "balance", "className", "lastPayment"]}
              onChange={(value) => setFilters({ sortBy: value as any })}
              icon="sort"
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="ghost"
            onClick={resetFilters}
            className="text-slate-500 h-10"
          >
            <span className="material-symbols-outlined text-sm mr-1">
              refresh
            </span>
            Reset
          </Button>
        </div>

        {/* Active Filters Display */}
        {(filters.className !== "All" ||
          filters.streamName !== "All" ||
          filters.paymentStatus !== "All" ||
          filters.search) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">Active filters:</span>
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                Search: "{filters.search}"
                <button
                  onClick={() => {
                    setFilters({ search: "" });
                    setSearchInput("");
                  }}
                >
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              </span>
            )}
            {filters.className !== "All" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                Class: {filters.className}
                <button onClick={() => setFilters({ className: "All" })}>
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              </span>
            )}
            {filters.streamName !== "All" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                Stream: {filters.streamName}
                <button onClick={() => setFilters({ streamName: "All" })}>
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              </span>
            )}
            {filters.paymentStatus !== "All" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                Status: {filters.paymentStatus.replace("_", " ")}
                <button onClick={() => setFilters({ paymentStatus: "All" })}>
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Results Info */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500">
          Showing {students.length} of {totalItems} students
        </p>
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
            <span className="material-symbols-outlined text-slate-500">
              {filters.sortOrder === "asc" ? "arrow_upward" : "arrow_downward"}
            </span>
          </button>
        </div>
      </div>

      {/* Students Table */}
      {students.length === 0 ? (
        <Card className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">
            search_off
          </span>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
            No Students Found
          </h3>
          <p className="text-slate-500 mb-4">
            Try adjusting your filters or search criteria
          </p>
          <Button variant="outline" onClick={resetFilters}>
            Reset Filters
          </Button>
        </Card>
      ) : (
        <>
          <Card padding="none" className="overflow-hidden">
            <Table
              columns={columns}
              data={students}
              keyExtractor={(student) => student.id}
              onRowClick={handleRowClick}
            />
          </Card>

          {/* Pagination */}
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={10}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}

      {/* Quick Stats Footer */}
      <Card className="mt-6">
        <div className="flex flex-wrap justify-center gap-8 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.fullyPaidCount}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Fully Paid
            </p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {stats.partialCount}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Partial
            </p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {stats.overdueCount}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Overdue
            </p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
          <div>
            <p className="text-2xl font-bold text-slate-600">
              {stats.noPaymentCount}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              No Payment
            </p>
          </div>
        </div>
      </Card>

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        onSuccess={handleStudentAdded}
      />

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Student Data"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Export {totalItems} students to your preferred format:
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
