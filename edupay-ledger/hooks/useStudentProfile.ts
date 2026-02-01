"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getStudentById,
  getStudentByStudentId,
} from "@/lib/services/student.service";
import type { Student } from "@/types/student";

// Determine if we should use mock data
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// Types for student profile
export interface StudentTransaction {
  id: string;
  date: Date;
  refId: string;
  channel: string;
  channelName: string;
  amount: number;
  status: "cleared" | "pending" | "reversed";
}

export interface StudentProfileData {
  id: string;
  studentId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  photo: string | null;
  className: string;
  streamName: string;
  term: number;
  year: number;
  status: "active" | "inactive" | "graduated" | "transferred";
  guardian: {
    name: string;
    phone: string;
  };
  totalFees: number;
  amountPaid: number;
  balance: number;
  paymentProgress: number;
  deadline: string;
}

// Mock data for development
const mockStudent: StudentProfileData = {
  id: "EDU-2023-045-KC",
  studentId: "EDU-2023-045-KC",
  firstName: "Mugisha",
  middleName: "Ivan",
  lastName: "Brian",
  fullName: "Mugisha Ivan Brian",
  photo:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA0CnWYOn8jgUsEOhUTX7qeTe9V1C0bEWnzP9LGgDmV9isuZqckxogBtA06czEVBCXtb4FHQFSCIxjsRJ0oDLM_1gbq8L72FBxdMZJqnY12IBgQxEk9qy6mT1EynTF8w-DYpnctJon298ne5QMe1UEuPIlOdD__r6bx71PWNeAV5rbJVe1wPGSTAvxKyJXhlGqJMCEHpuszOMeLCAPlz72rPiGcga82FNaeEkaZKXbI5V_VTuG1pxGB_Jq3ZRhiP1ppeLE77VQct5s",
  className: "Senior 4",
  streamName: "East Wing",
  term: 2,
  year: 2024,
  status: "active",
  guardian: {
    name: "Mrs. Sarah Namugisha",
    phone: "+256772456789",
  },
  totalFees: 1450000,
  amountPaid: 850000,
  balance: 600000,
  paymentProgress: 58,
  deadline: "15 Oct 2024",
};

const mockTransactions: StudentTransaction[] = [
  {
    id: "1",
    date: new Date("2024-09-12T14:45:00"),
    refId: "TX-8829-MO",
    channel: "momo_mtn",
    channelName: "MTN MoMo",
    amount: 450000,
    status: "cleared",
  },
  {
    id: "2",
    date: new Date("2024-08-05T10:15:00"),
    refId: "BNK-3341-ST",
    channel: "bank",
    channelName: "Stanbic Bank",
    amount: 400000,
    status: "cleared",
  },
  {
    id: "3",
    date: new Date("2024-07-20T16:30:00"),
    refId: "CSH-1022-DR",
    channel: "cash",
    channelName: "Direct Cash",
    amount: 100000,
    status: "reversed",
  },
];

