/**
 * Zod Validation Schemas
 * Comprehensive validation schemas for eBursar forms
 */

import { z } from "zod";

// =============================================================================
// Common Validators & Helpers
// =============================================================================

// Ugandan phone number validation (supports 07x, 03x, and +256 formats)
const ugandanPhoneRegex = /^(\+256|0)(7[0-9]|3[0-9])[0-9]{7}$/;

export const phoneNumberSchema = z
  .string()
  .regex(
    ugandanPhoneRegex,
    "Enter a valid Ugandan phone number (e.g., 0771234567)",
  );

// Email with better validation
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(5, "Email is too short")
  .max(100, "Email is too long");

// Currency amount (UGX - no decimals typically)
export const amountSchema = z
  .number()
  .min(0, "Amount cannot be negative")
  .max(100000000, "Amount exceeds maximum allowed (UGX 100,000,000)");

// Positive amount (for payments)
export const positiveAmountSchema = z
  .number()
  .min(1, "Amount must be at least UGX 1")
  .max(100000000, "Amount exceeds maximum allowed");

// Date range validation helper
export const dateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

// =============================================================================
// Authentication Schemas
// =============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and number",
      ),
    confirmPassword: z.string(),
    firstName: z.string().min(2, "First name is required").max(50),
    lastName: z.string().min(2, "Last name is required").max(50),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and number",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// =============================================================================
// Student Schemas
// =============================================================================

export const studentSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name is too long"),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name is too long"),
  middleName: z.string().max(50).optional(),
  dateOfBirth: z
    .date()
    .refine((date) => date < new Date(), "Date of birth must be in the past"),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Please select a gender" }),
  }),
  classId: z.string().min(1, "Please select a class"),
  streamId: z.string().optional(),
  admissionNumber: z
    .string()
    .min(3, "Admission number is required")
    .max(20, "Admission number is too long"),
  admissionDate: z.date(),
  status: z
    .enum(["active", "inactive", "graduated", "transferred", "suspended"])
    .default("active"),
  residenceStatus: z.enum(["day", "boarding"]),

  // Guardian Information
  guardianName: z.string().min(2, "Guardian name is required").max(100),
  guardianRelationship: z.enum(["parent", "guardian", "relative", "sponsor"]),
  guardianPhone: phoneNumberSchema,
  guardianEmail: emailSchema.optional().or(z.literal("")),
  guardianAddress: z.string().max(200).optional(),

  // Emergency Contact
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: phoneNumberSchema.optional().or(z.literal("")),

  // Additional Info
  medicalConditions: z.string().max(500).optional(),
  allergies: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const studentSearchSchema = z.object({
  query: z.string().max(100).optional(),
  classId: z.string().optional(),
  status: z
    .enum([
      "active",
      "inactive",
      "graduated",
      "transferred",
      "suspended",
      "all",
    ])
    .optional(),
  residenceStatus: z.enum(["day", "boarding", "all"]).optional(),
  hasArrears: z.boolean().optional(),
});

// =============================================================================
// Payment Schemas
// =============================================================================

export const paymentMethodSchema = z.enum([
  "cash",
  "mobile_money",
  "bank_transfer",
  "cheque",
  "card",
  "other",
]);

export const mobileMoneyProviderSchema = z.enum(["mtn", "airtel"]);

export const paymentSchema = z
  .object({
    studentId: z.string().min(1, "Please select a student"),
    amount: positiveAmountSchema,
    paymentMethod: paymentMethodSchema,
    feeCategoryId: z.string().min(1, "Please select a fee category"),
    termId: z.string().min(1, "Please select a term"),

    // Method-specific fields
    mobileMoneyProvider: mobileMoneyProviderSchema.optional(),
    mobileMoneyNumber: phoneNumberSchema.optional(),
    transactionReference: z.string().max(100).optional(),
    bankName: z.string().max(100).optional(),
    chequeNumber: z.string().max(50).optional(),
    chequeDate: z.date().optional(),

    // Additional info
    payerName: z.string().min(2, "Payer name is required").max(100),
    payerPhone: phoneNumberSchema.optional().or(z.literal("")),
    notes: z.string().max(500).optional(),
    receiptNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Mobile money validation
    if (data.paymentMethod === "mobile_money") {
      if (!data.mobileMoneyProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select a mobile money provider",
          path: ["mobileMoneyProvider"],
        });
      }
      if (!data.mobileMoneyNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter mobile money number",
          path: ["mobileMoneyNumber"],
        });
      }
    }

    // Bank transfer validation
    if (data.paymentMethod === "bank_transfer" && !data.bankName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter bank name",
        path: ["bankName"],
      });
    }

    // Cheque validation
    if (data.paymentMethod === "cheque") {
      if (!data.chequeNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter cheque number",
          path: ["chequeNumber"],
        });
      }
      if (!data.chequeDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter cheque date",
          path: ["chequeDate"],
        });
      }
    }
  });

