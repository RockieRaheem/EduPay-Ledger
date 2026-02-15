/**
 * Receipt Book Service
 * Manages physical receipt book tracking for Ugandan schools
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
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  ReceiptBook,
  ReceiptBookStatus,
  PhysicalReceipt,
  PhysicalReceiptStatus,
  CreateReceiptBookInput,
  IssueReceiptInput,
  ReceiptBookSummary,
  CashDenomination,
  amountToWords,
  formatReceiptNumber,
  calculateDenominationTotal,
} from '@/types/receipt-book';

// ============================================================================
// CONSTANTS
// ============================================================================

const RECEIPT_BOOKS_COLLECTION = 'receiptBooks';
const PHYSICAL_RECEIPTS_COLLECTION = 'physicalReceipts';

// ============================================================================
// RECEIPT BOOK MANAGEMENT
// ============================================================================

/**
 * Create a new receipt book
 */
export async function createReceiptBook(
  input: CreateReceiptBookInput,
  createdBy: string
): Promise<ReceiptBook> {
  const docRef = doc(collection(db, RECEIPT_BOOKS_COLLECTION));
  const now = Timestamp.now();
  
  const totalReceipts = input.endNumber - input.startNumber + 1;
  
  const receiptBook: ReceiptBook = {
    id: docRef.id,
    schoolId: input.schoolId,
    bookNumber: input.bookNumber,
    prefix: input.prefix.toUpperCase(),
    startNumber: input.startNumber,
    endNumber: input.endNumber,
    totalReceipts,
    currentNumber: input.startNumber,
    usedCount: 0,
    voidedCount: 0,
    remainingCount: totalReceipts,
    assignedTo: input.assignedTo || '',
    assignedToName: '',
    assignedAt: now,
    assignedBy: createdBy,
    status: input.assignedTo ? 'assigned' : 'pending',
    createdAt: now,
    updatedAt: now,
    createdBy,
    notes: input.notes,
  };
  
  await setDoc(docRef, receiptBook);
  return receiptBook;
}

/**
 * Assign a receipt book to a bursar
 */