// Convert Firebase Student to StudentProfileData
function studentToProfileData(student: Student): StudentProfileData {
  const totalFees = student.totalFees || 0;
  const amountPaid = student.amountPaid || 0;
  const balance = student.balance || totalFees - amountPaid;
  const paymentProgress =
    totalFees > 0 ? Math.round((amountPaid / totalFees) * 100) : 0;

  // Get current installment deadline
  const currentInstallmentProgress = student.installmentProgress?.find(
    (ip) => ip.status === "in_progress" || ip.status === "not_started",
  );
  const deadline = currentInstallmentProgress?.deadline
    ? new Date(
        (currentInstallmentProgress.deadline as any).toDate?.() ||
          currentInstallmentProgress.deadline,
      ).toLocaleDateString("en-UG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";

  return {
    id: student.id,
    studentId: student.studentId || student.id,
    firstName: student.firstName,
    middleName: student.middleName || "",
    lastName: student.lastName,
    fullName: [student.firstName, student.middleName, student.lastName]
      .filter(Boolean)
      .join(" "),
    photo: student.photo || null,
    className: student.className,
    streamName: student.streamName || "",
    term: student.term || 1,
    year:
      typeof student.academicYear === "string"
        ? parseInt(student.academicYear) || new Date().getFullYear()
        : new Date().getFullYear(),
    status: student.status || "active",
    guardian: {
      name: student.guardian?.name || "Not specified",
      phone: student.guardian?.phone || "",
    },
    totalFees,
    amountPaid,
    balance,
    paymentProgress,
    deadline,
  };
}

// Get channel display name
function getChannelDisplayName(channel: string): string {
  const channels: Record<string, string> = {
    momo_mtn: "MTN MoMo",
    momo_airtel: "Airtel Money",
    bank: "Bank Transfer",
    cash: "Cash",
    stellar: "Stellar USDC",
  };
  return channels[channel] || channel;
}

export interface UseStudentProfileOptions {
  useMockData?: boolean;
}

export interface UseStudentProfileReturn {
  student: StudentProfileData | null;
  transactions: StudentTransaction[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  isAuthenticated: boolean;
  authLoading: boolean;
}

export function useStudentProfile(
  studentId: string,
  options: UseStudentProfileOptions = {},
): UseStudentProfileReturn {
  const { useMockData = USE_MOCK_DATA } = options;
  const { user, loading: authLoading } = useAuth();

  const [student, setStudent] = useState<StudentProfileData | null>(null);
  const [transactions, setTransactions] = useState<StudentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudentProfile = useCallback(async () => {
    if (!studentId) {
      setError("Student ID is required");
      setIsLoading(false);
      return;
    }

    // Use mock data if enabled or no user
    if (useMockData || !user) {
      setStudent(mockStudent);
      setTransactions(mockTransactions);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch by document ID first, then by studentId field
      let fetchedStudent = await getStudentById(studentId);

      if (!fetchedStudent) {
        // Try fetching by studentId code (e.g., "EDU-2024-001-P7")
        fetchedStudent = await getStudentByStudentId(studentId);
      }

      if (!fetchedStudent) {
        setError("Student not found");
        setStudent(null);
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      // Convert to profile data format
      const profileData = studentToProfileData(fetchedStudent);
      setStudent(profileData);

      // Fetch student transactions
      // For now, we'll fetch from the payments collection
      // In a real implementation, you'd have a dedicated function
      try {
        const { db } = await import("@/lib/firebase");
        const { collection, query, where, orderBy, getDocs, limit } =
          await import("firebase/firestore");

        const paymentsQuery = query(
          collection(db, "payments"),
          where(
            "studentId",
            "==",
            fetchedStudent.studentId || fetchedStudent.id,
          ),
          orderBy("recordedAt", "desc"),
          limit(20),
        );

        const paymentsSnapshot = await getDocs(paymentsQuery);
        const studentTransactions: StudentTransaction[] = [];

        paymentsSnapshot.forEach((doc) => {
          const data = doc.data();
          studentTransactions.push({
            id: doc.id,
            date: data.recordedAt?.toDate() || new Date(),
            refId:
              data.transactionRef ||
              data.receiptNumber ||
              doc.id.substring(0, 12).toUpperCase(),
            channel: data.channel || "cash",
            channelName: getChannelDisplayName(data.channel),
            amount: data.amount || 0,
            status: data.status || "cleared",
          });
        });

        setTransactions(studentTransactions);
      } catch (txError) {
        console.error("Error fetching transactions:", txError);
        // Set empty transactions but don't fail the whole fetch
        setTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching student profile:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch student profile",
      );
      // Fall back to mock data on error
      setStudent(mockStudent);
      setTransactions(mockTransactions);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, useMockData, user]);

  useEffect(() => {
    if (!authLoading) {
      fetchStudentProfile();
    }
  }, [fetchStudentProfile, authLoading]);

  return {
    student,
    transactions,
    isLoading,
    error,
    refresh: fetchStudentProfile,
    isAuthenticated: !!user,
    authLoading,
  };
}

// Wrapper hook with Firebase auth context
export function useFirebaseStudentProfile(
  studentId: string,
): UseStudentProfileReturn {
  const { user, loading: authLoading } = useAuth();

  // Use mock data only if explicitly enabled via env variable
  // Don't use mock just because user is not loaded yet
  const result = useStudentProfile(studentId, {
    useMockData: USE_MOCK_DATA,
  });

  // Override authLoading to use the one from useAuth directly
  return {
    ...result,
    authLoading,
    isAuthenticated: !!user,
  };
}

export default useStudentProfile;