// Bulk payment import schema
export const bulkPaymentRowSchema = z.object({
  admissionNumber: z.string().min(1, "Admission number is required"),
  amount: positiveAmountSchema,
  paymentDate: z.date(),
  paymentMethod: paymentMethodSchema,
  reference: z.string().optional(),
});

export const bulkPaymentImportSchema = z.object({
  payments: z
    .array(bulkPaymentRowSchema)
    .min(1, "At least one payment is required"),
  termId: z.string().min(1, "Please select a term"),
  feeCategoryId: z.string().min(1, "Please select a fee category"),
});

// =============================================================================
// Fee Category & Structure Schemas
// =============================================================================

export const feeCategorySchema = z.object({
  name: z.string().min(2, "Category name is required").max(100),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().default(true),
  appliesToResidence: z.enum(["all", "day", "boarding"]).default("all"),
  frequency: z.enum(["termly", "annually", "once"]).default("termly"),
});

export const feeStructureSchema = z.object({
  categoryId: z.string().min(1, "Please select a fee category"),
  classId: z.string().min(1, "Please select a class"),
  termId: z.string().min(1, "Please select a term"),
  amount: positiveAmountSchema,
  dueDate: z.date().optional(),

  // Optional residence-specific amounts
  dayAmount: amountSchema.optional(),
  boardingAmount: amountSchema.optional(),
});

// =============================================================================
// Installment Schemas
// =============================================================================

export const installmentRuleSchema = z.object({
  name: z.string().min(2, "Rule name is required").max(100),
  description: z.string().max(500).optional(),
  numberOfInstallments: z
    .number()
    .int()
    .min(2, "Minimum 2 installments")
    .max(12, "Maximum 12 installments"),
  installments: z
    .array(
      z.object({
        installmentNumber: z.number().int().min(1),
        percentage: z.number().min(1).max(100),
        dueDaysFromStart: z.number().int().min(0),
        description: z.string().max(100).optional(),
      }),
    )
    .refine(
      (installments) => {
        const total = installments.reduce((sum, i) => sum + i.percentage, 0);
        return total === 100;
      },
      { message: "Installment percentages must total 100%" },
    ),
  isActive: z.boolean().default(true),
  appliesToClasses: z.array(z.string()).optional(),
});

// =============================================================================
// Promise to Pay Schemas
// =============================================================================

export const promiseToPaySchema = z
  .object({
    studentId: z.string().min(1, "Please select a student"),
    promisedAmount: positiveAmountSchema,
    promiseDate: z.date(),
    dueDate: z.date(),
    guarantorName: z.string().min(2, "Guarantor name is required").max(100),
    guarantorPhone: phoneNumberSchema,
    guarantorRelationship: z.string().max(50).optional(),
    reason: z
      .string()
      .min(10, "Please provide a reason (min 10 characters)")
      .max(500),
    terms: z.string().max(1000).optional(),
  })
  .refine((data) => data.dueDate > data.promiseDate, {
    message: "Due date must be after promise date",
    path: ["dueDate"],
  });

// =============================================================================
// School Onboarding Schemas
// =============================================================================

