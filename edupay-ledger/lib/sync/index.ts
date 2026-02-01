/**
 * Sync Service
 * Handles bidirectional sync between local IndexedDB and Firebase
 */

import {
  db,
  dbHelpers,
  DBStudent,
  DBPayment,
  DBFeeStructure,
  DBAuditLog,
} from "../db";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db as firebaseDb } from "../firebase";

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";

export interface SyncResult {
  status: SyncStatus;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
  timestamp: string;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingChanges: number;
  isOnline: boolean;
}

class SyncService {
  private isOnline: boolean =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: ((state: SyncState) => void)[] = [];
  private schoolId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () =>
        this.handleOnlineStatusChange(true),
      );
      window.addEventListener("offline", () =>
        this.handleOnlineStatusChange(false),
      );
    }
  }

  // Initialize sync service with school ID
  initialize(schoolId: string) {
    this.schoolId = schoolId;
    this.startAutoSync();
  }

  // Handle online/offline status change
  private handleOnlineStatusChange(isOnline: boolean) {
    this.isOnline = isOnline;
    this.notifyListeners();

    if (isOnline) {
      // Trigger sync when coming online
      this.sync();
    }
  }

  // Subscribe to sync state changes
  subscribe(listener: (state: SyncState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Notify all listeners of state change
  private async notifyListeners() {
    const state = await this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  // Get current sync state
  async getState(): Promise<SyncState> {
    const pendingItems = await dbHelpers.getPendingSyncItems();
    const pendingChanges =
      pendingItems.students.length +
      pendingItems.payments.length +
      pendingItems.feeStructures.length;

    const lastSyncAt = localStorage.getItem("ebursar_last_sync");

    return {
      status: this.isOnline ? "idle" : "offline",
      lastSyncAt,
      pendingChanges,
      isOnline: this.isOnline,
    };
  }

  // Start automatic sync (every 5 minutes when online)
  startAutoSync(intervalMs: number = 5 * 60 * 1000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.sync();
      }
    }, intervalMs);
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync function
  async sync(): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        status: "offline",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["Device is offline"],
        timestamp: new Date().toISOString(),
      };
    }

    if (!this.schoolId) {
      return {
        status: "error",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["School ID not set. Call initialize() first."],
        timestamp: new Date().toISOString(),
      };
    }

    const result: SyncResult = {
      status: "syncing",
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    this.notifyListeners();

    try {
      // Upload local changes
      const uploadResult = await this.uploadChanges();
      result.uploaded = uploadResult.count;
      result.errors.push(...uploadResult.errors);

      // Download remote changes
      const downloadResult = await this.downloadChanges();
      result.downloaded = downloadResult.count;
      result.conflicts = downloadResult.conflicts;
      result.errors.push(...downloadResult.errors);

      // Update last sync time
      localStorage.setItem("ebursar_last_sync", result.timestamp);

      result.status = result.errors.length > 0 ? "error" : "success";
    } catch (error: any) {
      result.status = "error";
      result.errors.push(error.message || "Unknown sync error");
    }

    this.notifyListeners();
    return result;
  }

  // Upload local changes to Firebase
  private async uploadChanges(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    const pendingItems = await dbHelpers.getPendingSyncItems();

    // Upload students
    for (const student of pendingItems.students) {
      try {
        await this.uploadStudent(student);
        await dbHelpers.markAsSynced("students", [student.id]);
        count++;
      } catch (error: any) {
        errors.push(
          `Failed to sync student ${student.studentId}: ${error.message}`,
        );
      }
    }

    // Upload payments
    for (const payment of pendingItems.payments) {
      try {
        await this.uploadPayment(payment);
        await dbHelpers.markAsSynced("payments", [payment.id]);
        count++;
      } catch (error: any) {
        errors.push(
          `Failed to sync payment ${payment.receiptNumber}: ${error.message}`,
        );
      }
    }

    // Upload fee structures
    for (const feeStructure of pendingItems.feeStructures) {
      try {
        await this.uploadFeeStructure(feeStructure);
        await dbHelpers.markAsSynced("feeStructures", [feeStructure.id]);
        count++;
      } catch (error: any) {
        errors.push(`Failed to sync fee structure: ${error.message}`);
      }
    }

    // Upload audit logs
    for (const auditLog of pendingItems.auditLogs) {
      try {
        await this.uploadAuditLog(auditLog);
        await dbHelpers.markAsSynced("auditLogs", [auditLog.id]);
        count++;
      } catch (error: any) {
        // Audit logs are less critical, just log error
        console.error("Failed to sync audit log:", error);
      }
    }

    return { count, errors };
  }

  // Download remote changes from Firebase
  private async downloadChanges(): Promise<{
    count: number;
    conflicts: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let count = 0;
    let conflicts = 0;

    const lastSync = localStorage.getItem("ebursar_last_sync");
    const lastSyncTime = lastSync ? new Date(lastSync) : new Date(0);

    try {
      // Download students updated since last sync
      const studentsRef = collection(
        firebaseDb,
        `schools/${this.schoolId}/students`,
      );
      const studentsQuery = query(
        studentsRef,
        where("updatedAt", ">", Timestamp.fromDate(lastSyncTime)),
        orderBy("updatedAt", "desc"),
        limit(500),
      );

      const studentsSnapshot = await getDocs(studentsQuery);
      for (const docSnapshot of studentsSnapshot.docs) {
        const remoteStudent = docSnapshot.data() as DBStudent;
        const localStudent = await db.students.get(remoteStudent.id);

        if (!localStudent || localStudent.syncStatus === "synced") {
          // No local changes, safe to overwrite
          await db.students.put({
            ...remoteStudent,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
          count++;
        } else {
          // Local changes exist, mark as conflict
          await db.students.update(remoteStudent.id, {
            syncStatus: "conflict",
          });
          conflicts++;
        }
      }

      // Download payments updated since last sync
      const paymentsRef = collection(
        firebaseDb,
        `schools/${this.schoolId}/payments`,
      );
      const paymentsQuery = query(
        paymentsRef,
        where("updatedAt", ">", Timestamp.fromDate(lastSyncTime)),
        orderBy("updatedAt", "desc"),
        limit(500),
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);
      for (const docSnapshot of paymentsSnapshot.docs) {
        const remotePayment = docSnapshot.data() as DBPayment;
        const localPayment = await db.payments.get(remotePayment.id);

        if (!localPayment || localPayment.syncStatus === "synced") {
          await db.payments.put({
            ...remotePayment,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
          count++;
        } else {
          await db.payments.update(remotePayment.id, {
            syncStatus: "conflict",
          });
          conflicts++;
        }
      }
    } catch (error: any) {
      errors.push(`Download failed: ${error.message}`);
    }

    return { count, conflicts, errors };
  }

  // Upload individual records to Firebase
  private async uploadStudent(student: DBStudent) {
    const docRef = doc(
      firebaseDb,
      `schools/${this.schoolId}/students`,
      student.id,
    );
    await setDoc(docRef, {
      ...student,
      syncStatus: "synced",
      syncedAt: serverTimestamp(),
    });
  }

  private async uploadPayment(payment: DBPayment) {
    const docRef = doc(
      firebaseDb,
      `schools/${this.schoolId}/payments`,
      payment.id,
    );
    await setDoc(docRef, {
      ...payment,
      syncStatus: "synced",
      syncedAt: serverTimestamp(),
    });
  }

  private async uploadFeeStructure(feeStructure: DBFeeStructure) {
    const docRef = doc(
      firebaseDb,
      `schools/${this.schoolId}/feeStructures`,
      feeStructure.id,
    );
    await setDoc(docRef, {
      ...feeStructure,
      syncStatus: "synced",
    });
  }

  private async uploadAuditLog(auditLog: DBAuditLog) {
    const docRef = doc(
      firebaseDb,
      `schools/${this.schoolId}/auditLogs`,
      auditLog.id,
    );
    await setDoc(docRef, {
      ...auditLog,
      syncStatus: "synced",
    });
  }

  // Force full sync (downloads all data)
  async fullSync(): Promise<SyncResult> {
    if (!this.isOnline || !this.schoolId) {
      return {
        status: "error",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["Cannot perform full sync: offline or no school ID"],
        timestamp: new Date().toISOString(),
      };
    }

    // Clear last sync to force full download
    localStorage.removeItem("ebursar_last_sync");
    return this.sync();
  }

  // Resolve conflict by keeping local version
  async resolveConflictKeepLocal(table: string, id: string) {
    switch (table) {
      case "students":
        const student = await db.students.get(id);
        if (student) {
          await this.uploadStudent({ ...student, syncStatus: "pending" });
          await db.students.update(id, {
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
        }
        break;
      case "payments":
        const payment = await db.payments.get(id);
        if (payment) {
          await this.uploadPayment({ ...payment, syncStatus: "pending" });
          await db.payments.update(id, {
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
        }
        break;
    }
  }

  // Resolve conflict by keeping remote version
  async resolveConflictKeepRemote(table: string, id: string) {
    if (!this.schoolId) return;

    switch (table) {
      case "students":
        const studentDoc = await getDocs(
          query(
            collection(firebaseDb, `schools/${this.schoolId}/students`),
            where("id", "==", id),
          ),
        );
        if (!studentDoc.empty) {
          const remoteStudent = studentDoc.docs[0].data() as DBStudent;
          await db.students.put({
            ...remoteStudent,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
        }
        break;
      case "payments":
        const paymentDoc = await getDocs(
          query(
            collection(firebaseDb, `schools/${this.schoolId}/payments`),
            where("id", "==", id),
          ),
        );
        if (!paymentDoc.empty) {
          const remotePayment = paymentDoc.docs[0].data() as DBPayment;
          await db.payments.put({
            ...remotePayment,
            syncStatus: "synced",
            syncedAt: new Date().toISOString(),
          });
        }
        break;
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;
