/**
 * Payment Service Tests
 * Comprehensive test suite for payment.service.ts
 */

import {
  validatePaymentAmount,
  calculateInstallmentApplication,
  applyPaymentToInstallments,
  getChannelDetails,
} from "../../lib/services/payment.service";
import type { Student, InstallmentProgress } from "../../types/student";
import type { PaymentChannel } from "../../types/payment";
import { Timestamp } from "firebase/firestore";

// ============================================================================
// MOCK HELPERS
// ============================================================================

/**
 * Create a mock Timestamp from a date string or Date object
 */
const mockTimestamp = (date: string | Date): Timestamp => {
  const d = typeof date === "string" ? new Date(date) : date;
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
    isEqual: (other: Timestamp) => other.toMillis() === d.getTime(),
  } as Timestamp;
};

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockStudent = (overrides: Partial<Student> = {}): Student => ({
  id: "student-001",
  studentId: "EDU-2024-001",
  firstName: "John",
  lastName: "Doe",
  middleName: "",
  dateOfBirth: mockTimestamp("2010-01-15"),
  gender: "male",
  photo: undefined,
  schoolId: "school-001",
  classId: "class-s1",
  className: "Senior 1",
  streamId: "stream-west",
  streamName: "West Wing",
  academicYear: "2026",
  term: 1,
  enrollmentDate: mockTimestamp("2024-01-10"),
  status: "active",
  guardian: {
    name: "Jane Doe",
    phone: "+256701234567",
    email: "jane.doe@example.com",
    relationship: "mother",
  },
  feeStructureId: "fee-s1-2026",
  totalFees: 1200000,
  amountPaid: 400000,
  balance: 800000,
  scholarshipId: undefined,
  scholarshipAmount: 0,
  paymentStatus: "partial",
  currentInstallment: 2,
  installmentProgress: [
    {
      installmentId: "inst-1",
      installmentName: "First Installment",
      installmentOrder: 1,
      amountDue: 400000,
      amountPaid: 400000,
      deadline: mockTimestamp("2026-02-15"),
      status: "completed",
      isUnlocked: true,
    },
    {
      installmentId: "inst-2",
      installmentName: "Second Installment",
      installmentOrder: 2,
      amountDue: 400000,
      amountPaid: 0,
      deadline: mockTimestamp("2026-04-15"),
      status: "not_started",
      isUnlocked: true,
    },
    {
      installmentId: "inst-3",
      installmentName: "Third Installment",
      installmentOrder: 3,
      amountDue: 400000,
      amountPaid: 0,
      deadline: mockTimestamp("2026-06-15"),
      status: "not_started",
      isUnlocked: false,
    },
  ],
  createdAt: mockTimestamp(new Date()),
  updatedAt: mockTimestamp(new Date()),
  ...overrides,
});

const createMockInstallments = (
  overrides: Partial<InstallmentProgress>[] = [],
): InstallmentProgress[] => {
  const defaults: InstallmentProgress[] = [
    {
      installmentId: "inst-1",
      installmentName: "First Installment",
      installmentOrder: 1,
      amountDue: 400000,
      amountPaid: 400000,
      deadline: mockTimestamp("2026-02-15"),
      status: "completed",
      isUnlocked: true,
    },
    {
      installmentId: "inst-2",
      installmentName: "Second Installment",
      installmentOrder: 2,
      amountDue: 400000,
      amountPaid: 0,
      deadline: mockTimestamp("2026-04-15"),
      status: "not_started",
      isUnlocked: true,
    },
    {
      installmentId: "inst-3",
      installmentName: "Third Installment",
      installmentOrder: 3,
      amountDue: 400000,
      amountPaid: 0,
      deadline: mockTimestamp("2026-06-15"),
      status: "not_started",
      isUnlocked: false,
    },
  ];
  return defaults.map((inst, i) => ({ ...inst, ...overrides[i] }));
};

// ============================================================================
// VALIDATE PAYMENT AMOUNT TESTS
// ============================================================================

