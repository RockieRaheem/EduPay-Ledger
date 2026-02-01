/**
 * Settings Firebase Service
 * Handles all settings-related database operations for eBursar
 */

import {
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  subscribeToDocument,
  batchWrite,
  logAuditAction,
  COLLECTIONS,
} from "@/lib/firebase";
import { where, orderBy, QueryConstraint } from "firebase/firestore";

// ============================================================================
// TYPES
// ============================================================================

export interface SchoolSettings {
  id: string;
  schoolId: string;

  // General
  schoolName: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  motto?: string;

  // Financial
  currency: string;
  currencySymbol: string;
  taxId?: string;
  bankName?: string;
  bankAccount?: string;

  // Academic
  currentTermId: string;
  currentTermName: string;
  academicYear: string;

  // Notifications
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsProvider?: "africas_talking" | "twilio" | "custom";
  smsApiKey?: string;

  // Payment Settings
  allowPartialPayments: boolean;
  minimumPaymentAmount: number;
  lateFeePercentage: number;
  gracePeriodDays: number;

  // Receipt Settings
  receiptPrefix: string;
  receiptFooter?: string;
  showBalanceOnReceipt: boolean;

  // Integrations
  stellarEnabled: boolean;
  stellarPublicKey?: string;

  updatedAt: Date;
  updatedBy: string;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  termId: string;
  classId: string;
  className: string;

  // Fee breakdown
  tuitionFee: number;
  examFee: number;
  libraryFee: number;
  sportsFee: number;
  computerFee: number;
  otherFees: { name: string; amount: number }[];

  totalFees: number;

