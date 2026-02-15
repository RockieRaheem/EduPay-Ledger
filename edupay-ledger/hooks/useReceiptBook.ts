/**
 * useReceiptBook Hook
 * React hooks for physical receipt book management
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReceiptBook,
  ReceiptBookStatus,
  PhysicalReceipt,
  CreateReceiptBookInput,
  IssueReceiptInput,
  ReceiptBookSummary,
  CashDenomination,
  amountToWords,
  calculateDenominationTotal,
  formatReceiptNumber,
  getReceiptBookStatusInfo,
} from "@/types/receipt-book";
import {
  getReceiptBooks,
  getBursarReceiptBooks,
  getReceiptBook,
  createReceiptBook,
  assignReceiptBook,
  issueReceipt,
  voidReceipt,
  getBookReceipts,
  getReceiptBookSummary,
  getDailyReceiptSummary,
  getMockReceiptBooks,
  getMockPhysicalReceipts,
} from "@/lib/services/receipt-book.service";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// ============================================================================
// RECEIPT BOOKS HOOK
// ============================================================================

interface UseReceiptBooksOptions {
  schoolId: string;
  status?: ReceiptBookStatus;
  bursarId?: string;
}

interface UseReceiptBooksReturn {
  books: ReceiptBook[];
  isLoading: boolean;
  error: string | null;
  refreshBooks: () => Promise<void>;
  createBook: (
    input: Omit<CreateReceiptBookInput, "schoolId">,
  ) => Promise<ReceiptBook>;
  assignBook: (
    bookId: string,
    assignedTo: string,
    assignedToName: string,
  ) => Promise<void>;
}

export function useReceiptBooks(
  options: UseReceiptBooksOptions,
): UseReceiptBooksReturn {
  const { schoolId, status, bursarId } = options;

  const [books, setBooks] = useState<ReceiptBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        let mockBooks = getMockReceiptBooks();
        if (status) {
          mockBooks = mockBooks.filter((b) => b.status === status);
        }
        if (bursarId) {
          mockBooks = mockBooks.filter((b) => b.assignedTo === bursarId);
        }
        setBooks(mockBooks);
      } else {
        let result: ReceiptBook[];
        if (bursarId) {
          result = await getBursarReceiptBooks(schoolId, bursarId);
        } else {
          result = await getReceiptBooks(schoolId, status);
        }
        setBooks(result);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load receipt books",
      );
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, status, bursarId]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const createBook = useCallback(
    async (
      input: Omit<CreateReceiptBookInput, "schoolId">,
    ): Promise<ReceiptBook> => {
      const book = await createReceiptBook(
        { ...input, schoolId },
        "current-user", // TODO: Get from auth context
      );
      await loadBooks();
      return book;
    },
    [schoolId, loadBooks],
  );

  const assignBook = useCallback(
    async (
      bookId: string,
      assignedTo: string,
      assignedToName: string,
    ): Promise<void> => {
      await assignReceiptBook(
        bookId,
        assignedTo,
        assignedToName,
        "current-user",
      );
      await loadBooks();
    },
    [loadBooks],
  );

  return {
    books,
    isLoading,
    error,
    refreshBooks: loadBooks,
    createBook,
    assignBook,
  };
}

// ============================================================================
// SINGLE RECEIPT BOOK HOOK
// ============================================================================

interface UseReceiptBookReturn {
  book: ReceiptBook | null;
  receipts: PhysicalReceipt[];
  isLoading: boolean;
  error: string | null;
  refreshBook: () => Promise<void>;
  issueReceipt: (
    input: Omit<IssueReceiptInput, "receiptBookId">,
  ) => Promise<PhysicalReceipt>;
  voidReceipt: (receiptId: string, reason: string) => Promise<void>;
  getNextReceiptNumber: () => string;
}

export function useReceiptBook(bookId: string): UseReceiptBookReturn {
  const [book, setBook] = useState<ReceiptBook | null>(null);
  const [receipts, setReceipts] = useState<PhysicalReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBook = useCallback(async () => {
    if (!bookId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const mockBooks = getMockReceiptBooks();
        const mockBook = mockBooks.find((b) => b.id === bookId) || null;
        setBook(mockBook);
        setReceipts(
          getMockPhysicalReceipts().filter((r) => r.receiptBookId === bookId),
        );
      } else {
        const [bookData, receiptsData] = await Promise.all([
          getReceiptBook(bookId),
          getBookReceipts(bookId),
        ]);
        setBook(bookData);
        setReceipts(receiptsData);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load receipt book",
      );
    } finally {
      setIsLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const handleIssueReceipt = useCallback(
    async (
      input: Omit<IssueReceiptInput, "receiptBookId">,
    ): Promise<PhysicalReceipt> => {
      const receipt = await issueReceipt(
        { ...input, receiptBookId: bookId },
        "current-user",
        "Current User", // TODO: Get from auth context
      );
      await loadBook();
      return receipt;
    },
    [bookId, loadBook],
  );

  const handleVoidReceipt = useCallback(
    async (receiptId: string, reason: string): Promise<void> => {
      await voidReceipt(receiptId, reason, "current-user");
      await loadBook();
    },
    [loadBook],
  );

  const getNextReceiptNumber = useCallback((): string => {
    if (!book) return "";
    return formatReceiptNumber(book.prefix, book.currentNumber);
  }, [book]);

  return {
    book,
    receipts,
    isLoading,
    error,
    refreshBook: loadBook,
    issueReceipt: handleIssueReceipt,
    voidReceipt: handleVoidReceipt,
    getNextReceiptNumber,
  };
}

// ============================================================================
// RECEIPT BOOK SUMMARY HOOK
// ============================================================================

interface UseReceiptBookSummaryReturn {
  summary: ReceiptBookSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshSummary: () => Promise<void>;
}

export function useReceiptBookSummary(
  schoolId: string,
): UseReceiptBookSummaryReturn {
  const [summary, setSummary] = useState<ReceiptBookSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setSummary({
          totalBooks: 3,
          activeBooks: 1,
          completedBooks: 1,
          totalReceiptsIssued: 146,
          totalVoided: 5,
          bursarBreakdown: [
            {
              bursarId: "user-001",
              bursarName: "Sarah Nambi",
              activeBooks: 1,
              receiptsIssued: 46,
            },
            {
              bursarId: "user-002",
              bursarName: "John Kato",
              activeBooks: 0,
              receiptsIssued: 100,
            },
          ],
        });
      } else {
        const data = await getReceiptBookSummary(schoolId);
        setSummary(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return {
    summary,
    isLoading,
    error,
    refreshSummary: loadSummary,
  };
}

// ============================================================================
// DAILY RECEIPTS HOOK
// ============================================================================

interface UseDailyReceiptsOptions {
  schoolId: string;
  bursarId: string;
  date?: Date;
}

interface UseDailyReceiptsReturn {
  receipts: PhysicalReceipt[];
  totalAmount: number;
  receiptCount: number;
  voidedCount: number;
  cashBreakdown: CashDenomination;
  isLoading: boolean;
  error: string | null;
  refreshReceipts: () => Promise<void>;
}

export function useDailyReceipts(
  options: UseDailyReceiptsOptions,
): UseDailyReceiptsReturn {
  const { schoolId, bursarId, date = new Date() } = options;

  const [receipts, setReceipts] = useState<PhysicalReceipt[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);
  const [voidedCount, setVoidedCount] = useState(0);
  const [cashBreakdown, setCashBreakdown] = useState<CashDenomination>({
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    if (!schoolId || !bursarId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const mockReceipts = getMockPhysicalReceipts();
        setReceipts(mockReceipts);
        setTotalAmount(1250000);
        setReceiptCount(2);
        setVoidedCount(0);
        setCashBreakdown({
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
        });
      } else {
        const data = await getDailyReceiptSummary(schoolId, bursarId, date);
        setReceipts(data.receipts);
        setTotalAmount(data.totalAmount);
        setReceiptCount(data.receiptCount);
        setVoidedCount(data.voidedCount);
        setCashBreakdown(data.cashBreakdown);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load daily receipts",
      );
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, bursarId, date]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  return {
    receipts,
    totalAmount,
    receiptCount,
    voidedCount,
    cashBreakdown,
    isLoading,
    error,
    refreshReceipts: loadReceipts,
  };
}

// ============================================================================
// CASH DENOMINATION CALCULATOR HOOK
// ============================================================================

interface UseDenominationCalculatorReturn {
  denomination: CashDenomination;
  setDenomination: (denom: Partial<CashDenomination>) => void;
  total: number;
  isValid: (expectedAmount: number) => boolean;
  reset: () => void;
}

export function useDenominationCalculator(): UseDenominationCalculatorReturn {
  const [denomination, setDenominationState] = useState<CashDenomination>({
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
  });

  const total = useMemo(
    () => calculateDenominationTotal(denomination),
    [denomination],
  );

  const setDenomination = useCallback((partial: Partial<CashDenomination>) => {
    setDenominationState((prev) => {
      const updated = { ...prev, ...partial };
      updated.total = calculateDenominationTotal(updated);
      return updated;
    });
  }, []);

  const isValid = useCallback(
    (expectedAmount: number): boolean => {
      return total === expectedAmount;
    },
    [total],
  );

  const reset = useCallback(() => {
    setDenominationState({
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
    });
  }, []);

  return {
    denomination,
    setDenomination,
    total,
    isValid,
    reset,
  };
}

// Re-export helper functions
export { amountToWords, formatReceiptNumber, getReceiptBookStatusInfo };
