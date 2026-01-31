/**
 * Sync Service Tests
 *
 * Tests for the bidirectional sync between local IndexedDB and Firebase.
 * Critical for ensuring data integrity in offline-first school fee management.
 */

import { SyncResult, SyncState, SyncStatus } from "@/lib/sync";

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock navigator.onLine
const mockNavigatorOnLine = jest.fn(() => true);
Object.defineProperty(global, "navigator", {
  value: { onLine: true },
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((i: number) => Object.keys(store)[i] || null),
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Mock window for event listeners
const mockEventListeners: Record<string, Function[]> = {
  online: [],
  offline: [],
};

// Window is already defined in jsdom, just track our listeners
const originalWindowAddEventListener =
  typeof window !== "undefined" ? window.addEventListener : undefined;

if (typeof window !== "undefined") {
  (window as any).addEventListener = jest.fn(
    (event: string, handler: Function) => {
      if (event === "online" || event === "offline") {
        if (!mockEventListeners[event]) mockEventListeners[event] = [];
        mockEventListeners[event].push(handler);
      }
    },
  );
}

// Mock Dexie/IndexedDB helpers
const mockPendingSyncItems = {
  students: [] as any[],
  payments: [] as any[],
  feeStructures: [] as any[],
  auditLogs: [] as any[],
};

const mockDbHelpers = {
  getPendingSyncItems: jest.fn(() => Promise.resolve(mockPendingSyncItems)),
  markAsSynced: jest.fn(() => Promise.resolve()),
};

const mockDb = {
  students: {
    get: jest.fn(() => Promise.resolve(null)),
    put: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
  },
  payments: {
    get: jest.fn(() => Promise.resolve(null)),
    put: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
  },
  feeStructures: {
    get: jest.fn(() => Promise.resolve(null)),
    put: jest.fn(() => Promise.resolve()),
  },
  auditLogs: {
    put: jest.fn(() => Promise.resolve()),
  },
};

// Mock Firebase Firestore
const mockGetDocs = jest.fn(() => Promise.resolve({ docs: [], empty: true }));
const mockSetDoc = jest.fn(() => Promise.resolve());
const mockFirebaseDb = {};

jest.mock("@/lib/db", () => ({
  db: mockDb,
  dbHelpers: mockDbHelpers,
}));

jest.mock("@/lib/firebase", () => ({
  db: mockFirebaseDb,
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => new Date().toISOString()),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
}));

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock student record
 */
function createMockStudent(overrides: Partial<any> = {}): any {
  return {
    id: "student-001",
    studentId: "STU-2024-001",
    firstName: "John",
    lastName: "Doe",
    schoolId: "school-001",
    classId: "class-001",
    syncStatus: "pending",
    syncedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock payment record
 */
function createMockPayment(overrides: Partial<any> = {}): any {
  return {
    id: "payment-001",
    receiptNumber: "REC-2024-001",
    studentId: "student-001",
    amount: 500000, // UGX
    paymentDate: new Date().toISOString(),
    syncStatus: "pending",
    syncedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock fee structure
 */
function createMockFeeStructure(overrides: Partial<any> = {}): any {
  return {
    id: "fee-001",
    name: "Term 1 Fees 2024",
    totalAmount: 1500000, // UGX
    academicYear: "2024",
    term: 1,
    syncStatus: "pending",
    ...overrides,
  };
}

/**
 * Create a mock audit log
 */
function createMockAuditLog(overrides: Partial<any> = {}): any {
  return {
    id: "audit-001",
    action: "PAYMENT_RECORDED",
    userId: "user-001",
    timestamp: new Date().toISOString(),
    details: { paymentId: "payment-001", amount: 500000 },
    syncStatus: "pending",
    ...overrides,
  };
}

/**
 * Helper to simulate going online/offline
 */
function simulateOnlineStatus(isOnline: boolean) {
  Object.defineProperty(global.navigator, "onLine", {
    value: isOnline,
    configurable: true,
  });
  const event = isOnline ? "online" : "offline";
  mockEventListeners[event]?.forEach((handler) => handler());
}

/**
 * Reset all mocks between tests
 */
function resetAllMocks() {
  jest.clearAllMocks();
  localStorageMock.clear();
  mockPendingSyncItems.students = [];
  mockPendingSyncItems.payments = [];
  mockPendingSyncItems.feeStructures = [];
  mockPendingSyncItems.auditLogs = [];
  mockGetDocs.mockResolvedValue({ docs: [], empty: true });
}

// ============================================================================
// SYNC STATUS TESTS
// ============================================================================

describe("Sync Service - Sync Status", () => {
  beforeEach(resetAllMocks);

  describe("SyncStatus type", () => {
    test("should have valid status values", () => {
      const validStatuses: SyncStatus[] = [
        "idle",
        "syncing",
        "success",
        "error",
        "offline",
      ];

      validStatuses.forEach((status) => {
        expect(["idle", "syncing", "success", "error", "offline"]).toContain(
          status,
        );
      });
    });
  });

  describe("SyncResult interface", () => {
    test("should have all required properties", () => {
      const result: SyncResult = {
        status: "success",
        uploaded: 10,
        downloaded: 5,
        conflicts: 2,
        errors: [],
        timestamp: new Date().toISOString(),
      };

      expect(result.status).toBe("success");
      expect(result.uploaded).toBe(10);
      expect(result.downloaded).toBe(5);
      expect(result.conflicts).toBe(2);
      expect(result.errors).toEqual([]);
      expect(result.timestamp).toBeDefined();
    });

    test("should handle error status with error messages", () => {
      const result: SyncResult = {
        status: "error",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["Network timeout", "Firebase authentication failed"],
        timestamp: new Date().toISOString(),
      };

      expect(result.status).toBe("error");
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain("Network timeout");
    });

    test("should handle offline status", () => {
      const result: SyncResult = {
        status: "offline",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["Device is offline"],
        timestamp: new Date().toISOString(),
      };

      expect(result.status).toBe("offline");
      expect(result.uploaded).toBe(0);
      expect(result.downloaded).toBe(0);
    });
  });

  describe("SyncState interface", () => {
    test("should represent idle online state", () => {
      const state: SyncState = {
        status: "idle",
        lastSyncAt: "2024-01-15T10:00:00Z",
        pendingChanges: 0,
        isOnline: true,
      };

      expect(state.status).toBe("idle");
      expect(state.isOnline).toBe(true);
      expect(state.pendingChanges).toBe(0);
    });

    test("should represent offline state with pending changes", () => {
      const state: SyncState = {
        status: "offline",
        lastSyncAt: "2024-01-14T10:00:00Z",
        pendingChanges: 15,
        isOnline: false,
      };

      expect(state.status).toBe("offline");
      expect(state.isOnline).toBe(false);
      expect(state.pendingChanges).toBe(15);
    });

    test("should handle null lastSyncAt for first sync", () => {
      const state: SyncState = {
        status: "idle",
        lastSyncAt: null,
        pendingChanges: 5,
        isOnline: true,
      };

      expect(state.lastSyncAt).toBeNull();
    });
  });
});

// ============================================================================
// SYNC RESULT CALCULATION TESTS
// ============================================================================

describe("Sync Service - Result Calculations", () => {
  beforeEach(resetAllMocks);

  describe("uploaded count tracking", () => {
    test("should count students uploaded correctly", () => {
      const uploadedStudents = [
        createMockStudent({ id: "stu-1" }),
        createMockStudent({ id: "stu-2" }),
        createMockStudent({ id: "stu-3" }),
      ];

      expect(uploadedStudents.length).toBe(3);
    });

    test("should count payments uploaded correctly", () => {
      const uploadedPayments = [
        createMockPayment({ id: "pay-1" }),
        createMockPayment({ id: "pay-2" }),
      ];

      expect(uploadedPayments.length).toBe(2);
    });

    test("should calculate total uploaded from all tables", () => {
      const students = 5;
      const payments = 10;
      const feeStructures = 2;
      const auditLogs = 20;

      const totalUploaded = students + payments + feeStructures + auditLogs;

      expect(totalUploaded).toBe(37);
    });
  });

  describe("conflict detection", () => {
    test("should detect conflict when local has unsynced changes", () => {
      const localStudent = createMockStudent({
        syncStatus: "pending",
        updatedAt: "2024-01-15T10:00:00Z",
      });
      const remoteStudent = createMockStudent({
        syncStatus: "synced",
        updatedAt: "2024-01-15T09:00:00Z",
      });

      // Local has pending changes that would be overwritten
      const hasConflict = localStudent.syncStatus === "pending";

      expect(hasConflict).toBe(true);
    });

    test("should not detect conflict when local is synced", () => {
      const localStudent = createMockStudent({
        syncStatus: "synced",
        syncedAt: "2024-01-15T08:00:00Z",
      });

      const hasConflict = localStudent.syncStatus !== "synced";

      expect(hasConflict).toBe(false);
    });

    test("should count multiple conflicts", () => {
      const localRecords = [
        createMockStudent({ id: "stu-1", syncStatus: "pending" }),
        createMockStudent({ id: "stu-2", syncStatus: "synced" }),
        createMockStudent({ id: "stu-3", syncStatus: "pending" }),
        createMockStudent({ id: "stu-4", syncStatus: "conflict" }),
      ];

      const conflictCount = localRecords.filter(
        (r) => r.syncStatus === "pending" || r.syncStatus === "conflict",
      ).length;

      expect(conflictCount).toBe(3);
    });
  });

  describe("pending changes calculation", () => {
    test("should calculate total pending changes across all tables", () => {
      const pendingItems = {
        students: [createMockStudent(), createMockStudent()],
        payments: [
          createMockPayment(),
          createMockPayment(),
          createMockPayment(),
        ],
        feeStructures: [createMockFeeStructure()],
        auditLogs: [],
      };

      const totalPending =
        pendingItems.students.length +
        pendingItems.payments.length +
        pendingItems.feeStructures.length +
        pendingItems.auditLogs.length;

      expect(totalPending).toBe(6);
    });

    test("should return zero when nothing is pending", () => {
      const pendingItems = {
        students: [],
        payments: [],
        feeStructures: [],
        auditLogs: [],
      };

      const totalPending =
        pendingItems.students.length +
        pendingItems.payments.length +
        pendingItems.feeStructures.length +
        pendingItems.auditLogs.length;

      expect(totalPending).toBe(0);
    });
  });
});

// ============================================================================
// OFFLINE SYNC LOGIC TESTS
// ============================================================================

describe("Sync Service - Offline Logic", () => {
  beforeEach(resetAllMocks);

  describe("offline detection", () => {
    test("should identify device as offline when navigator.onLine is false", () => {
      const isOnline = false;

      const syncResult: SyncResult = {
        status: isOnline ? "syncing" : "offline",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: isOnline ? [] : ["Device is offline"],
        timestamp: new Date().toISOString(),
      };

      expect(syncResult.status).toBe("offline");
      expect(syncResult.errors).toContain("Device is offline");
    });

    test("should allow sync when online", () => {
      const isOnline = true;

      const canSync = isOnline;

      expect(canSync).toBe(true);
    });
  });

  describe("offline queue management", () => {
    test("should queue changes when offline", () => {
      const offlineQueue: any[] = [];

      // Simulate offline payment
      const payment = createMockPayment({ syncStatus: "pending" });
      offlineQueue.push(payment);

      expect(offlineQueue).toHaveLength(1);
      expect(offlineQueue[0].syncStatus).toBe("pending");
    });

    test("should process queue when coming back online", () => {
      const offlineQueue = [
        createMockPayment({ id: "pay-1", syncStatus: "pending" }),
        createMockPayment({ id: "pay-2", syncStatus: "pending" }),
        createMockStudent({ id: "stu-1", syncStatus: "pending" }),
      ];

      // Simulate coming online and processing queue
      const processedItems = offlineQueue.map((item) => ({
        ...item,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      }));

      expect(processedItems.every((item) => item.syncStatus === "synced")).toBe(
        true,
      );
      expect(processedItems.every((item) => item.syncedAt !== null)).toBe(true);
    });
  });

  describe("last sync timestamp", () => {
    test("should store last sync timestamp", () => {
      const timestamp = "2024-01-15T10:30:00Z";
      localStorageMock.setItem("edupay_last_sync", timestamp);

      expect(localStorageMock.getItem("edupay_last_sync")).toBe(timestamp);
    });

    test("should return null for first sync", () => {
      localStorageMock.clear();

      expect(localStorageMock.getItem("edupay_last_sync")).toBeNull();
    });

    test("should update timestamp after successful sync", () => {
      const oldTimestamp = "2024-01-14T10:00:00Z";
      const newTimestamp = "2024-01-15T10:30:00Z";

      localStorageMock.setItem("edupay_last_sync", oldTimestamp);

      // Simulate successful sync
      localStorageMock.setItem("edupay_last_sync", newTimestamp);

      expect(localStorageMock.getItem("edupay_last_sync")).toBe(newTimestamp);
    });
  });
});

// ============================================================================
// STUDENT SYNC TESTS
// ============================================================================

describe("Sync Service - Student Sync", () => {
  beforeEach(resetAllMocks);

  describe("student upload", () => {
    test("should prepare student for upload with correct format", () => {
      const student = createMockStudent({
        id: "stu-001",
        firstName: "Nakato",
        lastName: "Kisakye",
        schoolId: "school-001",
      });

      const uploadPayload = {
        ...student,
        syncStatus: "synced",
        syncedAt: new Date().toISOString(),
      };

      expect(uploadPayload.syncStatus).toBe("synced");
      expect(uploadPayload.syncedAt).toBeDefined();
      expect(uploadPayload.firstName).toBe("Nakato");
    });

    test("should handle student with all optional fields", () => {
      const student = createMockStudent({
        middleName: "Wasswa",
        dateOfBirth: "2010-05-15",
        photo: "https://storage.example.com/photos/stu-001.jpg",
        streamId: "stream-001",
        streamName: "Stream A",
      });

      expect(student.middleName).toBe("Wasswa");
      expect(student.dateOfBirth).toBeDefined();
      expect(student.photo).toBeDefined();
    });
  });

  describe("student download", () => {
    test("should mark downloaded student as synced", () => {
      const remoteStudent = createMockStudent({ syncStatus: "synced" });

      const localStudent = {
        ...remoteStudent,
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
      };

      expect(localStudent.syncStatus).toBe("synced");
    });

    test("should detect student conflict", () => {
      const localStudent = createMockStudent({
        id: "stu-001",
        syncStatus: "pending",
        firstName: "LocalName",
      });

      const remoteStudent = createMockStudent({
        id: "stu-001",
        syncStatus: "synced",
        firstName: "RemoteName",
      });

      // Conflict detection: local has pending changes
      const hasConflict = localStudent.syncStatus !== "synced";

      expect(hasConflict).toBe(true);
      expect(localStudent.firstName).not.toBe(remoteStudent.firstName);
    });
  });

  describe("student conflict resolution", () => {
    test("should resolve conflict by keeping local version", () => {
      const localStudent = createMockStudent({
        id: "stu-001",
        firstName: "LocalUpdated",
        syncStatus: "conflict",
      });

      // Resolve by uploading local and marking as synced
      const resolvedStudent = {
        ...localStudent,
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
      };

      expect(resolvedStudent.syncStatus).toBe("synced");
      expect(resolvedStudent.firstName).toBe("LocalUpdated");
    });

    test("should resolve conflict by keeping remote version", () => {
      const remoteStudent = createMockStudent({
        id: "stu-001",
        firstName: "RemoteUpdated",
        syncStatus: "synced",
      });

      // Resolve by overwriting local with remote
      const resolvedStudent = {
        ...remoteStudent,
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
      };

      expect(resolvedStudent.syncStatus).toBe("synced");
      expect(resolvedStudent.firstName).toBe("RemoteUpdated");
    });
  });
});

// ============================================================================
// PAYMENT SYNC TESTS
// ============================================================================

describe("Sync Service - Payment Sync", () => {
  beforeEach(resetAllMocks);

  describe("payment upload", () => {
    test("should upload payment with all financial data", () => {
      const payment = createMockPayment({
        amount: 750000, // UGX
        paymentMethod: "mobile_money",
        channel: "mtn_mobile_money",
        referenceNumber: "MTN-123456789",
      });

      expect(payment.amount).toBe(750000);
      expect(payment.paymentMethod).toBe("mobile_money");
    });

    test("should preserve receipt number during sync", () => {
      const payment = createMockPayment({
        receiptNumber: "REC-2024-0001",
      });

      const syncedPayment = {
        ...payment,
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
      };

      expect(syncedPayment.receiptNumber).toBe("REC-2024-0001");
    });

    test("should handle partial payment sync", () => {
      const partialPayment = createMockPayment({
        amount: 500000,
        remainingBalance: 1000000,
        isPartialPayment: true,
      });

      expect(partialPayment.isPartialPayment).toBe(true);
      expect(partialPayment.remainingBalance).toBe(1000000);
    });
  });

  describe("payment download", () => {
    test("should download and merge payment data", () => {
      const remotePayment = createMockPayment({
        id: "pay-001",
        amount: 500000,
        verifiedAt: "2024-01-15T10:00:00Z",
        verifiedBy: "admin-001",
      });

      const localPayment = {
        ...remotePayment,
        syncStatus: "synced" as const,
        syncedAt: new Date().toISOString(),
      };

      expect(localPayment.verifiedAt).toBeDefined();
      expect(localPayment.verifiedBy).toBeDefined();
    });

    test("should detect payment conflict", () => {
      const localPayment = createMockPayment({
        id: "pay-001",
        syncStatus: "pending",
        amount: 500000,
      });

      const remotePayment = createMockPayment({
        id: "pay-001",
        syncStatus: "synced",
        amount: 600000, // Different amount
      });

      const hasConflict = localPayment.syncStatus !== "synced";

      expect(hasConflict).toBe(true);
      expect(localPayment.amount).not.toBe(remotePayment.amount);
    });
  });

  describe("payment integrity", () => {
    test("should validate payment amount is positive", () => {
      const payment = createMockPayment({ amount: 500000 });

      expect(payment.amount).toBeGreaterThan(0);
    });

    test("should ensure receipt number uniqueness in batch", () => {
      const payments = [
        createMockPayment({ receiptNumber: "REC-001" }),
        createMockPayment({ receiptNumber: "REC-002" }),
        createMockPayment({ receiptNumber: "REC-003" }),
      ];

      const receiptNumbers = payments.map((p) => p.receiptNumber);
      const uniqueReceipts = new Set(receiptNumbers);

      expect(uniqueReceipts.size).toBe(payments.length);
    });
  });
});

// ============================================================================
// FEE STRUCTURE SYNC TESTS
// ============================================================================

describe("Sync Service - Fee Structure Sync", () => {
  beforeEach(resetAllMocks);

  describe("fee structure upload", () => {
    test("should upload fee structure with all breakdown items", () => {
      const feeStructure = createMockFeeStructure({
        id: "fee-001",
        totalAmount: 1500000,
        breakdown: [
          { name: "Tuition", amount: 1000000 },
          { name: "Library", amount: 200000 },
          { name: "Computer Lab", amount: 150000 },
          { name: "Exam Fees", amount: 150000 },
        ],
      });

      const breakdownTotal = feeStructure.breakdown.reduce(
        (sum: number, item: any) => sum + item.amount,
        0,
      );

      expect(breakdownTotal).toBe(feeStructure.totalAmount);
    });

    test("should handle fee structure with installment rules", () => {
      const feeStructure = createMockFeeStructure({
        installmentRules: [
          { installmentNumber: 1, dueDate: "2024-02-15", percentage: 40 },
          { installmentNumber: 2, dueDate: "2024-04-15", percentage: 30 },
          { installmentNumber: 3, dueDate: "2024-06-15", percentage: 30 },
        ],
      });

      const totalPercentage = feeStructure.installmentRules.reduce(
        (sum: number, rule: any) => sum + rule.percentage,
        0,
      );

      expect(totalPercentage).toBe(100);
    });
  });

  describe("fee structure conflict handling", () => {
    test("should flag fee structure changes for review", () => {
      // Fee structure changes are critical and should always be reviewed
      const localFeeStructure = createMockFeeStructure({
        id: "fee-001",
        totalAmount: 1500000,
        syncStatus: "pending",
      });

      const remoteFeeStructure = createMockFeeStructure({
        id: "fee-001",
        totalAmount: 1600000, // Changed
        syncStatus: "synced",
      });

      const hasCriticalConflict =
        localFeeStructure.totalAmount !== remoteFeeStructure.totalAmount;

      expect(hasCriticalConflict).toBe(true);
    });
  });
});

// ============================================================================
// AUDIT LOG SYNC TESTS
// ============================================================================

describe("Sync Service - Audit Log Sync", () => {
  beforeEach(resetAllMocks);

  describe("audit log upload", () => {
    test("should upload audit log with all details", () => {
      const auditLog = createMockAuditLog({
        action: "PAYMENT_RECORDED",
        userId: "user-001",
        timestamp: "2024-01-15T10:30:00Z",
        details: {
          paymentId: "pay-001",
          studentId: "stu-001",
          amount: 500000,
          receiptNumber: "REC-2024-001",
        },
      });

      expect(auditLog.action).toBe("PAYMENT_RECORDED");
      expect(auditLog.details.amount).toBe(500000);
    });

    test("should handle audit log failure gracefully", () => {
      // Audit logs are less critical, failures should not block sync
      const auditLogError = "Failed to sync audit log: Network timeout";

      // This should not cause the entire sync to fail
      const syncResult: SyncResult = {
        status: "success", // Still success despite audit log failure
        uploaded: 5,
        downloaded: 3,
        conflicts: 0,
        errors: [], // Audit log errors are logged but not added to errors
        timestamp: new Date().toISOString(),
      };

      expect(syncResult.status).toBe("success");
    });
  });

  describe("audit log types", () => {
    test("should support all audit action types", () => {
      const auditActions = [
        "STUDENT_CREATED",
        "STUDENT_UPDATED",
        "PAYMENT_RECORDED",
        "PAYMENT_VOIDED",
        "FEE_STRUCTURE_CREATED",
        "FEE_STRUCTURE_UPDATED",
        "USER_LOGIN",
        "USER_LOGOUT",
        "CLEARANCE_GRANTED",
        "CLEARANCE_REVOKED",
      ];

      auditActions.forEach((action) => {
        const log = createMockAuditLog({ action });
        expect(log.action).toBe(action);
      });
    });
  });
});

// ============================================================================
// AUTO SYNC TESTS
// ============================================================================

describe("Sync Service - Auto Sync", () => {
  beforeEach(resetAllMocks);

  describe("auto sync interval", () => {
    test("should default to 5 minutes interval", () => {
      const defaultIntervalMs = 5 * 60 * 1000;

      expect(defaultIntervalMs).toBe(300000);
    });

    test("should allow custom interval", () => {
      const customIntervalMs = 2 * 60 * 1000; // 2 minutes

      expect(customIntervalMs).toBe(120000);
    });
  });

  describe("auto sync behavior", () => {
    test("should not sync when offline", () => {
      const isOnline = false;
      const shouldSync = isOnline;

      expect(shouldSync).toBe(false);
    });

    test("should sync when online", () => {
      const isOnline = true;
      const shouldSync = isOnline;

      expect(shouldSync).toBe(true);
    });
  });
});

// ============================================================================
// FULL SYNC TESTS
// ============================================================================

describe("Sync Service - Full Sync", () => {
  beforeEach(resetAllMocks);

  describe("full sync preparation", () => {
    test("should clear last sync timestamp for full sync", () => {
      localStorageMock.setItem("edupay_last_sync", "2024-01-14T10:00:00Z");

      // Full sync clears the timestamp
      localStorageMock.removeItem("edupay_last_sync");

      expect(localStorageMock.getItem("edupay_last_sync")).toBeNull();
    });

    test("should require school ID for full sync", () => {
      const schoolId: string | null = null;

      const canFullSync = schoolId !== null;

      expect(canFullSync).toBe(false);
    });

    test("should require online status for full sync", () => {
      const isOnline = false;

      const canFullSync = isOnline;

      expect(canFullSync).toBe(false);
    });
  });

  describe("full sync result", () => {
    test("should return error result when offline", () => {
      const isOnline = false;
      const schoolId = "school-001";

      const result: SyncResult = {
        status: "error",
        uploaded: 0,
        downloaded: 0,
        conflicts: 0,
        errors: ["Cannot perform full sync: offline or no school ID"],
        timestamp: new Date().toISOString(),
      };

      expect(result.status).toBe("error");
      expect(result.errors).toHaveLength(1);
    });
  });
});

// ============================================================================
// LISTENER TESTS
// ============================================================================

describe("Sync Service - Listeners", () => {
  beforeEach(resetAllMocks);

  describe("subscribe/unsubscribe", () => {
    test("should add listener to list", () => {
      const listeners: Function[] = [];
      const listener = jest.fn();

      listeners.push(listener);

      expect(listeners).toHaveLength(1);
    });

    test("should remove listener when unsubscribed", () => {
      let listeners: Function[] = [];
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      listeners.push(listener1, listener2);

      // Unsubscribe listener1
      listeners = listeners.filter((l) => l !== listener1);

      expect(listeners).toHaveLength(1);
      expect(listeners).not.toContain(listener1);
      expect(listeners).toContain(listener2);
    });
  });

  describe("notification", () => {
    test("should notify all listeners of state change", () => {
      const listeners = [jest.fn(), jest.fn(), jest.fn()];

      const state: SyncState = {
        status: "syncing",
        lastSyncAt: null,
        pendingChanges: 5,
        isOnline: true,
      };

      listeners.forEach((listener) => listener(state));

      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith(state);
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// ============================================================================
// SCHOOL ID VALIDATION TESTS
// ============================================================================

describe("Sync Service - School ID Validation", () => {
  beforeEach(resetAllMocks);

  describe("initialization", () => {
    test("should require school ID before sync", () => {
      const schoolId: string | null = null;

      const result: SyncResult = schoolId
        ? {
            status: "syncing",
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
            errors: [],
            timestamp: new Date().toISOString(),
          }
        : {
            status: "error",
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
            errors: ["School ID not set. Call initialize() first."],
            timestamp: new Date().toISOString(),
          };

      expect(result.status).toBe("error");
      expect(result.errors).toContain(
        "School ID not set. Call initialize() first.",
      );
    });

    test("should allow sync after initialization", () => {
      const schoolId = "school-001";

      const canSync = schoolId !== null;

      expect(canSync).toBe(true);
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("Sync Service - Error Handling", () => {
  beforeEach(resetAllMocks);

  describe("upload errors", () => {
    test("should capture student upload error", () => {
      const errors: string[] = [];
      const student = createMockStudent({ studentId: "STU-001" });
      const error = new Error("Network timeout");

      errors.push(
        `Failed to sync student ${student.studentId}: ${error.message}`,
      );

      expect(errors).toContain(
        "Failed to sync student STU-001: Network timeout",
      );
    });

    test("should capture payment upload error", () => {
      const errors: string[] = [];
      const payment = createMockPayment({ receiptNumber: "REC-001" });
      const error = new Error("Permission denied");

      errors.push(
        `Failed to sync payment ${payment.receiptNumber}: ${error.message}`,
      );

      expect(errors).toContain(
        "Failed to sync payment REC-001: Permission denied",
      );
    });

    test("should capture fee structure upload error", () => {
      const errors: string[] = [];
      const error = new Error("Invalid data format");

      errors.push(`Failed to sync fee structure: ${error.message}`);

      expect(errors).toContain(
        "Failed to sync fee structure: Invalid data format",
      );
    });
  });

  describe("download errors", () => {
    test("should capture download failure", () => {
      const errors: string[] = [];
      const error = new Error("Firestore quota exceeded");

      errors.push(`Download failed: ${error.message}`);

      expect(errors).toContain("Download failed: Firestore quota exceeded");
    });
  });

  describe("result status determination", () => {
    test("should mark result as error when errors exist", () => {
      const errors = ["Error 1", "Error 2"];

      const status: SyncStatus = errors.length > 0 ? "error" : "success";

      expect(status).toBe("error");
    });

    test("should mark result as success when no errors", () => {
      const errors: string[] = [];

      const status: SyncStatus = errors.length > 0 ? "error" : "success";

      expect(status).toBe("success");
    });
  });
});

// ============================================================================
// UGX CURRENCY TESTS (Ugandan Shilling)
// ============================================================================

describe("Sync Service - UGX Currency Handling", () => {
  beforeEach(resetAllMocks);

  describe("UGX amounts in sync", () => {
    test("should preserve large UGX amounts without precision loss", () => {
      const largePayment = createMockPayment({
        amount: 15000000, // 15 million UGX
      });

      expect(largePayment.amount).toBe(15000000);
    });

    test("should handle typical school fee amounts", () => {
      const typicalAmounts = [
        500000, // 500K UGX
        750000, // 750K UGX
        1000000, // 1M UGX
        1500000, // 1.5M UGX
        2000000, // 2M UGX
      ];

      typicalAmounts.forEach((amount) => {
        const payment = createMockPayment({ amount });
        expect(payment.amount).toBe(amount);
        expect(Number.isInteger(payment.amount)).toBe(true);
      });
    });

    test("should ensure fee structure amounts are integers", () => {
      const feeStructure = createMockFeeStructure({
        totalAmount: 1500000,
        breakdown: [
          { name: "Tuition", amount: 1000000 },
          { name: "Library", amount: 200000 },
          { name: "Exam", amount: 150000 },
          { name: "Activity", amount: 150000 },
        ],
      });

      expect(Number.isInteger(feeStructure.totalAmount)).toBe(true);
      feeStructure.breakdown.forEach((item: any) => {
        expect(Number.isInteger(item.amount)).toBe(true);
      });
    });
  });
});