  // Dates
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstallmentRule {
  id: string;
  schoolId: string;
  name: string;
  description?: string;

  // Installment breakdown
  installments: {
    name: string;
    percentage: number;
    dueDate: Date;
  }[];

  isDefault: boolean;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface Term {
  id: string;
  schoolId: string;
  name: string;
  academicYear: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  level: number; // For ordering (e.g., P1=1, P2=2, S1=7, etc.)
  section?: string;
  teacherId?: string;
  teacherName?: string;
  studentCount: number;
  isActive: boolean;
}

export interface UserSettings {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  dashboardLayout: "default" | "compact" | "detailed";
}

// ============================================================================
// SCHOOL SETTINGS
// ============================================================================

/**
 * Get school settings
 */
export async function getSchoolSettings(
  schoolId: string,
): Promise<SchoolSettings | null> {
  return fetchDocument<SchoolSettings>(COLLECTIONS.SETTINGS, schoolId);
}

/**
 * Update school settings
 */
export async function updateSchoolSettings(
  schoolId: string,
  settings: Partial<SchoolSettings>,
  userId: string,
): Promise<void> {
  const current = await getSchoolSettings(schoolId);

  await updateDocument(COLLECTIONS.SETTINGS, schoolId, {
    ...settings,
    updatedAt: new Date(),
    updatedBy: userId,
  });

  await logAuditAction("UPDATE", COLLECTIONS.SETTINGS, schoolId, userId, {
    before: current,
    after: settings,
  });
}

/**
 * Initialize default school settings
 */
export async function initializeSchoolSettings(
  schoolId: string,
  schoolName: string,
  userId: string,
): Promise<void> {
  const defaultSettings: SchoolSettings = {
    id: schoolId,
    schoolId,
    schoolName,
    address: "",
    phone: "",
    email: "",
    currency: "UGX",
    currencySymbol: "UGX",
    currentTermId: "",
    currentTermName: "",
    academicYear: new Date().getFullYear().toString(),
    smsEnabled: false,
    emailEnabled: false,
    allowPartialPayments: true,
    minimumPaymentAmount: 10000,
    lateFeePercentage: 0,
    gracePeriodDays: 14,
    receiptPrefix: "RCP",
    showBalanceOnReceipt: true,
    stellarEnabled: false,
    updatedAt: new Date(),
    updatedBy: userId,
  };

  await saveDocument(COLLECTIONS.SETTINGS, schoolId, defaultSettings);
}

/**
 * Subscribe to school settings changes
 */
export function subscribeToSchoolSettings(
  schoolId: string,
  onData: (settings: SchoolSettings | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToDocument<SchoolSettings>(
    COLLECTIONS.SETTINGS,
    schoolId,
    onData,
    onError,
  );
}

// ============================================================================
// FEE STRUCTURES
// ============================================================================

/**
 * Get fee structure for a class and term
 */
export async function getFeeStructure(
  schoolId: string,
  classId: string,
  termId: string,
): Promise<FeeStructure | null> {
  const structures = await fetchCollection<FeeStructure>(
    COLLECTIONS.FEE_STRUCTURES,
    [
      where("schoolId", "==", schoolId),
      where("classId", "==", classId),
      where("termId", "==", termId),
    ],
  );
  return structures[0] || null;
}

/**
 * Get all fee structures for a term
 */
export async function getFeeStructures(
  schoolId: string,
  termId: string,
): Promise<FeeStructure[]> {
  return fetchCollection<FeeStructure>(COLLECTIONS.FEE_STRUCTURES, [
    where("schoolId", "==", schoolId),
    where("termId", "==", termId),
    orderBy("className", "asc"),
  ]);
}

/**
 * Save fee structure
 */
export async function saveFeeStructure(
  structure: Omit<FeeStructure, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  const structureId = `FEE-${structure.schoolId}-${structure.classId}-${structure.termId}`;

  await saveDocument(COLLECTIONS.FEE_STRUCTURES, structureId, {
    ...structure,
    id: structureId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await logAuditAction(
    "CREATE",
    COLLECTIONS.FEE_STRUCTURES,
    structureId,
    userId,
    { className: structure.className, totalFees: structure.totalFees },
  );

  return structureId;
}

/**
 * Update fee structure
 */
export async function updateFeeStructure(
  structureId: string,
  updates: Partial<FeeStructure>,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.FEE_STRUCTURES, structureId, {
    ...updates,
    updatedAt: new Date(),
  });

  await logAuditAction(
    "UPDATE",
    COLLECTIONS.FEE_STRUCTURES,
    structureId,
    userId,
    updates,
  );
}

// ============================================================================
// INSTALLMENT RULES
// ============================================================================

/**
 * Get all installment rules for a school
 */
export async function getInstallmentRules(
  schoolId: string,
): Promise<InstallmentRule[]> {
  return fetchCollection<InstallmentRule>(COLLECTIONS.INSTALLMENT_RULES, [
    where("schoolId", "==", schoolId),
    where("isActive", "==", true),
    orderBy("name", "asc"),
  ]);
}

/**
 * Get default installment rule
 */
export async function getDefaultInstallmentRule(
  schoolId: string,
): Promise<InstallmentRule | null> {
  const rules = await fetchCollection<InstallmentRule>(
    COLLECTIONS.INSTALLMENT_RULES,
    [
      where("schoolId", "==", schoolId),
      where("isDefault", "==", true),
      where("isActive", "==", true),
    ],
  );
  return rules[0] || null;
}

/**
 * Save installment rule
 */
export async function saveInstallmentRule(
  rule: Omit<InstallmentRule, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  const ruleId = `INST-${Date.now()}`;

  // If this is default, unset other defaults
  if (rule.isDefault) {
    const existingRules = await getInstallmentRules(rule.schoolId);
    const updates = existingRules
      .filter((r) => r.isDefault)
      .map((r) => ({
        type: "update" as const,
        collection: COLLECTIONS.INSTALLMENT_RULES,
        docId: r.id,
        data: { isDefault: false },
      }));

    if (updates.length > 0) {
      await batchWrite(updates);
    }
  }

  await saveDocument(COLLECTIONS.INSTALLMENT_RULES, ruleId, {
    ...rule,
    id: ruleId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await logAuditAction(
    "CREATE",
    COLLECTIONS.INSTALLMENT_RULES,
    ruleId,
    userId,
    { name: rule.name },
  );

  return ruleId;
}

/**
 * Delete installment rule
 */
export async function deleteInstallmentRule(
  ruleId: string,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.INSTALLMENT_RULES, ruleId, {
    isActive: false,
    updatedAt: new Date(),
  });

  await logAuditAction(
    "DELETE",
    COLLECTIONS.INSTALLMENT_RULES,
    ruleId,
    userId,
    {},
  );
}

// ============================================================================
// TERMS
// ============================================================================

/**
 * Get all terms for a school
 */
export async function getTerms(schoolId: string): Promise<Term[]> {
  return fetchCollection<Term>(COLLECTIONS.TERMS, [
    where("schoolId", "==", schoolId),
    orderBy("startDate", "desc"),
  ]);
}

/**
 * Get current term
 */
export async function getCurrentTerm(schoolId: string): Promise<Term | null> {
  const terms = await fetchCollection<Term>(COLLECTIONS.TERMS, [
    where("schoolId", "==", schoolId),
    where("isCurrent", "==", true),
  ]);
  return terms[0] || null;
}

/**
 * Create new term
 */
export async function createTerm(
  term: Omit<Term, "id" | "createdAt">,
  userId: string,
): Promise<string> {
  const termId = `TERM-${term.schoolId}-${Date.now()}`;

  // If this is current, unset other current terms
  if (term.isCurrent) {
    const existingTerms = await getTerms(term.schoolId);
    const updates = existingTerms
      .filter((t) => t.isCurrent)
      .map((t) => ({
        type: "update" as const,
        collection: COLLECTIONS.TERMS,
        docId: t.id,
        data: { isCurrent: false },
      }));

    if (updates.length > 0) {
      await batchWrite(updates);
    }
  }

  await saveDocument(COLLECTIONS.TERMS, termId, {
    ...term,
    id: termId,
    createdAt: new Date(),
  });

  // Update school settings with current term
  if (term.isCurrent) {
    await updateDocument(COLLECTIONS.SETTINGS, term.schoolId, {
      currentTermId: termId,
      currentTermName: term.name,
      academicYear: term.academicYear,
    });
  }

  await logAuditAction("CREATE", COLLECTIONS.TERMS, termId, userId, {
    termName: term.name,
  });

  return termId;
}

/**
 * Set current term
 */
export async function setCurrentTerm(
  schoolId: string,
  termId: string,
  userId: string,
): Promise<void> {
  // Unset all current terms
  const terms = await getTerms(schoolId);
  const updates = terms.map((t) => ({
    type: "update" as const,
    collection: COLLECTIONS.TERMS,
    docId: t.id,
    data: { isCurrent: t.id === termId },
  }));

  await batchWrite(updates);

  // Update school settings
  const term = terms.find((t) => t.id === termId);
  if (term) {
    await updateDocument(COLLECTIONS.SETTINGS, schoolId, {
      currentTermId: termId,
      currentTermName: term.name,
      academicYear: term.academicYear,
    });
  }

  await logAuditAction("UPDATE", COLLECTIONS.TERMS, termId, userId, {
    action: "set_current",
  });
}

// ============================================================================
// CLASSES
// ============================================================================

/**
 * Get all classes for a school
 */
export async function getClasses(schoolId: string): Promise<SchoolClass[]> {
  return fetchCollection<SchoolClass>(COLLECTIONS.CLASSES, [
    where("schoolId", "==", schoolId),
    where("isActive", "==", true),
    orderBy("level", "asc"),
  ]);
}

/**
 * Create class
 */
export async function createClass(
  classData: Omit<SchoolClass, "id" | "studentCount">,
  userId: string,
): Promise<string> {
  const classId = `CLASS-${classData.schoolId}-${Date.now()}`;

  await saveDocument(COLLECTIONS.CLASSES, classId, {
    ...classData,
    id: classId,
    studentCount: 0,
  });

  await logAuditAction("CREATE", COLLECTIONS.CLASSES, classId, userId, {
    className: classData.name,
  });

  return classId;
}

/**
 * Update class
 */
export async function updateClass(
  classId: string,
  updates: Partial<SchoolClass>,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.CLASSES, classId, updates);

  await logAuditAction("UPDATE", COLLECTIONS.CLASSES, classId, userId, updates);
}

/**
 * Delete class (soft delete)
 */
export async function deleteClass(
  classId: string,
  userId: string,
): Promise<void> {
  await updateDocument(COLLECTIONS.CLASSES, classId, { isActive: false });

  await logAuditAction("DELETE", COLLECTIONS.CLASSES, classId, userId, {});
}

// ============================================================================
// USER SETTINGS
// ============================================================================

/**
 * Get user settings
 */
export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  return fetchDocument<UserSettings>(`${COLLECTIONS.SETTINGS}/users`, userId);
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>,
): Promise<void> {
  await saveDocument(`${COLLECTIONS.SETTINGS}/users`, userId, {
    ...settings,
    userId,
    updatedAt: new Date(),
  });
}

// ============================================================================
// SCHOOL ONBOARDING
// ============================================================================

export interface OnboardingProgress {
  schoolId: string;
  steps: {
    basicInfo: boolean;
    classes: boolean;
    terms: boolean;
    feeStructure: boolean;
    students: boolean;
    users: boolean;
    integrations: boolean;
  };
  completedAt?: Date;
  currentStep: number;
}

/**
 * Get onboarding progress
 */
export async function getOnboardingProgress(
  schoolId: string,
): Promise<OnboardingProgress | null> {
  return fetchDocument<OnboardingProgress>(
    `${COLLECTIONS.SETTINGS}/onboarding`,
    schoolId,
  );
}

/**
 * Update onboarding progress
 */
export async function updateOnboardingProgress(
  schoolId: string,
  step: keyof OnboardingProgress["steps"],
  userId: string,
): Promise<void> {
  const current = await getOnboardingProgress(schoolId);

  const updatedSteps = {
    ...(current?.steps || {
      basicInfo: false,
      classes: false,
      terms: false,
      feeStructure: false,
      students: false,
      users: false,
      integrations: false,
    }),
    [step]: true,
  };

  const allComplete = Object.values(updatedSteps).every(Boolean);

  await saveDocument(`${COLLECTIONS.SETTINGS}/onboarding`, schoolId, {
    schoolId,
    steps: updatedSteps,
    currentStep: Object.values(updatedSteps).filter(Boolean).length,
    ...(allComplete ? { completedAt: new Date() } : {}),
  });

  await logAuditAction("UPDATE", "onboarding", schoolId, userId, {
    step,
    completed: true,
  });
}
