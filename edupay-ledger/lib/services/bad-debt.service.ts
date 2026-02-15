/**
 * Bad Debt Write-off Service
 * Handles write-off requests and approval workflow
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  BadDebtWriteOff,
  WriteOffStatus,
  WriteOffReason,
  WriteOffDocument,
  WriteOffFeeItem,
  CollectionAttempt,
  StatusChange,
  ApprovalRecord,
  BOGAuthorizationRecord,
  WriteOffPolicyConfig,
  CreateWriteOffInput,
  WriteOffQuery,
  WriteOffApprovalInput,
  WriteOffSummary,
  WriteOffByReason,
  WriteOffByClass,
  MonthlyWriteOff,
  getReasonDisplay,
  getRequiredApprovalLevel,
  canSubmitWriteOff,
} from '@/types/bad-debt';

// ============================================================================
// CONSTANTS
// ============================================================================

const WRITEOFFS_COLLECTION = 'badDebtWriteOffs';
const WRITEOFF_POLICY_COLLECTION = 'writeOffPolicies';
const STUDENTS_COLLECTION = 'students';

// ============================================================================
// WRITE-OFF CRUD
// ============================================================================

/**
 * Create a new write-off request
 */
export async function createWriteOffRequest(
  input: CreateWriteOffInput
): Promise<BadDebtWriteOff> {
  // Get student details
  const studentDoc = await getDoc(doc(db, STUDENTS_COLLECTION, input.studentId));
  if (!studentDoc.exists()) {
    throw new Error('Student not found');
  }
  const student = studentDoc.data();
  
  // Get policy config
  const policyConfig = await getWriteOffPolicy(input.schoolId);
  
  const now = Timestamp.now();
  const docRef = doc(collection(db, WRITEOFFS_COLLECTION));
  
  // Calculate remaining balance after write-off
  const remainingBalance = student.balance - input.writeOffAmount;
  
  // Determine if BOG approval is needed
  const requiresBOG = input.writeOffAmount >= policyConfig.bogApprovalThreshold;
  
  const writeOff: BadDebtWriteOff = {
    id: docRef.id,
    schoolId: input.schoolId,
    
    // Student info
    studentId: input.studentId,
    studentName: `${student.firstName} ${student.lastName}`,
    className: student.className,
    guardianName: student.guardian?.name || 'Unknown',
    guardianPhone: student.guardian?.phone || '',
    
    // Balances
    originalBalance: student.balance,
    arrearsAmount: student.arrearsAmount || student.balance,
    currentTermBalance: student.currentTermBalance || 0,
    
    // Write-off details
    writeOffType: input.writeOffType,
    writeOffAmount: input.writeOffAmount,
    remainingBalance: Math.max(0, remainingBalance),
    
    // Reason
    reason: input.reason,
    reasonDisplay: getReasonDisplay(input.reason),
    detailedExplanation: input.detailedExplanation,
    supportingDocuments: [],
    
    // Fee breakdown
    feeBreakdown: input.feeBreakdown.map(item => ({
      ...item,
      remainingAmount: item.originalAmount - item.paidAmount - item.writeOffAmount,
    })),
    
    // Collection attempts (to be added)
    collectionAttempts: [],
    totalCollectionAttempts: 0,
    lastContactDate: null,
    
    // Workflow
    status: 'draft',
    statusHistory: [
      {
        from: 'draft' as WriteOffStatus,
        to: 'draft',
        changedBy: input.requestedBy,
        changedByName: input.requestedByName,
        changedAt: now,
        reason: 'Created',
      },
    ],
    currentApprover: null,
    
    // Approvals
    requestedBy: input.requestedBy,
    requestedByName: input.requestedByName,
    requestedAt: now,
    
    // BOG
    requiresBOGApproval: requiresBOG,
    bogThreshold: policyConfig.bogApprovalThreshold,
    
    // Metadata
    createdAt: now,
    updatedAt: now,
    fiscalYear: new Date().getFullYear().toString(),
    term: getCurrentTerm(),
  };
  
  await setDoc(docRef, writeOff);
  return writeOff;
}

/**
 * Get a single write-off by ID
 */
