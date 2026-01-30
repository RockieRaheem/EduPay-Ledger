import { Timestamp } from "firebase/firestore";

export interface Student {
  id: string;
  studentId: string; // Unique student ID (e.g., "EDU-2023-045-KC")
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: Timestamp;
  gender: "male" | "female";
  photo?: string;

  // Academic Info
  schoolId: string;
  classId: string;
  streamId?: string; // Optional - not all classes have streams
  className: string;
  streamName?: string; // Optional - not all classes have streams
  academicYear: string;
  term: 1 | 2 | 3;
  enrollmentDate: Timestamp;
  status: "active" | "inactive" | "graduated" | "transferred";

  // Guardian/Parent Info
  guardian: Guardian;

  // Financial Info
  feeStructureId?: string; // Optional - may not be assigned yet
  totalFees: number;
  amountPaid: number;
  balance: number;
  currentInstallment?: number; // Optional - depends on fee structure
  installmentProgress?: InstallmentProgress[]; // Optional - depends on fee structure
  paymentStatus: PaymentStatus;
  lastPaymentDate?: Timestamp;

  // Optional Fields (may vary by school)
  boardingStatus?: "day" | "boarding" | "half_boarding"; // Optional - not all schools have boarding
  scholarshipId?: string; // Optional - if student has scholarship
  scholarshipAmount?: number; // Optional - scholarship discount amount
  specialNeeds?: string; // Optional - special accommodations
  religion?: string; // Optional - some schools track this
  nationality?: string; // Optional - defaults to Ugandan
  previousSchool?: string; // Optional - transfer students
  medicalInfo?: string; // Optional - allergies, conditions
  transportRoute?: string; // Optional - for schools with transport
  uniformSize?: string; // Optional - for uniform tracking

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Student with minimal required fields for quick registration
export interface StudentQuickAdd {
  firstName: string;
  lastName: string;
  gender: "male" | "female";
  classId: string;
  className: string;
  streamId?: string;
  streamName?: string;
  guardianName: string;
  guardianPhone: string;
}

export interface Guardian {
  name: string;
  relationship: "father" | "mother" | "guardian" | "other";
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
}

export interface InstallmentProgress {
  installmentId: string;
  installmentOrder: number;
  installmentName: string;
  amountDue: number;
  amountPaid: number;
  status: "not_started" | "in_progress" | "completed" | "overdue";
  deadline: Timestamp;
  completedAt?: Timestamp;
  isUnlocked: boolean;
}

export type PaymentStatus =
  | "fully_paid" // Balance is 0
  | "partial" // Some payment made, balance remaining
  | "overdue" // Payment deadline passed
  | "no_payment"; // No payment made yet

export interface StudentFilter {
  classId?: string;
  streamId?: string;
  paymentStatus?: PaymentStatus;
  search?: string;
}

export function getStudentInitials(student: Student): string {
  return `${student.firstName[0]}${student.lastName[0]}`.toUpperCase();
}

export function getStudentFullName(student: Student): string {
  return student.middleName
    ? `${student.firstName} ${student.middleName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`;
}

export function calculatePaymentStatus(student: Student): PaymentStatus {
  if (student.balance === 0) return "fully_paid";
  if (student.amountPaid === 0) return "no_payment";

  const hasOverdue = (student.installmentProgress || []).some(
    (ip) => ip.status === "overdue",
  );

  return hasOverdue ? "overdue" : "partial";
}
