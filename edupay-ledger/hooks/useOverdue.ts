/**
 * useOverdue Hook
 * Manages arrears data with Firebase integration
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getStudentsWithArrears,
  getStudentById,
} from "@/lib/services/student.service";
import {
  sendDeadlineReminderSMS,
  type DeadlineReminderData,
} from "@/lib/services/notification.service";
import {
  getAllMockStudents,
  getMockGlobalStats,
  type MockStudent,
} from "@/lib/services/mockDataStore";
import type { Student } from "@/types/student";

// ============================================================================
// TYPES
// ============================================================================

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface OverdueStudent {
  id: string;
  studentId: string;
  name: string;
  className: string;
  streamName?: string;
  photo?: string;
  guardian: string;
  guardianPhone: string;
  totalFees: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  severity: SeverityLevel;
  lastPaymentDate?: Date;
  lastContactDate?: Date;
  contactAttempts: number;
}

export interface OverdueStats {
  totalInArrears: number;
  totalArrearsAmount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  smssSentToday: number;
  recoveredThisWeek: number;
}

export interface OverdueFilters {
  search: string;
  severity: string;
  className: string;
  sortBy: 'balance' | 'daysOverdue' | 'name';
  sortOrder: 'asc' | 'desc';
}

interface UseOverdueOptions {
  pageSize?: number;
  useMockData?: boolean;
}

interface UseOverdueReturn {
  students: OverdueStudent[];
  stats: OverdueStats;
  filters: OverdueFilters;
  setFilters: (filters: Partial<OverdueFilters>) => void;
  resetFilters: () => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  availableClasses: string[];
  sendReminder: (studentId: string) => Promise<boolean>;
  sendBulkReminders: (
    studentIds: string[],
  ) => Promise<{ sent: number; failed: number }>;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockOverdueStudents: OverdueStudent[] = [
  {
    id: 'EDU-2023-089-JK',
    studentId: 'EDU-2023-089-JK',
    name: 'Okello David',
    className: 'Senior 3',
    streamName: 'West Wing',
    photo: undefined,
    guardian: 'Mr. James Okello',
    guardianPhone: '+256772111222',
    totalFees: 1200000,
    amountPaid: 360000,
    balance: 840000,
    daysOverdue: 45,
    severity: 'critical',
    lastPaymentDate: new Date('2024-07-15'),
    lastContactDate: new Date('2024-09-01'),
    contactAttempts: 4,
  },
  {
    id: 'EDU-2022-112-MW',
    studentId: 'EDU-2022-112-MW',
    name: 'Nakato Sarah',
    className: 'Senior 2',
    streamName: 'East Wing',
    photo: undefined,
    guardian: 'Mrs. Grace Nakato',
    guardianPhone: '+256782333444',
    totalFees: 1100000,
    amountPaid: 550000,
    balance: 550000,
    daysOverdue: 28,
    severity: 'high',
    lastPaymentDate: new Date('2024-08-01'),
    lastContactDate: new Date('2024-09-10'),
    contactAttempts: 2,
  },
  {
    id: 'EDU-2024-045-AB',
    studentId: 'EDU-2024-045-AB',
    name: 'Tumusiime Peter',
    className: 'Senior 1',
    streamName: 'North Wing',
    photo: undefined,
    guardian: 'Mr. Robert Tumusiime',
    guardianPhone: '+256703555666',
    totalFees: 1000000,
    amountPaid: 600000,
    balance: 400000,
    daysOverdue: 14,
    severity: 'medium',
    lastPaymentDate: new Date('2024-08-20'),
    lastContactDate: new Date('2024-09-12'),
    contactAttempts: 1,
  },
  {
    id: 'EDU-2023-067-CD',
    studentId: 'EDU-2023-067-CD',
    name: 'Apio Grace',
    className: 'Senior 4',
    streamName: 'South Wing',
    photo: undefined,
    guardian: 'Mrs. Mary Apio',
    guardianPhone: '+256772777888',
    totalFees: 1450000,
    amountPaid: 1087500,
    balance: 362500,
    daysOverdue: 7,
    severity: 'low',
    lastPaymentDate: new Date('2024-09-05'),
    lastContactDate: undefined,
    contactAttempts: 0,
  },
];

const mockStats: OverdueStats = {
  totalInArrears: 64,
  totalArrearsAmount: 28450000,
  criticalCount: 12,
  highCount: 18,
  mediumCount: 22,
  lowCount: 12,
  smssSentToday: 45,
  recoveredThisWeek: 3200000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateSeverity(daysOverdue: number): SeverityLevel {
  if (daysOverdue >= 30) return 'critical';
  if (daysOverdue >= 15) return 'high';
  if (daysOverdue >= 7) return 'medium';
  return 'low';
}

function studentToOverdueStudent(student: Student): OverdueStudent {
  const now = new Date();
  const lastPayment = student.lastPaymentDate 
    ? (student.lastPaymentDate as any).toDate?.() || new Date()
    : undefined;
  
  const daysOverdue = lastPayment 
    ? Math.floor((now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24))
    : 30; // Default to 30 days if no payment recorded

  return {
    id: student.id,
    studentId: student.studentId || student.id,
    name: `${student.firstName} ${student.lastName}`,
    className: student.className || 'Unknown',
    streamName: student.streamName,
    photo: student.photo,
    guardian: student.guardian?.name || 'N/A',
    guardianPhone: student.guardian?.phone || '',
    totalFees: student.totalFees || 0,
    amountPaid: student.amountPaid || 0,
    balance: student.balance || 0,
    daysOverdue,
    severity: calculateSeverity(daysOverdue),
    lastPaymentDate: lastPayment,
    lastContactDate: undefined, // Would come from contact log
    contactAttempts: 0, // Would come from contact log
  };
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_FILTERS: OverdueFilters = {
  search: '',
  severity: 'all',
  className: 'All Classes',
  sortBy: 'balance',
  sortOrder: 'desc',
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useOverdue(options: UseOverdueOptions = {}): UseOverdueReturn {
  const { pageSize = 10, useMockData = true } = options;
  const { user } = useAuth();
  const schoolId = user?.schoolId;

  // State
  const [allStudents, setAllStudents] = useState<OverdueStudent[]>([]);
  const [stats, setStats] = useState<OverdueStats>(mockStats);
  const [filters, setFiltersState] = useState<OverdueFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (useMockData || !schoolId) {
        // Use mock data
        setAllStudents(mockOverdueStudents);
        setStats(mockStats);
      } else {
        // Fetch from Firebase
        const students = await getStudentsWithArrears(schoolId);

        const OverdueStudents = students.map(studentToOverdueStudent);
        setAllStudents(OverdueStudents);

        // Calculate stats
        const newStats: OverdueStats = {
          totalInArrears: OverdueStudents.length,
          totalArrearsAmount: OverdueStudents.reduce((sum: number, s: OverdueStudent) => sum + s.balance, 0),
          criticalCount: OverdueStudents.filter((s: OverdueStudent) => s.severity === 'critical').length,
          highCount: OverdueStudents.filter((s: OverdueStudent) => s.severity === 'high').length,
          mediumCount: OverdueStudents.filter((s: OverdueStudent) => s.severity === 'medium').length,
          lowCount: OverdueStudents.filter((s: OverdueStudent) => s.severity === 'low').length,
          smssSentToday: 0, // Would come from SMS service
          recoveredThisWeek: 0, // Would come from payments service
        };
        setStats(newStats);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load arrears data';
      setError(errorMessage);
      // Fall back to mock data on error
      setAllStudents(mockOverdueStudents);
      setStats(mockStats);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, useMockData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...allStudents];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.studentId.toLowerCase().includes(searchLower) ||
          s.guardian.toLowerCase().includes(searchLower)
      );
    }

    // Severity filter
    if (filters.severity !== 'all') {
      result = result.filter((s) => s.severity === filters.severity);
    }

    // Class filter
    if (filters.className !== 'All Classes') {
      result = result.filter((s) => s.className === filters.className);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'balance':
          comparison = a.balance - b.balance;
          break;
        case 'daysOverdue':
          comparison = a.daysOverdue - b.daysOverdue;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allStudents, filters]);

  // Pagination
  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  // Available classes for filter
  const availableClasses = useMemo(() => {
    const classes = new Set(allStudents.map((s) => s.className));
    return ['All Classes', ...Array.from(classes).sort()];
  }, [allStudents]);

  // Actions
  const setFilters = useCallback((newFilters: Partial<OverdueFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  const sendReminder = useCallback(
    async (studentId: string): Promise<boolean> => {
      try {
        // Find the student in our list
        const student = allStudents.find((s) => s.id === studentId);
        if (!student) {
          console.error(`Student not found: ${studentId}`);
          return false;
        }

        // Prepare reminder data
        const reminderData: DeadlineReminderData = {
          phoneNumber: student.guardianPhone,
          studentName: student.name,
          installmentName: "School Fees",
          amountDue: student.balance,
          deadline: new Date(), // Current deadline or next installment
          daysUntilDeadline: student.daysOverdue > 0 ? -student.daysOverdue : 0,
        };

        // Send SMS reminder
        const success = await sendDeadlineReminderSMS(reminderData);

        if (success) {
          console.log(
            `Reminder sent successfully to ${student.guardianPhone} for ${student.name}`,
          );
        } else {
          console.error(`Failed to send reminder to ${student.guardianPhone}`);
        }

        return success;
      } catch (error) {
        console.error(`Error sending reminder to student ${studentId}:`, error);
        return false;
      }
    },
    [allStudents],
  );

  const sendBulkReminders = useCallback(
    async (studentIds: string[]): Promise<{ sent: number; failed: number }> => {
      let sent = 0;
      let failed = 0;

      // Process in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < studentIds.length; i += batchSize) {
        const batch = studentIds.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((id) => sendReminder(id)),
        );

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            sent++;
          } else {
            failed++;
          }
        });

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < studentIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log(`Bulk reminders complete: ${sent} sent, ${failed} failed`);
      return { sent, failed };
    },
    [sendReminder],
  );

  return {
    students: paginatedStudents,
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
    refresh: fetchData,
    availableClasses,
    sendReminder,
    sendBulkReminders,
  };
}

/**
 * Firebase-connected version of useOverdue
 */
export function useFirebaseOverdue(options: { pageSize?: number } = {}) {
  const { user, loading: authLoading } = useAuth();
  const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  
  const arrears = useOverdue({
    pageSize: options.pageSize ?? 10,
    useMockData: USE_MOCK_DATA || !user?.schoolId,
  });

  return {
    ...arrears,
    isAuthenticated: !!user,
    authLoading,
  };
}

export default useOverdue;