export async function getWriteOff(writeOffId: string): Promise<BadDebtWriteOff | null> {
  const docRef = doc(db, WRITEOFFS_COLLECTION, writeOffId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return snapshot.data() as BadDebtWriteOff;
}

/**
 * Query write-offs
 */
export async function queryWriteOffs(
  queryParams: WriteOffQuery
): Promise<BadDebtWriteOff[]> {
  let q = query(
    collection(db, WRITEOFFS_COLLECTION),
    where('schoolId', '==', queryParams.schoolId),
    orderBy('createdAt', 'desc')
  );
  
  if (queryParams.status) {
    q = query(q, where('status', '==', queryParams.status));
  }
  
  if (queryParams.reason) {
    q = query(q, where('reason', '==', queryParams.reason));
  }
  
  if (queryParams.studentId) {
    q = query(q, where('studentId', '==', queryParams.studentId));
  }
  
  if (queryParams.pendingApproval) {
    q = query(q, where('status', 'in', ['pending_bursar', 'pending_head', 'pending_bog']));
  }
  
  if (queryParams.limit) {
    q = query(q, limit(queryParams.limit));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as BadDebtWriteOff);
}

/**
 * Get write-offs pending user's approval
 */
export async function getPendingApprovals(
  schoolId: string,
  userRole: 'bursar' | 'headteacher' | 'bog'
): Promise<BadDebtWriteOff[]> {
  const statusMap = {
    bursar: 'pending_bursar',
    headteacher: 'pending_head',
    bog: 'pending_bog',
  };
  
  return queryWriteOffs({
    schoolId,
    status: statusMap[userRole] as WriteOffStatus,
  });
}

// ============================================================================
// WORKFLOW ACTIONS
// ============================================================================

/**
 * Submit write-off for approval
 */
export async function submitWriteOff(
  writeOffId: string,
  submittedBy: string,
  submittedByName: string
): Promise<BadDebtWriteOff> {
  const writeOff = await getWriteOff(writeOffId);
  if (!writeOff) throw new Error('Write-off not found');
  
  if (writeOff.status !== 'draft') {
    throw new Error('Write-off is not in draft status');
  }
  
  const policy = await getWriteOffPolicy(writeOff.schoolId);
  const validation = canSubmitWriteOff(writeOff, policy);
  
  if (!validation.canSubmit) {
    throw new Error(`Cannot submit: ${validation.reasons.join('; ')}`);
  }
  
  const now = Timestamp.now();
  const newStatus: WriteOffStatus = 'pending_bursar';
  
  const statusChange: StatusChange = {
    from: writeOff.status,
    to: newStatus,
    changedBy: submittedBy,
    changedByName: submittedByName,
    changedAt: now,
    reason: 'Submitted for approval',
  };
  
  await updateDoc(doc(db, WRITEOFFS_COLLECTION, writeOffId), {
    status: newStatus,
    statusHistory: [...writeOff.statusHistory, statusChange],
    updatedAt: now,
  });
  
  return { ...writeOff, status: newStatus };
}

/**
 * Process approval decision
 */
export async function processApproval(
  input: WriteOffApprovalInput
): Promise<BadDebtWriteOff> {
  const writeOff = await getWriteOff(input.writeOffId);
  if (!writeOff) throw new Error('Write-off not found');
  
  const now = Timestamp.now();
  let newStatus: WriteOffStatus;
  let updates: Partial<BadDebtWriteOff> = {};
  
  const approvalRecord: ApprovalRecord = {
    approverId: input.approverId,
    approverName: input.approverName,
    approverRole: input.approverRole,
    decision: input.decision,
    decisionAt: now,
    comments: input.comments,
    conditions: input.conditions,
  };
  
  if (input.decision === 'rejected') {
    newStatus = 'rejected';
  } else if (input.decision === 'returned') {
    newStatus = 'draft';
  } else {
    // Approved - determine next step
    switch (input.approverRole) {
      case 'bursar':
        updates.bursarReview = approvalRecord;
        if (writeOff.writeOffAmount >= writeOff.bogThreshold) {
          newStatus = 'pending_head';
        } else {
          // Check if HT approval needed
          const policy = await getWriteOffPolicy(writeOff.schoolId);
          if (writeOff.writeOffAmount >= policy.headteacherApprovalThreshold) {
            newStatus = 'pending_head';
          } else {
            newStatus = 'approved';
          }
        }
        break;
        
      case 'headteacher':
        updates.headteacherApproval = approvalRecord;
        if (writeOff.requiresBOGApproval) {
          newStatus = 'pending_bog';
        } else {
          newStatus = 'approved';
        }
        break;
        
      case 'bog':
        const bogRecord: BOGAuthorizationRecord = {
          ...approvalRecord,
          meetingDate: input.meetingDate!,
          meetingMinutesRef: input.meetingMinutesRef!,
          boardResolutionNumber: input.boardResolutionNumber!,
        };
        updates.bogAuthorization = bogRecord;
        newStatus = 'approved';
        break;
        
      default:
        throw new Error('Invalid approver role');
    }
  }
  
  const statusChange: StatusChange = {
    from: writeOff.status,
    to: newStatus,
    changedBy: input.approverId,
    changedByName: input.approverName,
    changedAt: now,
    reason: `${input.decision} by ${input.approverRole}`,
  };
  
  await updateDoc(doc(db, WRITEOFFS_COLLECTION, input.writeOffId), {
    status: newStatus,
    statusHistory: [...writeOff.statusHistory, statusChange],
    ...updates,
    updatedAt: now,
  });
  
  return { ...writeOff, status: newStatus, ...updates };
}

/**
 * Apply approved write-off to student account
 */
export async function applyWriteOff(
  writeOffId: string,
  appliedBy: string
): Promise<void> {
  const writeOff = await getWriteOff(writeOffId);
  if (!writeOff) throw new Error('Write-off not found');
  
  if (writeOff.status !== 'approved') {
    throw new Error('Write-off is not approved');
  }
  
  const now = Timestamp.now();
  
  // Update student balance
  const studentRef = doc(db, STUDENTS_COLLECTION, writeOff.studentId);
  const studentDoc = await getDoc(studentRef);
  
  if (studentDoc.exists()) {
    const student = studentDoc.data();
    await updateDoc(studentRef, {
      balance: Math.max(0, student.balance - writeOff.writeOffAmount),
      totalWriteOffs: (student.totalWriteOffs || 0) + writeOff.writeOffAmount,
      lastWriteOffDate: now,
    });
  }
  
  // Update write-off status
  const statusChange: StatusChange = {
    from: writeOff.status,
    to: 'applied',
    changedBy: appliedBy,
    changedByName: appliedBy,
    changedAt: now,
    reason: 'Write-off applied to student account',
  };
  
  await updateDoc(doc(db, WRITEOFFS_COLLECTION, writeOffId), {
    status: 'applied',
    statusHistory: [...writeOff.statusHistory, statusChange],
    appliedAt: now,
    appliedBy,
    updatedAt: now,
  });
}

// ============================================================================
// COLLECTION ATTEMPTS
// ============================================================================

/**
 * Add a collection attempt record
 */
export async function addCollectionAttempt(
  writeOffId: string,
  attempt: Omit<CollectionAttempt, 'id'>
): Promise<void> {
  const writeOff = await getWriteOff(writeOffId);
  if (!writeOff) throw new Error('Write-off not found');
  
  const newAttempt: CollectionAttempt = {
    ...attempt,
    id: Date.now().toString(),
  };
  
  await updateDoc(doc(db, WRITEOFFS_COLLECTION, writeOffId), {
    collectionAttempts: [...writeOff.collectionAttempts, newAttempt],
    totalCollectionAttempts: writeOff.totalCollectionAttempts + 1,
    lastContactDate: attempt.date,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// DOCUMENTS
// ============================================================================

/**
 * Add supporting document
 */
export async function addSupportingDocument(
  writeOffId: string,
  document: Omit<WriteOffDocument, 'id'>
): Promise<void> {
  const writeOff = await getWriteOff(writeOffId);
  if (!writeOff) throw new Error('Write-off not found');
  
  const newDoc: WriteOffDocument = {
    ...document,
    id: Date.now().toString(),
  };
  
  await updateDoc(doc(db, WRITEOFFS_COLLECTION, writeOffId), {
    supportingDocuments: [...writeOff.supportingDocuments, newDoc],
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// POLICY
// ============================================================================

/**
 * Get write-off policy for school
 */
export async function getWriteOffPolicy(
  schoolId: string
): Promise<WriteOffPolicyConfig> {
  const docRef = doc(db, WRITEOFF_POLICY_COLLECTION, schoolId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return snapshot.data() as WriteOffPolicyConfig;
  }
  
  // Return defaults
  return getDefaultPolicy(schoolId);
}

/**
 * Save write-off policy
 */
export async function saveWriteOffPolicy(
  policy: WriteOffPolicyConfig
): Promise<void> {
  const docRef = doc(db, WRITEOFF_POLICY_COLLECTION, policy.schoolId);
  await setDoc(docRef, {
    ...policy,
    updatedAt: Timestamp.now(),
  });
}

function getDefaultPolicy(schoolId: string): WriteOffPolicyConfig {
  return {
    schoolId,
    bursarApprovalThreshold: 100000,        // Up to 100k
    headteacherApprovalThreshold: 500000,   // Up to 500k
    bogApprovalThreshold: 1000000,          // Above 1M needs BOG
    requiredDocuments: {
      orphaned: ['lc_letter', 'social_worker_report'],
      guardian_deceased: ['death_certificate', 'lc_letter'],
      guardian_unable: ['guardian_statement', 'lc_letter'],
      family_displaced: ['police_report', 'lc_letter'],
      student_dropout: ['guardian_statement'],
      student_transferred: ['guardian_statement'],
      student_deceased: ['death_certificate'],
      disputed_fees: ['school_committee_minutes'],
      administrative_error: ['school_committee_minutes'],
      scholarship_reversal: ['school_committee_minutes'],
      hardship: ['guardian_statement', 'lc_letter'],
      other: ['guardian_statement'],
    },
    minimumCollectionAttempts: 3,
    minimumDaysOverdue: 90,
    annualWriteOffBudget: 5000000,
    annualWriteOffUsed: 0,
    requireJournalEntry: true,
    requireExternalAuditReview: true,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}

// ============================================================================
// REPORTS
// ============================================================================

/**
 * Get write-off summary for reporting
 */
export async function getWriteOffSummary(
  schoolId: string,
  fiscalYear: string
): Promise<WriteOffSummary> {
  const writeOffs = await queryWriteOffs({ schoolId });
  const yearWriteOffs = writeOffs.filter(w => w.fiscalYear === fiscalYear);
  
  // Calculate totals
  const appliedWriteOffs = yearWriteOffs.filter(w => w.status === 'applied');
  const totalAmountWrittenOff = appliedWriteOffs.reduce((sum, w) => sum + w.writeOffAmount, 0);
  const uniqueStudents = new Set(appliedWriteOffs.map(w => w.studentId));
  
  // By status
  const byStatus: Record<WriteOffStatus, { count: number; amount: number }> = {
    draft: { count: 0, amount: 0 },
    pending_bursar: { count: 0, amount: 0 },
    pending_head: { count: 0, amount: 0 },
    pending_bog: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    applied: { count: 0, amount: 0 },
    reversed: { count: 0, amount: 0 },
  };
  
  for (const wo of yearWriteOffs) {
    byStatus[wo.status].count++;
    byStatus[wo.status].amount += wo.writeOffAmount;
  }
  
  // By reason
  const reasonMap = new Map<WriteOffReason, { count: number; amount: number }>();
  for (const wo of appliedWriteOffs) {
    const existing = reasonMap.get(wo.reason) || { count: 0, amount: 0 };
    existing.count++;
    existing.amount += wo.writeOffAmount;
    reasonMap.set(wo.reason, existing);
  }
  
  const byReason: WriteOffByReason[] = Array.from(reasonMap.entries()).map(([reason, data]) => ({
    reason,
    reasonDisplay: getReasonDisplay(reason),
    count: data.count,
    totalAmount: data.amount,
    percentage: totalAmountWrittenOff > 0 ? (data.amount / totalAmountWrittenOff) * 100 : 0,
  }));
  
  // By class
  const classMap = new Map<string, { count: number; amount: number; students: Set<string> }>();
  for (const wo of appliedWriteOffs) {
    const existing = classMap.get(wo.className) || { count: 0, amount: 0, students: new Set() };
    existing.count++;
    existing.amount += wo.writeOffAmount;
    existing.students.add(wo.studentId);
    classMap.set(wo.className, existing);
  }
  
  const byClass: WriteOffByClass[] = Array.from(classMap.entries()).map(([className, data]) => ({
    className,
    count: data.count,
    totalAmount: data.amount,
    studentsAffected: data.students.size,
  }));
  
  const policy = await getWriteOffPolicy(schoolId);
  
  return {
    schoolId,
    fiscalYear,
    asOfDate: new Date(),
    totalWriteOffsApproved: appliedWriteOffs.length,
    totalAmountWrittenOff,
    totalStudentsAffected: uniqueStudents.size,
    byStatus,
    byReason,
    byClass,
    annualBudget: policy.annualWriteOffBudget,
    budgetUsedPercent: (totalAmountWrittenOff / policy.annualWriteOffBudget) * 100,
    remainingBudget: Math.max(0, policy.annualWriteOffBudget - totalAmountWrittenOff),
    monthlyTrend: [], // Would calculate from data
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getCurrentTerm(): number {
  const month = new Date().getMonth();
  if (month >= 1 && month <= 4) return 1;  // Feb-Apr
  if (month >= 5 && month <= 8) return 2;  // May-Aug
  return 3; // Sep-Dec
}

// ============================================================================
// MOCK DATA
// ============================================================================

export function getMockWriteOff(): BadDebtWriteOff {
  const now = Timestamp.now();
  
  return {
    id: 'wo-001',
    schoolId: 'school-001',
    studentId: 'stu-050',
    studentName: 'Nakato Christine',
    className: 'S.3 Red',
    guardianName: 'Nakato Margaret (Grandmother)',
    guardianPhone: '+256772555555',
    originalBalance: 1200000,
    arrearsAmount: 1200000,
    currentTermBalance: 0,
    writeOffType: 'full',
    writeOffAmount: 1200000,
    remainingBalance: 0,
    reason: 'orphaned',
    reasonDisplay: 'Student Orphaned',
    detailedExplanation: 'Both parents passed away in 2024. Student is now under the care of elderly grandmother who is unable to pay school fees. Grandmother survives on subsistence farming and cannot afford the fees. Student is a top performer and we recommend full write-off to enable her to continue education.',
    supportingDocuments: [
      {
        id: 'doc-001',
        type: 'death_certificate',
        typeDisplay: 'Death Certificate',
        fileName: 'death_cert_father.pdf',
        fileUrl: '/documents/death_cert_father.pdf',
        uploadedBy: 'user-001',
        uploadedAt: now,
        verified: true,
        verifiedBy: 'user-002',
      },
      {
        id: 'doc-002',
        type: 'lc_letter',
        typeDisplay: 'LC Letter',
        fileName: 'lc_confirmation.pdf',
        fileUrl: '/documents/lc_confirmation.pdf',
        uploadedBy: 'user-001',
        uploadedAt: now,
        verified: true,
        verifiedBy: 'user-002',
      },
    ],
    feeBreakdown: [
      { categoryId: 'cat-001', categoryName: 'Tuition Fees', originalAmount: 900000, paidAmount: 0, writeOffAmount: 900000, remainingAmount: 0 },
      { categoryId: 'cat-002', categoryName: 'Exam Fees', originalAmount: 150000, paidAmount: 0, writeOffAmount: 150000, remainingAmount: 0 },
      { categoryId: 'cat-003', categoryName: 'Development Levy', originalAmount: 150000, paidAmount: 0, writeOffAmount: 150000, remainingAmount: 0 },
    ],
    collectionAttempts: [
      {
        id: 'att-001',
        date: new Date('2025-09-15'),
        type: 'phone_call',
        typeDisplay: 'Phone Call',
        contactedBy: 'Sarah Nambi',
        outcome: 'unable',
        outcomeDisplay: 'Unable to Pay',
        notes: 'Grandmother confirmed she cannot afford fees. Requested assistance.',
      },
      {
        id: 'att-002',
        date: new Date('2025-10-01'),
        type: 'home_visit',
        typeDisplay: 'Home Visit',
        contactedBy: 'John Okello',
        outcome: 'unable',
        outcomeDisplay: 'Unable to Pay',
        notes: 'Confirmed family situation. Grandmother is elderly and has no source of income.',
      },
      {
        id: 'att-003',
        date: new Date('2025-11-15'),
        type: 'guardian_meeting',
        typeDisplay: 'Guardian Meeting',
        contactedBy: 'Sarah Nambi',
        outcome: 'unable',
        outcomeDisplay: 'Unable to Pay',
        notes: 'Met with grandmother at school. She pleaded for assistance as she cannot pay.',
      },
    ],
    totalCollectionAttempts: 3,
    lastContactDate: new Date('2025-11-15'),
    status: 'pending_bog',
    statusHistory: [
      { from: 'draft', to: 'draft', changedBy: 'user-001', changedByName: 'Sarah Nambi', changedAt: now, reason: 'Created' },
      { from: 'draft', to: 'pending_bursar', changedBy: 'user-001', changedByName: 'Sarah Nambi', changedAt: now, reason: 'Submitted' },
      { from: 'pending_bursar', to: 'pending_head', changedBy: 'user-002', changedByName: 'Peter Ochieng', changedAt: now, reason: 'Approved by bursar' },
      { from: 'pending_head', to: 'pending_bog', changedBy: 'user-003', changedByName: 'Dr. Rose Atim', changedAt: now, reason: 'Approved by headteacher' },
    ],
    currentApprover: 'BOG Chairman',
    requestedBy: 'user-001',
    requestedByName: 'Sarah Nambi',
    requestedAt: now,
    bursarReview: {
      approverId: 'user-002',
      approverName: 'Peter Ochieng',
      approverRole: 'bursar',
      decision: 'approved',
      decisionAt: now,
      comments: 'Documentation verified. Recommend approval.',
    },
    headteacherApproval: {
      approverId: 'user-003',
      approverName: 'Dr. Rose Atim',
      approverRole: 'headteacher',
      decision: 'approved',
      decisionAt: now,
      comments: 'Student is a brilliant performer. We should support her education.',
    },
    requiresBOGApproval: true,
    bogThreshold: 1000000,
    createdAt: now,
    updatedAt: now,
    fiscalYear: '2026',
    term: 1,
  };
}

export function getMockWriteOffSummary(): WriteOffSummary {
  return {
    schoolId: 'school-001',
    fiscalYear: '2026',
    asOfDate: new Date(),
    totalWriteOffsApproved: 8,
    totalAmountWrittenOff: 4500000,
    totalStudentsAffected: 8,
    byStatus: {
      draft: { count: 2, amount: 800000 },
      pending_bursar: { count: 1, amount: 350000 },
      pending_head: { count: 1, amount: 600000 },
      pending_bog: { count: 1, amount: 1200000 },
      approved: { count: 0, amount: 0 },
      rejected: { count: 2, amount: 450000 },
      applied: { count: 8, amount: 4500000 },
      reversed: { count: 0, amount: 0 },
    },
    byReason: [
      { reason: 'orphaned', reasonDisplay: 'Student Orphaned', count: 3, totalAmount: 2100000, percentage: 46.7 },
      { reason: 'guardian_unable', reasonDisplay: 'Guardian Financially Unable', count: 3, totalAmount: 1500000, percentage: 33.3 },
      { reason: 'student_dropout', reasonDisplay: 'Student Dropped Out', count: 2, totalAmount: 900000, percentage: 20.0 },
    ],
    byClass: [
      { className: 'S.4 Blue', count: 2, totalAmount: 1500000, studentsAffected: 2 },
      { className: 'S.3 Red', count: 3, totalAmount: 1800000, studentsAffected: 3 },
      { className: 'S.2 Green', count: 2, totalAmount: 800000, studentsAffected: 2 },
      { className: 'S.1 Yellow', count: 1, totalAmount: 400000, studentsAffected: 1 },
    ],
    annualBudget: 5000000,
    budgetUsedPercent: 90.0,
    remainingBudget: 500000,
    monthlyTrend: [
      { month: '2026-01', monthDisplay: 'Jan 2026', count: 2, amount: 1200000, approvedCount: 2, rejectedCount: 0 },
      { month: '2026-02', monthDisplay: 'Feb 2026', count: 3, amount: 1800000, approvedCount: 2, rejectedCount: 1 },
    ],
  };
}