export async function assignReceiptBook(
  bookId: string,
  assignedTo: string,
  assignedToName: string,
  assignedBy: string
): Promise<void> {
  const docRef = doc(db, RECEIPT_BOOKS_COLLECTION, bookId);
  await updateDoc(docRef, {
    assignedTo,
    assignedToName,
    assignedAt: Timestamp.now(),
    assignedBy,
    status: 'assigned',
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get receipt book by ID
 */
export async function getReceiptBook(bookId: string): Promise<ReceiptBook | null> {
  const docRef = doc(db, RECEIPT_BOOKS_COLLECTION, bookId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as ReceiptBook) : null;
}

/**
 * Get all receipt books for a school
 */
export async function getReceiptBooks(
  schoolId: string,
  status?: ReceiptBookStatus
): Promise<ReceiptBook[]> {
  let q = query(
    collection(db, RECEIPT_BOOKS_COLLECTION),
    where('schoolId', '==', schoolId),
    orderBy('createdAt', 'desc')
  );
  
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ReceiptBook);
}

/**
 * Get active receipt books for a specific bursar
 */
export async function getBursarReceiptBooks(
  schoolId: string,
  bursarId: string
): Promise<ReceiptBook[]> {
  const q = query(
    collection(db, RECEIPT_BOOKS_COLLECTION),
    where('schoolId', '==', schoolId),
    where('assignedTo', '==', bursarId),
    where('status', 'in', ['assigned', 'active']),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ReceiptBook);
}

// ============================================================================
// RECEIPT ISSUANCE
// ============================================================================

/**
 * Issue a new physical receipt
 * Uses a transaction to ensure atomic increment of receipt number
 */
export async function issueReceipt(
  input: IssueReceiptInput,
  issuedBy: string,
  issuedByName: string
): Promise<PhysicalReceipt> {
  const bookRef = doc(db, RECEIPT_BOOKS_COLLECTION, input.receiptBookId);
  
  return runTransaction(db, async (transaction) => {
    const bookSnap = await transaction.get(bookRef);
    
    if (!bookSnap.exists()) {
      throw new Error('Receipt book not found');
    }
    
    const book = bookSnap.data() as ReceiptBook;
    
    // Validate book is usable
    if (book.status === 'completed' || book.status === 'returned' || book.status === 'archived') {
      throw new Error(`Receipt book is ${book.status} and cannot be used`);
    }
    
    if (book.currentNumber > book.endNumber) {
      throw new Error('Receipt book is exhausted');
    }
    
    // Get the next receipt number
    const sequenceNumber = book.currentNumber;
    const receiptNumber = formatReceiptNumber(book.prefix, sequenceNumber);
    
    // Create the receipt
    const receiptRef = doc(collection(db, PHYSICAL_RECEIPTS_COLLECTION));
    const now = Timestamp.now();
    
    const receipt: PhysicalReceipt = {
      id: receiptRef.id,
      schoolId: book.schoolId,
      receiptBookId: input.receiptBookId,
      receiptNumber,
      sequenceNumber,
      paymentId: input.paymentId,
      studentId: input.studentId,
      studentName: input.studentName,
      className: input.className,
      amount: input.amount,
      amountInWords: amountToWords(input.amount),
      paymentMethod: input.paymentMethod,
      paymentDate: input.paymentDate,
      denominationBreakdown: input.denominationBreakdown,
      status: 'issued',
      issuedBy,
      issuedByName,
      issuedAt: now,
      receivedBy: input.receivedBy,
      receivedByPhone: input.receivedByPhone,
      createdAt: now,
      updatedAt: now,
    };
    
    // Update book
    const newCurrentNumber = book.currentNumber + 1;
    const newUsedCount = book.usedCount + 1;
    const newRemainingCount = book.remainingCount - 1;
    const isExhausted = newCurrentNumber > book.endNumber;
    
    const bookUpdate: Partial<ReceiptBook> = {
      currentNumber: newCurrentNumber,
      usedCount: newUsedCount,
      remainingCount: newRemainingCount,
      status: isExhausted ? 'completed' : 'active',
      updatedAt: now,
    };
    
    // Set activatedAt if this is the first receipt
    if (book.status === 'assigned' || book.status === 'pending') {
      bookUpdate.activatedAt = now;
    }
    
    // Set completedAt if exhausted
    if (isExhausted) {
      bookUpdate.completedAt = now;
    }
    
    // Execute transaction
    transaction.set(receiptRef, receipt);
    transaction.update(bookRef, bookUpdate);
    
    return receipt;
  });
}

/**
 * Void a physical receipt
 */
export async function voidReceipt(
  receiptId: string,
  reason: string,
  voidedBy: string
): Promise<void> {
  const receiptRef = doc(db, PHYSICAL_RECEIPTS_COLLECTION, receiptId);
  const receiptSnap = await getDoc(receiptRef);
  
  if (!receiptSnap.exists()) {
    throw new Error('Receipt not found');
  }
  
  const receipt = receiptSnap.data() as PhysicalReceipt;
  
  if (receipt.status === 'voided') {
    throw new Error('Receipt is already voided');
  }
  
  const batch = writeBatch(db);
  
  // Update receipt
  batch.update(receiptRef, {
    status: 'voided',
    voidReason: reason,
    updatedAt: Timestamp.now(),
  });
  
  // Update book void count
  const bookRef = doc(db, RECEIPT_BOOKS_COLLECTION, receipt.receiptBookId);
  const bookSnap = await getDoc(bookRef);
  
  if (bookSnap.exists()) {
    const book = bookSnap.data() as ReceiptBook;
    batch.update(bookRef, {
      voidedCount: book.voidedCount + 1,
      updatedAt: Timestamp.now(),
    });
  }
  
  await batch.commit();
}

/**
 * Get receipts for a receipt book
 */
export async function getBookReceipts(
  bookId: string,
  limitCount: number = 100
): Promise<PhysicalReceipt[]> {
  const q = query(
    collection(db, PHYSICAL_RECEIPTS_COLLECTION),
    where('receiptBookId', '==', bookId),
    orderBy('sequenceNumber', 'asc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PhysicalReceipt);
}

/**
 * Get receipts by date range
 */
export async function getReceiptsByDateRange(
  schoolId: string,
  startDate: Date,
  endDate: Date
): Promise<PhysicalReceipt[]> {
  const q = query(
    collection(db, PHYSICAL_RECEIPTS_COLLECTION),
    where('schoolId', '==', schoolId),
    where('issuedAt', '>=', Timestamp.fromDate(startDate)),
    where('issuedAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('issuedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as PhysicalReceipt);
}

// ============================================================================
// REPORTING
// ============================================================================

/**
 * Get receipt book summary for a school
 */
export async function getReceiptBookSummary(schoolId: string): Promise<ReceiptBookSummary> {
  const books = await getReceiptBooks(schoolId);
  
  const bursarMap = new Map<string, { name: string; activeBooks: number; receiptsIssued: number }>();
  
  let totalReceiptsIssued = 0;
  let totalVoided = 0;
  let activeBooks = 0;
  let completedBooks = 0;
  
  for (const book of books) {
    totalReceiptsIssued += book.usedCount;
    totalVoided += book.voidedCount;
    
    if (book.status === 'active') activeBooks++;
    if (book.status === 'completed') completedBooks++;
    
    if (book.assignedTo) {
      const existing = bursarMap.get(book.assignedTo);
      if (existing) {
        if (book.status === 'active') existing.activeBooks++;
        existing.receiptsIssued += book.usedCount;
      } else {
        bursarMap.set(book.assignedTo, {
          name: book.assignedToName,
          activeBooks: book.status === 'active' ? 1 : 0,
          receiptsIssued: book.usedCount,
        });
      }
    }
  }
  
  return {
    totalBooks: books.length,
    activeBooks,
    completedBooks,
    totalReceiptsIssued,
    totalVoided,
    bursarBreakdown: Array.from(bursarMap.entries()).map(([bursarId, data]) => ({
      bursarId,
      bursarName: data.name,
      activeBooks: data.activeBooks,
      receiptsIssued: data.receiptsIssued,
    })),
  };
}

/**
 * Get daily receipt summary for a bursar
 */
export async function getDailyReceiptSummary(
  schoolId: string,
  bursarId: string,
  date: Date
): Promise<{
  receipts: PhysicalReceipt[];
  totalAmount: number;
  receiptCount: number;
  voidedCount: number;
  cashBreakdown: CashDenomination;
}> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const q = query(
    collection(db, PHYSICAL_RECEIPTS_COLLECTION),
    where('schoolId', '==', schoolId),
    where('issuedBy', '==', bursarId),
    where('issuedAt', '>=', Timestamp.fromDate(startOfDay)),
    where('issuedAt', '<=', Timestamp.fromDate(endOfDay)),
    orderBy('issuedAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  const receipts = snapshot.docs.map(doc => doc.data() as PhysicalReceipt);
  
  // Aggregate
  let totalAmount = 0;
  let voidedCount = 0;
  const cashBreakdown: CashDenomination = {
    notes50000: 0,
    notes20000: 0,
    notes10000: 0,
    notes5000: 0,
    notes2000: 0,
    notes1000: 0,
    coins500: 0,
    coins200: 0,
    coins100: 0,
    total: 0,
  };
  
  for (const receipt of receipts) {
    if (receipt.status === 'voided') {
      voidedCount++;
      continue;
    }
    
    totalAmount += receipt.amount;
    
    if (receipt.denominationBreakdown) {
      cashBreakdown.notes50000 += receipt.denominationBreakdown.notes50000 || 0;
      cashBreakdown.notes20000 += receipt.denominationBreakdown.notes20000 || 0;
      cashBreakdown.notes10000 += receipt.denominationBreakdown.notes10000 || 0;
      cashBreakdown.notes5000 += receipt.denominationBreakdown.notes5000 || 0;
      cashBreakdown.notes2000 += receipt.denominationBreakdown.notes2000 || 0;
      cashBreakdown.notes1000 += receipt.denominationBreakdown.notes1000 || 0;
      cashBreakdown.coins500 += receipt.denominationBreakdown.coins500 || 0;
      cashBreakdown.coins200 += receipt.denominationBreakdown.coins200 || 0;
      cashBreakdown.coins100 += receipt.denominationBreakdown.coins100 || 0;
    }
  }
  
  cashBreakdown.total = calculateDenominationTotal(cashBreakdown);
  
  return {
    receipts,
    totalAmount,
    receiptCount: receipts.length - voidedCount,
    voidedCount,
    cashBreakdown,
  };
}

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

export function getMockReceiptBooks(): ReceiptBook[] {
  const now = Timestamp.now();
  
  return [
    {
      id: 'rb-001',
      schoolId: 'school-001',
      bookNumber: 'RB-2026-001',
      prefix: 'STMARY',
      startNumber: 1,
      endNumber: 100,
      totalReceipts: 100,
      currentNumber: 47,
      usedCount: 46,
      voidedCount: 2,
      remainingCount: 54,
      assignedTo: 'user-001',
      assignedToName: 'Sarah Nambi',
      assignedAt: now,
      assignedBy: 'admin-001',
      status: 'active',
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin-001',
    },
    {
      id: 'rb-002',
      schoolId: 'school-001',
      bookNumber: 'RB-2026-002',
      prefix: 'STMARY',
      startNumber: 101,
      endNumber: 200,
      totalReceipts: 100,
      currentNumber: 101,
      usedCount: 0,
      voidedCount: 0,
      remainingCount: 100,
      assignedTo: 'user-001',
      assignedToName: 'Sarah Nambi',
      assignedAt: now,
      assignedBy: 'admin-001',
      status: 'assigned',
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin-001',
    },
    {
      id: 'rb-003',
      schoolId: 'school-001',
      bookNumber: 'RB-2025-010',
      prefix: 'STMARY',
      startNumber: 901,
      endNumber: 1000,
      totalReceipts: 100,
      currentNumber: 1001,
      usedCount: 100,
      voidedCount: 3,
      remainingCount: 0,
      assignedTo: 'user-002',
      assignedToName: 'John Kato',
      assignedAt: now,
      assignedBy: 'admin-001',
      status: 'completed',
      activatedAt: now,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin-001',
    },
  ];
}

export function getMockPhysicalReceipts(): PhysicalReceipt[] {
  const now = Timestamp.now();
  const today = new Date();
  
  return [
    {
      id: 'pr-001',
      schoolId: 'school-001',
      receiptBookId: 'rb-001',
      receiptNumber: 'STMARY-0046',
      sequenceNumber: 46,
      paymentId: 'pay-001',
      studentId: 'stu-001',
      studentName: 'Nakamya Grace',
      className: 'S.4 Blue',
      amount: 750000,
      amountInWords: 'Seven Hundred Fifty Thousand Shillings Only',
      paymentMethod: 'Cash',
      paymentDate: today,
      denominationBreakdown: {
        notes50000: 15,
        notes20000: 0,
        notes10000: 0,
        notes5000: 0,
        notes2000: 0,
        notes1000: 0,
        coins500: 0,
        coins200: 0,
        coins100: 0,
        total: 750000,
      },
      status: 'issued',
      issuedBy: 'user-001',
      issuedByName: 'Sarah Nambi',
      issuedAt: now,
      receivedBy: 'Mrs. Nakamya',
      receivedByPhone: '+256772123456',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'pr-002',
      schoolId: 'school-001',
      receiptBookId: 'rb-001',
      receiptNumber: 'STMARY-0045',
      sequenceNumber: 45,
      paymentId: 'pay-002',
      studentId: 'stu-002',
      studentName: 'Mugisha David',
      className: 'S.3 Red',
      amount: 500000,
      amountInWords: 'Five Hundred Thousand Shillings Only',
      paymentMethod: 'MTN Mobile Money',
      paymentDate: today,
      status: 'issued',
      issuedBy: 'user-001',
      issuedByName: 'Sarah Nambi',
      issuedAt: now,
      receivedBy: 'Mr. Mugisha Peter',
      receivedByPhone: '+256701234567',
      createdAt: now,
      updatedAt: now,
    },
  ];
}