export const schoolOnboardingSchema = z.object({
  // Basic Info
  name: z.string().min(3, "School name is required").max(200),
  motto: z.string().max(200).optional(),
  registrationNumber: z.string().max(50).optional(),

  // Contact
  email: emailSchema,
  phone: phoneNumberSchema,
  alternativePhone: phoneNumberSchema.optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),

  // Address
  district: z.string().min(1, "District is required"),
  county: z.string().max(100).optional(),
  subcounty: z.string().max(100).optional(),
  parish: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
  physicalAddress: z.string().max(300).optional(),
  postalAddress: z.string().max(100).optional(),

  // Academic Info
  educationLevel: z.enum([
    "nursery",
    "primary",
    "secondary",
    "tertiary",
    "mixed",
  ]),
  ownership: z.enum(["government", "private", "community", "religious"]),
  foundedYear: z.number().int().min(1900).max(new Date().getFullYear()),

  // Financial Info
  currency: z.literal("UGX").default("UGX"),
  bankName: z.string().max(100).optional(),
  bankAccountName: z.string().max(200).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankBranch: z.string().max(100).optional(),
  mobileMoneyNumber: phoneNumberSchema.optional().or(z.literal("")),

  // System Settings
  academicYearStart: z
    .enum(["january", "february", "march"])
    .default("february"),
  termsPerYear: z.number().int().min(2).max(4).default(3),
});

// =============================================================================
// Term & Academic Year Schemas
// =============================================================================

export const academicYearSchema = z
  .object({
    name: z.string().min(4, "Year name is required (e.g., 2024)"),
    startDate: z.date(),
    endDate: z.date(),
    isActive: z.boolean().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const termSchema = z
  .object({
    name: z.string().min(1, "Term name is required"),
    academicYearId: z.string().min(1, "Please select an academic year"),
    termNumber: z.number().int().min(1).max(4),
    startDate: z.date(),
    endDate: z.date(),
    feeDeadline: z.date(),
    isActive: z.boolean().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

// =============================================================================
// Class & Stream Schemas
// =============================================================================

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required").max(50),
  level: z.number().int().min(0).max(20),
  section: z.enum(["nursery", "primary", "secondary", "tertiary"]),
  capacity: z.number().int().min(1).max(200).optional(),
  classTeacherId: z.string().optional(),
});

export const streamSchema = z.object({
  name: z.string().min(1, "Stream name is required").max(50),
  classId: z.string().min(1, "Please select a class"),
});

// =============================================================================
// User & Staff Schemas
// =============================================================================

export const userSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: phoneNumberSchema.optional().or(z.literal("")),
  role: z.enum(["admin", "bursar", "teacher", "accountant", "head_teacher"]),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// =============================================================================
// Report Schemas
// =============================================================================

export const reportFilterSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
    classId: z.string().optional(),
    termId: z.string().optional(),
    feeCategoryId: z.string().optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: z.enum(["paid", "partial", "unpaid", "all"]).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const scheduledReportSchema = z.object({
  name: z.string().min(2).max(100),
  reportType: z.enum([
    "collection_summary",
    "overdue_list",
    "payment_breakdown",
    "class_comparison",
    "daily_transactions",
  ]),
  frequency: z.enum(["daily", "weekly", "monthly", "termly"]),
  recipients: z.array(emailSchema).min(1, "At least one recipient is required"),
  filters: reportFilterSchema.optional(),
  isActive: z.boolean().default(true),
});

// =============================================================================
// Settings Schemas
// =============================================================================

export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  pushNotifications: z.boolean().default(true),
  paymentReminders: z.boolean().default(true),
  arrearAlerts: z.boolean().default(true),
  dailyDigest: z.boolean().default(false),
  weeklyReport: z.boolean().default(true),
});

export const systemSettingsSchema = z.object({
  schoolName: z.string().min(3).max(200),
  currency: z.literal("UGX"),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  receiptPrefix: z.string().max(10).optional(),
  receiptStartNumber: z.number().int().min(1).optional(),
  autoGenerateReceipts: z.boolean().default(true),
  allowPartialPayments: z.boolean().default(true),
  minimumPaymentPercent: z.number().min(0).max(100).default(10),
  overdueGraceDays: z.number().int().min(0).max(30).default(7),
});

// =============================================================================
// Type Exports
// =============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type FeeCategoryInput = z.infer<typeof feeCategorySchema>;
export type FeeStructureInput = z.infer<typeof feeStructureSchema>;
export type InstallmentRuleInput = z.infer<typeof installmentRuleSchema>;
export type PromiseToPayInput = z.infer<typeof promiseToPaySchema>;
export type SchoolOnboardingInput = z.infer<typeof schoolOnboardingSchema>;
export type TermInput = z.infer<typeof termSchema>;
export type ClassInput = z.infer<typeof classSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type ScheduledReportInput = z.infer<typeof scheduledReportSchema>;
export type NotificationSettingsInput = z.infer<
  typeof notificationSettingsSchema
>;
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
