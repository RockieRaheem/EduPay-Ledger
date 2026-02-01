/**
 * Students Firebase Service
 * Handles all student-related database operations for eBursar
 */

import {
  db,
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  subscribeToCollection,
  batchWrite,
  logAuditAction,
  COLLECTIONS,
  Timestamp,
} from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import type { Student } from "@/types/student";

// ============================================================================
// TYPES
// ============================================================================

export interface StudentFilters {
  schoolId: string;
  classId?: string;
  status?: "active" | "inactive" | "graduated" | "transferred";
  searchQuery?: string;
  hasArrears?: boolean;
  termId?: string;
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: DocumentData;
}

export interface StudentStats {
  total: number;
  active: number;
  withArrears: number;
  newThisMonth: number;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get a single student by ID
 */
export async function getStudent(studentId: string): Promise<Student | null> {
  return fetchDocument<Student>(COLLECTIONS.STUDENTS, studentId);
}

/**
 * Get all students for a school with optional filters
 */
export async function getStudents(
  filters: StudentFilters,
  pagination?: PaginationOptions,
): Promise<{ students: Student[]; lastDoc: DocumentData | null }> {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", filters.schoolId),
  ];

  if (filters.classId) {
    constraints.push(where("classId", "==", filters.classId));
  }

  if (filters.status) {
    constraints.push(where("status", "==", filters.status));
  }

  if (filters.hasArrears === true) {
    constraints.push(where("balance", ">", 0));
  }

  constraints.push(orderBy("lastName", "asc"));

  if (pagination?.pageSize) {
    constraints.push(limit(pagination.pageSize));
  }

  if (pagination?.lastDoc) {
    constraints.push(startAfter(pagination.lastDoc));
  }

  const students = await fetchCollection<Student>(
    COLLECTIONS.STUDENTS,
    constraints,
  );

  return {
    students,
    lastDoc: students.length > 0 ? students[students.length - 1] : null,
  };
}

/**
 * Create a new student
 */
