/**
 * Student Service
 *
 * Handles student CRUD operations and fee management
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
} from "firebase/firestore";
import { db, initializeFirebase, COLLECTIONS } from "@/lib/firebase";
import {
  Student,
  Guardian,
  InstallmentProgress,
  PaymentStatus,
} from "@/types/student";
import { FeeStructure, InstallmentRule } from "@/types/school";
import { generateStudentId } from "@/lib/utils";

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: Date;
  gender: "male" | "female";
  photo?: string;
  schoolId: string;
  classId: string;
  streamId?: string;
  className: string;
  streamName?: string;
  academicYear: string;
  term: 1 | 2 | 3;
  guardian: Guardian;
  feeStructureId: string;
}

export interface StudentListResult {
  students: Student[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export interface StudentFilters {
  classId?: string;
  streamId?: string;
  paymentStatus?: PaymentStatus;
  searchTerm?: string;
}

/**
 * Creates a new student with proper fee structure setup
 */
export async function createStudent(
  input: CreateStudentInput,
): Promise<{ success: boolean; student?: Student; error?: string }> {
  initializeFirebase();

  try {
    // Get fee structure to set up installments
    const feeStructureDoc = await getDoc(
      doc(db, COLLECTIONS.FEE_STRUCTURES, input.feeStructureId),
    );

    if (!feeStructureDoc.exists()) {
      return { success: false, error: "Fee structure not found" };
    }

    const feeStructure = feeStructureDoc.data() as FeeStructure;

    // Generate student ID
    const studentId = generateStudentId(input.schoolId, input.className);
    const now = Timestamp.now();

    // Create installment progress from fee structure rules
    const installmentProgress: InstallmentProgress[] =
      feeStructure.installmentRules
        .sort((a, b) => a.order - b.order)
        .map((rule, index) => ({
          installmentId: rule.id,
          installmentOrder: rule.order,
          installmentName: rule.name,
          amountDue: rule.amount,
          amountPaid: 0,
          status: "not_started" as const,
          deadline: rule.deadline,
          isUnlocked: index === 0, // Only first installment is unlocked initially
        }));

    const student: Student = {
      id: "", // Will be set after creation
      studentId,
      firstName: input.firstName,
      lastName: input.lastName,
      middleName: input.middleName,
      dateOfBirth: input.dateOfBirth
        ? Timestamp.fromDate(input.dateOfBirth)
        : undefined,
      gender: input.gender,
      photo: input.photo,
      schoolId: input.schoolId,
      classId: input.classId,
      streamId: input.streamId,
      className: input.className,
      streamName: input.streamName,
      academicYear: input.academicYear,
      term: input.term,
      enrollmentDate: now,
      status: "active",
      guardian: input.guardian,
      feeStructureId: input.feeStructureId,
      totalFees: feeStructure.totalAmount,
      amountPaid: 0,
      balance: feeStructure.totalAmount,
      currentInstallment: 1,
      installmentProgress,
      paymentStatus: "no_payment",
      createdAt: now,
      updatedAt: now,
    };

    // Create document
    const studentRef = doc(collection(db, COLLECTIONS.STUDENTS));
    student.id = studentRef.id;

    await setDoc(studentRef, student);

    return { success: true, student };
  } catch (error: any) {
    console.error("Failed to create student:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets a student by ID
 */
export async function getStudentById(
  studentId: string,
): Promise<Student | null> {
  initializeFirebase();

  const studentDoc = await getDoc(doc(db, COLLECTIONS.STUDENTS, studentId));

  if (!studentDoc.exists()) return null;

  return { id: studentDoc.id, ...studentDoc.data() } as Student;
}

/**
 * Gets a student by their unique student ID (e.g., "EDU-2024-001-P7")
 */
export async function getStudentByStudentId(
  studentIdCode: string,
): Promise<Student | null> {
  initializeFirebase();

  const q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("studentId", "==", studentIdCode),
    limit(1),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Student;
}

/**
 * Lists students with pagination and filters
 */
export async function listStudents(
  schoolId: string,
  filters?: StudentFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot,
): Promise<StudentListResult> {
  initializeFirebase();

  let q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
    orderBy("lastName"),
    limit(pageSize + 1),
  );

  if (filters?.classId) {
    q = query(q, where("classId", "==", filters.classId));
  }

  if (filters?.streamId) {
    q = query(q, where("streamId", "==", filters.streamId));
  }

  if (filters?.paymentStatus) {
    q = query(q, where("paymentStatus", "==", filters.paymentStatus));
  }

  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }

  const snapshot = await getDocs(q);
  const students = snapshot.docs.slice(0, pageSize).map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as Student,
  );

  const hasMore = snapshot.docs.length > pageSize;
  const newLastDoc = hasMore ? snapshot.docs[pageSize - 1] : null;

  return {
    students,
    lastDoc: newLastDoc,
    hasMore,
  };
}

/**
 * Gets students with overdue payments
 */
export async function getStudentsWithArrears(
  schoolId: string,
): Promise<Student[]> {
  initializeFirebase();

  const q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("paymentStatus", "==", "overdue"),
    where("status", "==", "active"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as Student,
  );
}

/**
 * Gets students by payment status
 */
export async function getStudentsByPaymentStatus(
  schoolId: string,
  status: PaymentStatus,
): Promise<Student[]> {
  initializeFirebase();

  const q = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("paymentStatus", "==", status),
    where("status", "==", "active"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as Student,
  );
}

/**
 * Updates student's installment deadlines status
 * Should be called daily to mark overdue installments
 */
export async function updateInstallmentDeadlineStatus(
  studentId: string,
): Promise<void> {
  initializeFirebase();

  const studentDoc = await getDoc(doc(db, COLLECTIONS.STUDENTS, studentId));

  if (!studentDoc.exists()) return;

  const student = studentDoc.data() as Student;
  const now = new Date();
  let hasOverdue = false;

  const updatedInstallments = (student.installmentProgress || []).map(
    (installment) => {
      if (installment.status === "completed") return installment;

      const deadline = installment.deadline.toDate();

      if (deadline < now && installment.status !== "overdue") {
        hasOverdue = true;
        return { ...installment, status: "overdue" as const };
      }

      return installment;
    },
  );

  if (hasOverdue) {
    await updateDoc(doc(db, COLLECTIONS.STUDENTS, studentId), {
      installmentProgress: updatedInstallments,
      paymentStatus: "overdue",
      updatedAt: Timestamp.now(),
    });
  }
}

/**
 * Search students by name, ID, or guardian phone
 */
export async function searchStudents(
  schoolId: string,
  searchTerm: string,
): Promise<Student[]> {
  initializeFirebase();

  // Note: Firestore doesn't support full-text search
  // In production, use Algolia, Elasticsearch, or Firebase Extensions
  // This is a basic implementation that searches by exact studentId

  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Try exact studentId match first
  const idQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("studentId", "==", searchTerm.toUpperCase()),
    limit(10),
  );

  const idSnapshot = await getDocs(idQuery);

  if (!idSnapshot.empty) {
    return idSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as Student,
    );
  }

  // Search by guardian phone
  const phoneQuery = query(
    collection(db, COLLECTIONS.STUDENTS),
    where("schoolId", "==", schoolId),
    where("guardian.phone", "==", normalizedSearch),
    limit(10),
  );

  const phoneSnapshot = await getDocs(phoneQuery);

  return phoneSnapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as Student,
  );
}