describe("validatePaymentAmount", () => {
  describe("Valid payment scenarios", () => {
    it("should accept valid payment within balance", () => {
      const student = createMockStudent({ balance: 800000 });
      const result = validatePaymentAmount(student, 400000);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe("Payment is valid");
    });

    it("should accept payment equal to full balance", () => {
      const student = createMockStudent({ balance: 500000 });
      const result = validatePaymentAmount(student, 500000);
      expect(result.isValid).toBe(true);
    });

    it("should accept minimum valid payment (1 UGX)", () => {
      const student = createMockStudent({ balance: 100000 });
      const result = validatePaymentAmount(student, 1);
      expect(result.isValid).toBe(true);
    });

    it("should accept partial payment for unlocked installment", () => {
      const student = createMockStudent();
      const result = validatePaymentAmount(student, 200000);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Invalid payment scenarios - Zero/Negative amounts", () => {
    it("should reject zero amount", () => {
      const student = createMockStudent({ balance: 800000 });
      const result = validatePaymentAmount(student, 0);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Payment amount must be greater than zero");
    });

    it("should reject negative amount", () => {
      const student = createMockStudent({ balance: 800000 });
      const result = validatePaymentAmount(student, -100000);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Payment amount must be greater than zero");
    });

    it("should reject very large negative amount", () => {
      const student = createMockStudent({ balance: 800000 });
      const result = validatePaymentAmount(student, -999999999);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Invalid payment scenarios - Exceeds balance", () => {
    it("should reject amount exceeding balance", () => {
      const student = createMockStudent({ balance: 500000 });
      const result = validatePaymentAmount(student, 600000);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("exceeds outstanding balance");
    });

    it("should reject amount exceeding balance by 1 UGX", () => {
      const student = createMockStudent({ balance: 500000 });
      const result = validatePaymentAmount(student, 500001);
      expect(result.isValid).toBe(false);
    });

    it("should reject payment for student with zero balance", () => {
      const student = createMockStudent({ balance: 0 });
      const result = validatePaymentAmount(student, 100000);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Student has no outstanding balance");
    });

    it("should reject payment for fully paid student", () => {
      const student = createMockStudent({
        totalFees: 1200000,
        amountPaid: 1200000,
        balance: 0,
        paymentStatus: "fully_paid",
      });
      const result = validatePaymentAmount(student, 50000);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Invalid payment scenarios - Installment locked", () => {
    it("should reject payment when no installment is unlocked", () => {
      const student = createMockStudent({
        installmentProgress: [
          {
            installmentId: "inst-1",
            installmentName: "First Installment",
            installmentOrder: 1,
            amountDue: 400000,
            amountPaid: 0,
            deadline: mockTimestamp("2026-02-15"),
            status: "not_started",
            isUnlocked: false,
          },
        ],
      });
      const result = validatePaymentAmount(student, 100000);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("not yet unlocked");
    });
  });

  describe("Edge cases", () => {
    it("should handle student with no installment progress", () => {
      const student = createMockStudent({ installmentProgress: undefined });
      const result = validatePaymentAmount(student, 100000);
      // Should still be valid if balance > 0
      expect(result.isValid).toBe(true);
    });

    it("should handle student with empty installment array", () => {
      const student = createMockStudent({ installmentProgress: [] });
      const result = validatePaymentAmount(student, 100000);
      expect(result.isValid).toBe(true);
    });

    it("should handle very large payment amount within balance", () => {
      const student = createMockStudent({
        totalFees: 100000000,
        balance: 50000000,
      });
      const result = validatePaymentAmount(student, 50000000);
      expect(result.isValid).toBe(true);
    });
  });
});

// ============================================================================
// CALCULATE INSTALLMENT APPLICATION TESTS
// ============================================================================

describe("calculateInstallmentApplication", () => {
  describe("Single installment scenarios", () => {
    it("should apply payment to single pending installment", () => {
      const installments = createMockInstallments();
      const result = calculateInstallmentApplication(installments, 400000);

      expect(result).toHaveLength(1);
      expect(result[0].installmentId).toBe("inst-2");
      expect(result[0].amountApplied).toBe(400000);
      expect(result[0].isCompleted).toBe(true);
    });

    it("should partially apply payment to installment", () => {
      const installments = createMockInstallments();
      const result = calculateInstallmentApplication(installments, 200000);

      expect(result).toHaveLength(1);
      expect(result[0].installmentId).toBe("inst-2");
      expect(result[0].amountApplied).toBe(200000);
      expect(result[0].isCompleted).toBe(false);
    });
  });

  describe("Multiple installment scenarios", () => {
    it("should apply overflow payment to next installment", () => {
      const installments: InstallmentProgress[] = [
        {
          installmentId: "inst-1",
          installmentName: "First",
          installmentOrder: 1,
          amountDue: 400000,
          amountPaid: 300000,
          deadline: mockTimestamp(new Date()),
          status: "in_progress",
          isUnlocked: true,
        },
        {
          installmentId: "inst-2",
          installmentName: "Second",
          installmentOrder: 2,
          amountDue: 400000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: false,
        },
      ];

      const result = calculateInstallmentApplication(installments, 300000);

      expect(result).toHaveLength(2);
      expect(result[0].installmentId).toBe("inst-1");
      expect(result[0].amountApplied).toBe(100000);
      expect(result[0].isCompleted).toBe(true);
      expect(result[1].installmentId).toBe("inst-2");
      expect(result[1].amountApplied).toBe(200000);
      expect(result[1].isCompleted).toBe(false);
    });

    it("should complete multiple installments with large payment", () => {
      const installments: InstallmentProgress[] = [
        {
          installmentId: "inst-1",
          installmentName: "First",
          installmentOrder: 1,
          amountDue: 200000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: true,
        },
        {
          installmentId: "inst-2",
          installmentName: "Second",
          installmentOrder: 2,
          amountDue: 200000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: false,
        },
        {
          installmentId: "inst-3",
          installmentName: "Third",
          installmentOrder: 3,
          amountDue: 200000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: false,
        },
      ];

      const result = calculateInstallmentApplication(installments, 600000);

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.isCompleted)).toBe(true);
    });
  });

  describe("Skip completed installments", () => {
    it("should skip already completed installments", () => {
      const installments = createMockInstallments();
      const result = calculateInstallmentApplication(installments, 100000);

      // Should not include inst-1 which is already completed
      expect(result.some((r) => r.installmentId === "inst-1")).toBe(false);
      expect(result[0].installmentId).toBe("inst-2");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty installments array", () => {
      const result = calculateInstallmentApplication([], 100000);
      expect(result).toHaveLength(0);
    });

    it("should handle all completed installments", () => {
      const installments: InstallmentProgress[] = [
        {
          installmentId: "inst-1",
          installmentName: "First",
          installmentOrder: 1,
          amountDue: 400000,
          amountPaid: 400000,
          deadline: mockTimestamp(new Date()),
          status: "completed",
          isUnlocked: true,
        },
      ];

      const result = calculateInstallmentApplication(installments, 100000);
      expect(result).toHaveLength(0);
    });

    it("should handle zero payment amount", () => {
      const installments = createMockInstallments();
      const result = calculateInstallmentApplication(installments, 0);
      expect(result).toHaveLength(0);
    });

    it("should handle unsorted installments", () => {
      const installments: InstallmentProgress[] = [
        {
          installmentId: "inst-3",
          installmentName: "Third",
          installmentOrder: 3,
          amountDue: 400000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: false,
        },
        {
          installmentId: "inst-1",
          installmentName: "First",
          installmentOrder: 1,
          amountDue: 400000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: true,
        },
        {
          installmentId: "inst-2",
          installmentName: "Second",
          installmentOrder: 2,
          amountDue: 400000,
          amountPaid: 0,
          deadline: mockTimestamp(new Date()),
          status: "not_started",
          isUnlocked: false,
        },
      ];

      const result = calculateInstallmentApplication(installments, 200000);

      // Should apply to installment 1 first (lowest order)
      expect(result[0].installmentId).toBe("inst-1");
    });
  });
});

// ============================================================================
// APPLY PAYMENT TO INSTALLMENTS TESTS
// ============================================================================

describe("applyPaymentToInstallments", () => {
  it("should update installment with applied payment", () => {
    const installments = createMockInstallments();
    const applications = [
      {
        installmentId: "inst-2",
        installmentName: "Second Installment",
        amountApplied: 200000,
        previouslyPaid: 0,
        nowPaid: 200000,
        isCompleted: false,
      },
    ];

    const result = applyPaymentToInstallments(installments, applications);

    const updated = result.find((i) => i.installmentId === "inst-2");
    expect(updated?.amountPaid).toBe(200000);
    expect(updated?.status).toBe("in_progress");
  });

  it("should mark installment as completed when fully paid", () => {
    const installments = createMockInstallments();
    const applications = [
      {
        installmentId: "inst-2",
        installmentName: "Second Installment",
        amountApplied: 400000,
        previouslyPaid: 0,
        nowPaid: 400000,
        isCompleted: true,
      },
    ];

    const result = applyPaymentToInstallments(installments, applications);

    const updated = result.find((i) => i.installmentId === "inst-2");
    expect(updated?.status).toBe("completed");
    expect(updated?.completedAt).toBeDefined();
  });

  it("should unlock next installment when previous is completed", () => {
    const installments: InstallmentProgress[] = [
      {
        installmentId: "inst-1",
        installmentName: "First",
        installmentOrder: 1,
        amountDue: 400000,
        amountPaid: 300000,
        deadline: mockTimestamp(new Date()),
        status: "in_progress",
        isUnlocked: true,
      },
      {
        installmentId: "inst-2",
        installmentName: "Second",
        installmentOrder: 2,
        amountDue: 400000,
        amountPaid: 0,
        deadline: mockTimestamp(new Date()),
        status: "not_started",
        isUnlocked: false,
      },
    ];

    const applications = [
      {
        installmentId: "inst-1",
        installmentName: "First",
        amountApplied: 100000,
        previouslyPaid: 300000,
        nowPaid: 400000,
        isCompleted: true,
      },
    ];

    const result = applyPaymentToInstallments(installments, applications);

    expect(result[0].status).toBe("completed");
    expect(result[1].isUnlocked).toBe(true);
  });

  it("should not modify installments not in applications", () => {
    const installments = createMockInstallments();
    const applications = [
      {
        installmentId: "inst-2",
        installmentName: "Second",
        amountApplied: 200000,
        previouslyPaid: 0,
        nowPaid: 200000,
        isCompleted: false,
      },
    ];

    const result = applyPaymentToInstallments(installments, applications);

    // inst-1 should remain unchanged
    const inst1 = result.find((i) => i.installmentId === "inst-1");
    expect(inst1?.amountPaid).toBe(400000);
    expect(inst1?.status).toBe("completed");

    // inst-3 should remain unchanged
    const inst3 = result.find((i) => i.installmentId === "inst-3");
    expect(inst3?.amountPaid).toBe(0);
    expect(inst3?.status).toBe("not_started");
  });

  it("should handle empty applications array", () => {
    const installments = createMockInstallments();
    const result = applyPaymentToInstallments(installments, []);

    expect(result).toHaveLength(3);
    expect(result[1].amountPaid).toBe(0); // unchanged
  });
});

// ============================================================================
// GET CHANNEL DETAILS TESTS
// ============================================================================

describe("getChannelDetails", () => {
  it("should return correct details for MTN Mobile Money", () => {
    expect(getChannelDetails("momo_mtn")).toBe("MTN Mobile Money");
  });

  it("should return correct details for Airtel Money", () => {
    expect(getChannelDetails("momo_airtel")).toBe("Airtel Money");
  });

  it("should return correct details for Bank Transfer", () => {
    expect(getChannelDetails("bank_transfer")).toBe("Bank Transfer");
  });

  it("should return correct details for Cash", () => {
    expect(getChannelDetails("cash")).toBe("Cash Payment");
  });

  it("should return correct details for Cheque", () => {
    expect(getChannelDetails("cheque")).toBe("Cheque Payment");
  });

  it("should return correct details for Other", () => {
    expect(getChannelDetails("other")).toBe("Other Payment Method");
  });

  it("should return Unknown for invalid channel", () => {
    expect(getChannelDetails("invalid" as PaymentChannel)).toBe("Unknown");
  });
});

// ============================================================================
// INTEGRATION-STYLE TESTS
// ============================================================================

describe("Payment Flow Integration", () => {
  it("should correctly process a complete payment flow", () => {
    const student = createMockStudent();

    // Step 1: Validate
    const validation = validatePaymentAmount(student, 400000);
    expect(validation.isValid).toBe(true);

    // Step 2: Calculate application
    const applications = calculateInstallmentApplication(
      student.installmentProgress || [],
      400000,
    );
    expect(applications).toHaveLength(1);
    expect(applications[0].isCompleted).toBe(true);

    // Step 3: Apply to installments
    const updated = applyPaymentToInstallments(
      student.installmentProgress || [],
      applications,
    );
    expect(updated.find((i) => i.installmentId === "inst-2")?.status).toBe(
      "completed",
    );
    expect(updated.find((i) => i.installmentId === "inst-3")?.isUnlocked).toBe(
      true,
    );
  });

  it("should handle partial payment across multiple installments", () => {
    const installments: InstallmentProgress[] = [
      {
        installmentId: "inst-1",
        installmentName: "First",
        installmentOrder: 1,
        amountDue: 300000,
        amountPaid: 200000,
        deadline: mockTimestamp(new Date()),
        status: "in_progress",
        isUnlocked: true,
      },
      {
        installmentId: "inst-2",
        installmentName: "Second",
        installmentOrder: 2,
        amountDue: 300000,
        amountPaid: 0,
        deadline: mockTimestamp(new Date()),
        status: "not_started",
        isUnlocked: false,
      },
    ];

    // Payment of 250000 should complete inst-1 (100k) and partial inst-2 (150k)
    const applications = calculateInstallmentApplication(installments, 250000);

    expect(applications).toHaveLength(2);
    expect(applications[0].amountApplied).toBe(100000);
    expect(applications[0].isCompleted).toBe(true);
    expect(applications[1].amountApplied).toBe(150000);
    expect(applications[1].isCompleted).toBe(false);

    const updated = applyPaymentToInstallments(installments, applications);
    expect(updated[0].status).toBe("completed");
    expect(updated[1].status).toBe("in_progress");
    expect(updated[1].isUnlocked).toBe(true);
  });
});

// ============================================================================
// CURRENCY/UGX SPECIFIC TESTS
// ============================================================================

describe("UGX Currency Handling", () => {
  it("should handle UGX amounts without decimals", () => {
    const student = createMockStudent({ balance: 1000000 });
    const result = validatePaymentAmount(student, 999999);
    expect(result.isValid).toBe(true);
  });

  it("should handle typical Ugandan school fee amounts", () => {
    // Typical Ugandan school fees: 500,000 - 3,000,000 UGX per term
    const student = createMockStudent({
      totalFees: 1500000,
      balance: 1500000,
    });

    const amounts = [500000, 750000, 1000000, 1250000, 1500000];
    amounts.forEach((amount) => {
      const result = validatePaymentAmount(student, amount);
      expect(result.isValid).toBe(true);
    });
  });

  it("should handle mobile money typical limits", () => {
    // MTN MoMo max per transaction is around 5,000,000 UGX
    const student = createMockStudent({ balance: 5000000 });
    const result = validatePaymentAmount(student, 5000000);
    expect(result.isValid).toBe(true);
  });
});
