/**
 * Mock Data Store
 * Provides mock data for development and testing
 */

export interface MockStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  streamName?: string;
  status: "active" | "inactive" | "graduated" | "transferred";
  guardian: {
    name: string;
    phone: string;
    relationship: "mother" | "father" | "guardian" | "other";
  };
  totalFees: number;
  amountPaid: number;
  balance: number;
  paymentStatus: "fully_paid" | "partial" | "overdue" | "no_payment";
}

export interface MockGlobalStats {
  totalStudents: number;
  activeStudents: number;
  totalRevenue: number;
  pendingPayments: number;
  studentsWithArrears: number;
}

// Mock students data
const mockStudents: MockStudent[] = [
  {
    id: "mock-1",
    studentId: "EDU-2024-001",
    firstName: "John",
    lastName: "Doe",
    className: "Senior 1",
    streamName: "West Wing",
    status: "active",
    guardian: {
      name: "Jane Doe",
      phone: "+256701234567",
      relationship: "mother",
    },
    totalFees: 1200000,
    amountPaid: 600000,
    balance: 600000,
    paymentStatus: "partial",
  },
  {
    id: "mock-2",
    studentId: "EDU-2024-002",
    firstName: "Sarah",
    lastName: "Nambi",
    className: "Senior 2",
    streamName: "East Wing",
    status: "active",
    guardian: {
      name: "Peter Nambi",
      phone: "+256772345678",
      relationship: "father",
    },
    totalFees: 1200000,
    amountPaid: 1200000,
    balance: 0,
    paymentStatus: "fully_paid",
  },
  {
    id: "mock-3",
    studentId: "EDU-2024-003",
    firstName: "David",
    lastName: "Okello",
    className: "Senior 3",
    streamName: "North Wing",
    status: "active",
    guardian: {
      name: "Mary Okello",
      phone: "+256783456789",
      relationship: "guardian",
    },
    totalFees: 1500000,
    amountPaid: 500000,
    balance: 1000000,
    paymentStatus: "overdue",
  },
];

// Mock global stats
const mockGlobalStats: MockGlobalStats = {
  totalStudents: 500,
  activeStudents: 480,
  totalRevenue: 250000000,
  pendingPayments: 75000000,
  studentsWithArrears: 45,
};

/**
 * Get all mock students
 */
export function getAllMockStudents(): MockStudent[] {
  return mockStudents;
}

/**
 * Get mock student by ID
 */
export function getMockStudentById(id: string): MockStudent | undefined {
  return mockStudents.find((s) => s.id === id || s.studentId === id);
}

/**
 * Get mock global statistics
 */
export function getMockGlobalStats(): MockGlobalStats {
  return mockGlobalStats;
}

/**
 * Get mock students by class
 */
export function getMockStudentsByClass(className: string): MockStudent[] {
  return mockStudents.filter((s) => s.className === className);
}

/**
 * Get mock students with arrears
 */
export function getMockStudentsWithArrears(): MockStudent[] {
  return mockStudents.filter((s) => s.balance > 0);
}