export async function createStudent(
  student: Partial<Student>,
  userId: string,
): Promise<string> {
  const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newStudent = {
    ...student,
    id: studentId,
    balance: student.balance || 0,
    amountPaid: student.amountPaid || 0,
    status: student.status || "active",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await saveDocument(COLLECTIONS.STUDENTS, studentId, newStudent);

  await logAuditAction("CREATE", COLLECTIONS.STUDENTS, studentId, userId, {
    studentName: `${student.firstName} ${student.lastName}`,
  });

  return studentId;
}

/**
 * Update an existing student
 */
export async function updateStudent(
  studentId: string,
  updates: Partial<Student>,
  userId: string,
): Promise<void> {
  const currentStudent = await getStudent(studentId);

  await updateDocument(COLLECTIONS.STUDENTS, studentId, {
    ...updates,
    updatedAt: Timestamp.now(),
  });

  await logAuditAction("UPDATE", COLLECTIONS.STUDENTS, studentId, userId, {
    before: currentStudent,
    after: updates,
  });
}

/**
 * Delete a student (soft delete - set status to inactive)
 */
export async function deleteStudent(
  studentId: string,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.STUDENTS, studentId, {
    status: "inactive",
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await logAuditAction("DELETE", COLLECTIONS.STUDENTS, studentId, userId, {
    softDelete: true,
  });
}

/**
 * Permanently delete a student
 */
export async function permanentlyDeleteStudent(
  studentId: string,
  userId: string,
): Promise<void> {
  const student = await getStudent(studentId);

  await removeDocument(COLLECTIONS.STUDENTS, studentId);

  await logAuditAction(
    "PERMANENT_DELETE",
    COLLECTIONS.STUDENTS,
    studentId,
    userId,
    { studentData: student },
  );
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Import multiple students at once
 */
export async function importStudents(
  students: Partial<Student>[],
  schoolId: string,
  userId: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  const operations = students.map((student, index) => {
    const studentId = `STU-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`;
    return {
      type: "set" as const,
      collection: COLLECTIONS.STUDENTS,
      docId: studentId,
      data: {
        ...student,
        id: studentId,
        schoolId,
        balance: student.balance || 0,
        amountPaid: student.amountPaid || 0,
        status: student.status || "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    };
  });

  try {
    await batchWrite(operations);
    results.success = students.length;

    await logAuditAction(
      "BULK_IMPORT",
      COLLECTIONS.STUDENTS,
      schoolId,
      userId,
      { count: students.length },
    );
  } catch (error: any) {
    results.failed = students.length;
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Promote students to next class
 */
export async function promoteStudents(
  studentIds: string[],
  newClassId: string,
  newClassName: string,
  userId: string,
): Promise<void> {
  const operations = studentIds.map((id) => ({
    type: "update" as const,
    collection: COLLECTIONS.STUDENTS,
    docId: id,
    data: {
      classId: newClassId,
      className: newClassName,
      promotedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  }));

  await batchWrite(operations);

  await logAuditAction(
    "BULK_PROMOTE",
    COLLECTIONS.STUDENTS,
    "multiple",
    userId,
    { studentIds, newClassId, newClassName },
  );
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get student statistics for a school
 */
export async function getStudentStats(schoolId: string): Promise<StudentStats> {
  const studentsRef = collection(db, COLLECTIONS.STUDENTS);

  // Total students
  const totalQuery = query(studentsRef, where("schoolId", "==", schoolId));
  const totalSnapshot = await getCountFromServer(totalQuery);

  // Active students
  const activeQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
  );
  const activeSnapshot = await getCountFromServer(activeQuery);

  // Students with arrears
  const arrearsQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
  );
  const arrearsSnapshot = await getCountFromServer(arrearsQuery);

  // New this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newQuery = query(
    studentsRef,
    where("schoolId", "==", schoolId),
    where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
  );
  const newSnapshot = await getCountFromServer(newQuery);

  return {
    total: totalSnapshot.data().count,
    active: activeSnapshot.data().count,
    withArrears: arrearsSnapshot.data().count,
    newThisMonth: newSnapshot.data().count,
  };
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to real-time student updates
 */
export function subscribeToStudents(
  schoolId: string,
  onData: (students: Student[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
    orderBy("lastName", "asc"),
  ];

  return subscribeToCollection<Student>(
    COLLECTIONS.STUDENTS,
    constraints,
    onData,
    onError,
  );
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search students by name, ID, or student ID
 */
export async function searchStudents(
  schoolId: string,
  searchTerm: string,
  maxResults: number = 20,
): Promise<Student[]> {
  // Firebase doesn't support full-text search, so we fetch and filter
  // For production, consider using Algolia or Elasticsearch
  const searchLower = searchTerm.toLowerCase();

  const students = await fetchCollection<Student>(COLLECTIONS.STUDENTS, [
    where("schoolId", "==", schoolId),
    where("status", "==", "active"),
    limit(100), // Fetch more to filter
  ]);

  return students
    .filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const studentIdLower = (student.studentId || "").toLowerCase();
      const id = student.id.toLowerCase();

      return (
        fullName.includes(searchLower) ||
        studentIdLower.includes(searchLower) ||
        id.includes(searchLower)
      );
    })
    .slice(0, maxResults);
}

// ============================================================================
// FINANCIAL
// ============================================================================

/**
 * Update student balance after payment
 */
export async function updateStudentBalance(
  studentId: string,
  amount: number,
  type: "credit" | "debit",
  userId: string,
): Promise<void> {
  const student = await getStudent(studentId);
  if (!student) throw new Error("Student not found");

  const newBalance =
    type === "credit"
      ? student.balance - amount // Payment reduces balance
      : student.balance + amount; // Fee charge increases balance

  const newAmountPaid =
    type === "credit"
      ? student.amountPaid + amount
      : student.amountPaid - amount;

  await updateDocument(COLLECTIONS.STUDENTS, studentId, {
    balance: newBalance,
    amountPaid: newAmountPaid,
    lastPaymentDate:
      type === "credit" ? Timestamp.now() : student.lastPaymentDate,
    updatedAt: Timestamp.now(),
  });

  await logAuditAction(
    "BALANCE_UPDATE",
    COLLECTIONS.STUDENTS,
    studentId,
    userId,
    {
      previousBalance: student.balance,
      newBalance,
      amount,
      type,
    },
  );
}

/**
 * Get students with highest arrears
 */
export async function getStudentsWithHighestArrears(
  schoolId: string,
  count: number = 10,
): Promise<Student[]> {
  return fetchCollection<Student>(COLLECTIONS.STUDENTS, [
    where("schoolId", "==", schoolId),
    where("balance", ">", 0),
    orderBy("balance", "desc"),
    limit(count),
  ]);
}
