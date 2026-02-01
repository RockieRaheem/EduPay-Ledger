/**
 * Local Database using IndexedDB via Dexie.js
 * Provides offline-first data storage for the application
 *
 * NOTE: Install dexie before using: npm install dexie
 */

// @ts-nocheck - Dexie types will be available after npm install
import Dexie, { Table } from "dexie";

// Type definitions for database tables
export interface DBStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth?: string;
  gender: "male" | "female";
  className: string;
  streamName?: string;
  admissionDate: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  address?: string;
  status: "active" | "inactive" | "graduated" | "transferred";
  totalFees: number;
  paidAmount: number;
  balance: number;
  scholarshipAmount?: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
  syncedAt?: string;
}

export interface DBPayment {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: "cash" | "mtn_momo" | "airtel_money" | "bank_transfer";
  transactionRef?: string;
  paymentDate: string;
  termId: string;
  academicYear: string;
  recordedBy: string;
  notes?: string;
  status: "completed" | "pending" | "cancelled" | "refunded";
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
  syncedAt?: string;
}

export interface DBFeeStructure {
  id: string;
  className: string;
  termId: string;
  academicYear: string;
  tuitionFee: number;
  otherFees: { name: string; amount: number }[];
  totalFee: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface DBInstallmentRule {
  id: string;
  name: string;
  termId: string;
  academicYear: string;
  installments: {
    number: number;
    percentage: number;
    dueDate: string;
    description: string;
  }[];
  minimumPayment: number;
  gracePeriodDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface DBSchool {
  id: string;
  name: string;
  code: string;
  type: "primary" | "secondary" | "mixed";
  district: string;
  subcounty: string;
  address: string;
  phone: string;
  email?: string;
  logo?: string;
  currentTerm: string;
  currentYear: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface DBUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "bursar" | "teacher";
  schoolId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: "synced" | "pending" | "conflict";
}

export interface DBAuditLog {
  id: string;
  action: "create" | "update" | "delete" | "login" | "logout" | "sync";
  entity: "student" | "payment" | "fee_structure" | "user" | "school";
  entityId: string;
  userId: string;
  userName: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
  syncStatus: "synced" | "pending";
}

export interface DBSyncQueue {
  id: string;
  operation: "create" | "update" | "delete";
  table: string;
  recordId: string;
  data: any;
  attempts: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

// Database class
class EBursarDatabase extends Dexie {
  students!: Table<DBStudent>;
  payments!: Table<DBPayment>;
  feeStructures!: Table<DBFeeStructure>;
  installmentRules!: Table<DBInstallmentRule>;
  schools!: Table<DBSchool>;
  users!: Table<DBUser>;
  auditLogs!: Table<DBAuditLog>;
  syncQueue!: Table<DBSyncQueue>;

  constructor() {
    super("eBursar");

    // Define database schema
    this.version(1).stores({
      students:
        "id, studentId, className, status, syncStatus, guardianPhone, [className+status]",
      payments:
        "id, receiptNumber, studentId, paymentDate, termId, syncStatus, [studentId+termId]",
      feeStructures:
        "id, className, termId, academicYear, syncStatus, [className+termId+academicYear]",
      installmentRules: "id, termId, academicYear, isActive, syncStatus",
      schools: "id, code, syncStatus",
      users: "id, email, role, schoolId, syncStatus",
      auditLogs: "id, action, entity, entityId, userId, timestamp, syncStatus",
      syncQueue: "id, table, recordId, createdAt",
    });
  }
}

// Create database instance
export const db = new EBursarDatabase();

// Helper functions for common operations
export const dbHelpers = {
  // Generate unique ID
  generateId: (prefix: string = "") => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return prefix
      ? `${prefix}-${timestamp}${random}`.toUpperCase()
      : `${timestamp}${random}`.toUpperCase();
  },

  // Add to sync queue
  async addToSyncQueue(
    operation: DBSyncQueue["operation"],
    table: string,
    recordId: string,
    data: any,
  ) {
    await db.syncQueue.add({
      id: this.generateId("SQ"),
      operation,
      table,
      recordId,
      data,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
  },

  // Log audit action
  async logAudit(
    action: DBAuditLog["action"],
    entity: DBAuditLog["entity"],
    entityId: string,
    userId: string,
    userName: string,
    details: string,
  ) {
    await db.auditLogs.add({
      id: this.generateId("AL"),
      action,
      entity,
      entityId,
      userId,
      userName,
      details,
      timestamp: new Date().toISOString(),
      syncStatus: "pending",
    });
  },

  // Get pending sync items
  async getPendingSyncItems() {
    const [students, payments, feeStructures, auditLogs] = await Promise.all([
      db.students.where("syncStatus").equals("pending").toArray(),
      db.payments.where("syncStatus").equals("pending").toArray(),
      db.feeStructures.where("syncStatus").equals("pending").toArray(),
      db.auditLogs.where("syncStatus").equals("pending").toArray(),
    ]);
    return { students, payments, feeStructures, auditLogs };
  },

  // Mark records as synced
  async markAsSynced(table: string, ids: string[]) {
    const now = new Date().toISOString();
    const updates = ids.map((id) => ({
      id,
      syncStatus: "synced" as const,
      syncedAt: now,
    }));

    switch (table) {
      case "students":
        await Promise.all(
          updates.map((u) =>
            db.students.update(u.id, {
              syncStatus: u.syncStatus,
              syncedAt: u.syncedAt,
            }),
          ),
        );
        break;
      case "payments":
        await Promise.all(
          updates.map((u) =>
            db.payments.update(u.id, {
              syncStatus: u.syncStatus,
              syncedAt: u.syncedAt,
            }),
          ),
        );
        break;
      case "feeStructures":
        await Promise.all(
          updates.map((u) =>
            db.feeStructures.update(u.id, { syncStatus: u.syncStatus }),
          ),
        );
        break;
      case "auditLogs":
        await Promise.all(
          updates.map((u) =>
            db.auditLogs.update(u.id, { syncStatus: u.syncStatus }),
          ),
        );
        break;
    }
  },

  // Calculate student balance
  async calculateStudentBalance(studentId: string) {
    const student = await db.students.get(studentId);
    if (!student) return null;

    const payments = await db.payments
      .where("studentId")
      .equals(studentId)
      .and((p) => p.status === "completed")
      .toArray();

    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = student.totalFees - paidAmount;

    await db.students.update(studentId, {
      paidAmount,
      balance,
      updatedAt: new Date().toISOString(),
    });

    return { totalFees: student.totalFees, paidAmount, balance };
  },

  // Get dashboard stats
  async getDashboardStats() {
    const [students, payments, today] = await Promise.all([
      db.students.where("status").equals("active").toArray(),
      db.payments.where("status").equals("completed").toArray(),
      new Date().toISOString().split("T")[0],
    ]);

    const todayPayments = payments.filter((p) =>
      p.paymentDate.startsWith(today),
    );
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const todayCollected = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalOutstanding = students.reduce((sum, s) => sum + s.balance, 0);

    return {
      totalStudents: students.length,
      totalCollected,
      totalOutstanding,
      todayCollected,
      todayTransactions: todayPayments.length,
      collectionRate:
        students.length > 0
          ? Math.round(
              (totalCollected /
                students.reduce((sum, s) => sum + s.totalFees, 0)) *
                100,
            )
          : 0,
    };
  },

  // Search students
  async searchStudents(
    query: string,
    filters?: { className?: string; status?: string },
  ) {
    let collection = db.students.toCollection();

    if (filters?.className) {
      collection = db.students.where("className").equals(filters.className);
    }

    let results = await collection.toArray();

    if (filters?.status) {
      results = results.filter((s) => s.status === filters.status);
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (s) =>
          s.firstName.toLowerCase().includes(lowerQuery) ||
          s.lastName.toLowerCase().includes(lowerQuery) ||
          s.studentId.toLowerCase().includes(lowerQuery) ||
          s.guardianPhone.includes(query),
      );
    }

    return results;
  },

  // Get arrears list
  async getArrearsStudents(minBalance: number = 0) {
    const students = await db.students
      .where("status")
      .equals("active")
      .and((s) => s.balance > minBalance)
      .toArray();

    return students
      .map((s) => ({
        ...s,
        severity: this.getArrearsSeverity(s.balance, s.totalFees),
      }))
      .sort((a, b) => b.balance - a.balance);
  },

  // Calculate arrears severity
  getArrearsSeverity(
    balance: number,
    totalFees: number,
  ): "low" | "medium" | "high" | "critical" {
    const percentage = (balance / totalFees) * 100;
    if (percentage >= 75) return "critical";
    if (percentage >= 50) return "high";
    if (percentage >= 25) return "medium";
    return "low";
  },

  // Export data to JSON
  async exportData() {
    const [students, payments, feeStructures, schools] = await Promise.all([
      db.students.toArray(),
      db.payments.toArray(),
      db.feeStructures.toArray(),
      db.schools.toArray(),
    ]);

    return {
      exportDate: new Date().toISOString(),
      version: "1.0.0",
      data: { students, payments, feeStructures, schools },
    };
  },

  // Import data from JSON
  async importData(data: any) {
    const { students, payments, feeStructures, schools } = data.data;

    await db.transaction(
      "rw",
      [db.students, db.payments, db.feeStructures, db.schools],
      async () => {
        if (students?.length) await db.students.bulkPut(students);
        if (payments?.length) await db.payments.bulkPut(payments);
        if (feeStructures?.length)
          await db.feeStructures.bulkPut(feeStructures);
        if (schools?.length) await db.schools.bulkPut(schools);
      },
    );
  },

  // Clear all data (for testing or reset)
  async clearAllData() {
    await Promise.all([
      db.students.clear(),
      db.payments.clear(),
      db.feeStructures.clear(),
      db.installmentRules.clear(),
      db.schools.clear(),
      db.users.clear(),
      db.auditLogs.clear(),
      db.syncQueue.clear(),
    ]);
  },
};

export default db;
