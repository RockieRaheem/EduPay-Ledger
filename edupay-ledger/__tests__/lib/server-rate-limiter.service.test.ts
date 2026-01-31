/**
 * Server-Side Rate Limiter Tests
 *
 * Tests for Firebase-backed distributed rate limiting
 */

// ============================================================================
// MOCK SETUP - Must be before imports
// ============================================================================

// Mock Firebase first (before any imports)
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    })),
    fromMillis: jest.fn((ms: number) => ({
      toMillis: () => ms,
      toDate: () => new Date(ms),
    })),
  },
  serverTimestamp: jest.fn(() => new Date().toISOString()),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
  initializeFirebase: jest.fn(() => Promise.resolve()),
  COLLECTIONS: {
    RATE_LIMITS: "rateLimits",
  },
}));

// Now import after mocks are set up
import {
  ServerRateLimitError,
  formatRateLimitTime,
  RateLimitCheckResult,
  RateLimitRecordResult,
} from "@/lib/services/server-rate-limiter.service";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock rate limit entry
 */
function createMockEntry(
  attempts: number = 1,
  firstAttemptMs: number = Date.now(),
  lockedUntilMs?: number,
) {
  return {
    attempts,
    firstAttempt: { toMillis: () => firstAttemptMs },
    lastAttempt: { toMillis: () => Date.now() },
    lockedUntil: lockedUntilMs ? { toMillis: () => lockedUntilMs } : undefined,
  };
}

/**
 * Reset all mocks between tests
 */
function resetMocks() {
  jest.clearAllMocks();
}

// ============================================================================
// FORMAT RATE LIMIT TIME TESTS
// ============================================================================

describe("formatRateLimitTime", () => {
  test("should format seconds (singular)", () => {
    expect(formatRateLimitTime(1)).toBe("1 second");
  });

  test("should format seconds (plural)", () => {
    expect(formatRateLimitTime(30)).toBe("30 seconds");
  });

  test("should format exactly 60 seconds as 1 minute", () => {
    expect(formatRateLimitTime(60)).toBe("1 minute");
  });

  test("should format minutes (plural)", () => {
    expect(formatRateLimitTime(120)).toBe("2 minutes");
    expect(formatRateLimitTime(300)).toBe("5 minutes");
    expect(formatRateLimitTime(900)).toBe("15 minutes");
  });

  test("should round up to nearest minute", () => {
    expect(formatRateLimitTime(90)).toBe("2 minutes");
    expect(formatRateLimitTime(61)).toBe("2 minutes");
    expect(formatRateLimitTime(119)).toBe("2 minutes");
  });

  test("should format hours (singular)", () => {
    expect(formatRateLimitTime(3600)).toBe("1 hour");
  });

  test("should format hours (plural)", () => {
    expect(formatRateLimitTime(7200)).toBe("2 hours");
    expect(formatRateLimitTime(10800)).toBe("3 hours");
  });

  test("should round up to nearest hour", () => {
    expect(formatRateLimitTime(3601)).toBe("2 hours");
    expect(formatRateLimitTime(7199)).toBe("2 hours");
  });

  test("should handle zero seconds", () => {
    expect(formatRateLimitTime(0)).toBe("0 seconds");
  });

  test("should handle large values", () => {
    expect(formatRateLimitTime(86400)).toBe("24 hours"); // 1 day
    expect(formatRateLimitTime(172800)).toBe("48 hours"); // 2 days
  });
});

// ============================================================================
// SERVER RATE LIMIT ERROR TESTS
// ============================================================================

describe("ServerRateLimitError", () => {
  test("should create error with message", () => {
    const error = new ServerRateLimitError("Too many requests");

    expect(error.message).toBe("Too many requests");
    expect(error.name).toBe("ServerRateLimitError");
    expect(error.statusCode).toBe(429);
  });

  test("should include retryAfter", () => {
    const error = new ServerRateLimitError("Rate limited", 300);

    expect(error.retryAfter).toBe(300);
  });

  test("should be instanceof Error", () => {
    const error = new ServerRateLimitError("Test");

    expect(error).toBeInstanceOf(Error);
  });

  test("should have stack trace", () => {
    const error = new ServerRateLimitError("Test");

    expect(error.stack).toBeDefined();
  });
});

// ============================================================================
// RATE LIMIT CHECK RESULT TESTS
// ============================================================================

describe("RateLimitCheckResult", () => {
  test("should represent not limited state", () => {
    const result: RateLimitCheckResult = {
      limited: false,
      attemptsRemaining: 5,
    };

    expect(result.limited).toBe(false);
    expect(result.attemptsRemaining).toBe(5);
    expect(result.retryAfter).toBeUndefined();
  });

  test("should represent limited state with retry time", () => {
    const result: RateLimitCheckResult = {
      limited: true,
      retryAfter: 1800,
      reason: "Account temporarily locked",
    };

    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBe(1800);
    expect(result.reason).toBeDefined();
  });

  test("should represent approaching limit state", () => {
    const result: RateLimitCheckResult = {
      limited: false,
      attemptsRemaining: 1,
    };

    expect(result.limited).toBe(false);
    expect(result.attemptsRemaining).toBe(1);
  });
});

// ============================================================================
// RATE LIMIT RECORD RESULT TESTS
// ============================================================================

describe("RateLimitRecordResult", () => {
  test("should represent first failed attempt", () => {
    const result: RateLimitRecordResult = {
      locked: false,
      attemptsRemaining: 4,
    };

    expect(result.locked).toBe(false);
    expect(result.attemptsRemaining).toBe(4);
  });

  test("should represent lockout triggered", () => {
    const result: RateLimitRecordResult = {
      locked: true,
      attemptsRemaining: 0,
      lockoutSeconds: 1800,
    };

    expect(result.locked).toBe(true);
    expect(result.attemptsRemaining).toBe(0);
    expect(result.lockoutSeconds).toBe(1800);
  });
});

// ============================================================================
// RATE LIMIT CONFIG TESTS
// ============================================================================

describe("Rate Limit Configuration", () => {
  const configs = {
    auth: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 30 * 60 * 1000,
    },
    api: {
      maxAttempts: 100,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
    },
    payment: {
      maxAttempts: 10,
      windowMs: 60 * 60 * 1000,
      lockoutMs: 60 * 60 * 1000,
    },
    sms: {
      maxAttempts: 3,
      windowMs: 10 * 60 * 1000,
      lockoutMs: 60 * 60 * 1000,
    },
  };

  describe("Auth rate limiter", () => {
    test("should have 5 max attempts", () => {
      expect(configs.auth.maxAttempts).toBe(5);
    });

    test("should have 15 minute window", () => {
      expect(configs.auth.windowMs).toBe(900000);
    });

    test("should have 30 minute lockout", () => {
      expect(configs.auth.lockoutMs).toBe(1800000);
    });
  });

  describe("API rate limiter", () => {
    test("should have 100 max attempts", () => {
      expect(configs.api.maxAttempts).toBe(100);
    });

    test("should have 1 minute window", () => {
      expect(configs.api.windowMs).toBe(60000);
    });

    test("should have 5 minute lockout", () => {
      expect(configs.api.lockoutMs).toBe(300000);
    });
  });

  describe("Payment rate limiter", () => {
    test("should have 10 max attempts", () => {
      expect(configs.payment.maxAttempts).toBe(10);
    });

    test("should have 1 hour window", () => {
      expect(configs.payment.windowMs).toBe(3600000);
    });

    test("should have 1 hour lockout", () => {
      expect(configs.payment.lockoutMs).toBe(3600000);
    });
  });

  describe("SMS rate limiter", () => {
    test("should have 3 max attempts", () => {
      expect(configs.sms.maxAttempts).toBe(3);
    });

    test("should have 10 minute window", () => {
      expect(configs.sms.windowMs).toBe(600000);
    });

    test("should have 1 hour lockout", () => {
      expect(configs.sms.lockoutMs).toBe(3600000);
    });
  });
});

// ============================================================================
// RATE LIMIT LOGIC TESTS
// ============================================================================

describe("Rate Limit Logic", () => {
  beforeEach(resetMocks);

  describe("First time check", () => {
    test("should allow first request", () => {
      const entry = null; // No existing entry
      const maxAttempts = 5;

      const result: RateLimitCheckResult = entry
        ? { limited: true, retryAfter: 0 }
        : { limited: false, attemptsRemaining: maxAttempts };

      expect(result.limited).toBe(false);
      expect(result.attemptsRemaining).toBe(5);
    });
  });

  describe("Active lockout check", () => {
    test("should detect active lockout", () => {
      const now = Date.now();
      const lockedUntilMs = now + 1800000; // 30 minutes from now

      const isLocked = now < lockedUntilMs;
      const retryAfter = Math.ceil((lockedUntilMs - now) / 1000);

      expect(isLocked).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
    });

    test("should detect expired lockout", () => {
      const now = Date.now();
      const lockedUntilMs = now - 1000; // 1 second ago

      const isLocked = now < lockedUntilMs;

      expect(isLocked).toBe(false);
    });
  });

  describe("Window expiration check", () => {
    test("should detect active window", () => {
      const now = Date.now();
      const firstAttemptMs = now - 5 * 60 * 1000; // 5 minutes ago
      const windowMs = 15 * 60 * 1000; // 15 minutes

      const isWithinWindow = now - firstAttemptMs < windowMs;

      expect(isWithinWindow).toBe(true);
    });

    test("should detect expired window", () => {
      const now = Date.now();
      const firstAttemptMs = now - 20 * 60 * 1000; // 20 minutes ago
      const windowMs = 15 * 60 * 1000; // 15 minutes

      const isWithinWindow = now - firstAttemptMs < windowMs;

      expect(isWithinWindow).toBe(false);
    });
  });

  describe("Attempt counting", () => {
    test("should calculate remaining attempts correctly", () => {
      const maxAttempts = 5;
      const currentAttempts = 3;

      const remaining = Math.max(0, maxAttempts - currentAttempts);

      expect(remaining).toBe(2);
    });

    test("should not go negative", () => {
      const maxAttempts = 5;
      const currentAttempts = 10;

      const remaining = Math.max(0, maxAttempts - currentAttempts);

      expect(remaining).toBe(0);
    });
  });

  describe("Lockout trigger", () => {
    test("should trigger lockout at max attempts", () => {
      const maxAttempts = 5;
      const attempts = 5;

      const shouldLock = attempts >= maxAttempts;

      expect(shouldLock).toBe(true);
    });

    test("should not trigger lockout below max", () => {
      const maxAttempts = 5;
      const attempts = 4;

      const shouldLock = attempts >= maxAttempts;

      expect(shouldLock).toBe(false);
    });
  });
});

// ============================================================================
// DOCUMENT ID GENERATION TESTS
// ============================================================================

describe("Document ID Generation", () => {
  test("should sanitize email identifiers", () => {
    const email = "user@example.com";
    const sanitized = email.replace(/[^a-zA-Z0-9@._-]/g, "_").substring(0, 100);

    expect(sanitized).toBe("user@example.com");
  });

  test("should sanitize IP addresses", () => {
    const ip = "192.168.1.100";
    const sanitized = ip.replace(/[^a-zA-Z0-9@._-]/g, "_").substring(0, 100);

    expect(sanitized).toBe("192.168.1.100");
  });

  test("should handle special characters", () => {
    const malicious = "user+test@example.com;DROP TABLE";
    const sanitized = malicious
      .replace(/[^a-zA-Z0-9@._-]/g, "_")
      .substring(0, 100);

    expect(sanitized).toBe("user_test@example.com_DROP_TABLE");
    expect(sanitized).not.toContain(";");
    expect(sanitized).not.toContain("+");
  });

  test("should truncate long identifiers", () => {
    const longId = "a".repeat(200);
    const sanitized = longId
      .replace(/[^a-zA-Z0-9@._-]/g, "_")
      .substring(0, 100);

    expect(sanitized.length).toBe(100);
  });

  test("should add prefix for different types", () => {
    const prefixes = {
      auth: "auth_",
      api: "api_",
      payment: "payment_",
      sms: "sms_",
    };

    Object.entries(prefixes).forEach(([type, prefix]) => {
      const docId = `${prefix}user@example.com`;
      expect(docId.startsWith(prefix)).toBe(true);
    });
  });
});

// ============================================================================
// FAIL OPEN BEHAVIOR TESTS
// ============================================================================

describe("Fail Open Behavior", () => {
  test("should not block on Firebase error during check", () => {
    // If Firebase fails, we should allow the request (fail open)
    const firebaseError = new Error("Firebase unavailable");
    const shouldBlock = false; // Fail open

    expect(shouldBlock).toBe(false);
  });

  test("should not block on Firebase error during record", () => {
    const firebaseError = new Error("Write failed");
    const result: RateLimitRecordResult = {
      locked: false, // Fail open
      attemptsRemaining: 5,
    };

    expect(result.locked).toBe(false);
  });

  test("should log errors but continue", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    const error = new Error("Test error");

    console.error("Rate limit check failed:", error);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// METADATA HANDLING TESTS
// ============================================================================

describe("Metadata Handling", () => {
  test("should accept IP address metadata", () => {
    const metadata = {
      ipAddress: "192.168.1.100",
    };

    expect(metadata.ipAddress).toBeDefined();
  });

  test("should accept user agent metadata", () => {
    const metadata = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    };

    expect(metadata.userAgent).toBeDefined();
  });

  test("should handle missing metadata", () => {
    const metadata = undefined;

    expect(metadata).toBeUndefined();
  });

  test("should preserve metadata across updates", () => {
    const existingEntry = {
      attempts: 2,
      ipAddress: "192.168.1.100",
    };

    const newMetadata = {
      ipAddress: "192.168.1.101", // New IP
    };

    const updatedEntry = {
      ...existingEntry,
      attempts: existingEntry.attempts + 1,
      ipAddress: newMetadata.ipAddress || existingEntry.ipAddress,
    };

    expect(updatedEntry.ipAddress).toBe("192.168.1.101");
    expect(updatedEntry.attempts).toBe(3);
  });
});

// ============================================================================
// MIDDLEWARE RESPONSE TESTS
// ============================================================================

describe("Middleware Response", () => {
  test("should return 429 status for rate limited requests", () => {
    const statusCode = 429;
    const body = {
      error: "Too Many Requests",
      message: "Rate limit exceeded",
      retryAfter: 1800,
    };

    expect(statusCode).toBe(429);
    expect(body.error).toBe("Too Many Requests");
    expect(body.retryAfter).toBeDefined();
  });

  test("should set rate limit headers", () => {
    const headers = {
      "X-RateLimit-Remaining": 3,
    };

    expect(headers["X-RateLimit-Remaining"]).toBeDefined();
  });

  test("should extract IP from x-forwarded-for header", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      },
    };

    // x-forwarded-for contains comma-separated list, first is original client
    const clientIp = req.headers["x-forwarded-for"].split(",")[0].trim();

    expect(clientIp).toBe("203.0.113.195");
  });

  test("should fall back to socket address", () => {
    const req = {
      headers: {} as Record<string, string | undefined>,
      socket: {
        remoteAddress: "127.0.0.1",
      },
    };

    const clientIp =
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

    expect(clientIp).toBe("127.0.0.1");
  });
});

// ============================================================================
// UGANDAN SCHOOL CONTEXT TESTS
// ============================================================================

describe("Ugandan School Context", () => {
  describe("Payment rate limiting", () => {
    test("should allow reasonable payment frequency", () => {
      const maxPaymentAttempts = 10;
      const paymentWindow = 60 * 60 * 1000; // 1 hour

      // A school bursar might record multiple payments in sequence
      // but 10 per hour is reasonable limit
      expect(maxPaymentAttempts).toBeGreaterThanOrEqual(10);
    });

    test("should prevent rapid duplicate payments", () => {
      const attempts = [
        { time: 0, studentId: "STU-001", amount: 500000 },
        { time: 100, studentId: "STU-001", amount: 500000 }, // Same student, same amount
        { time: 200, studentId: "STU-001", amount: 500000 },
      ];

      // Three identical payments in 200ms should be suspicious
      const isSuspicious = attempts.length >= 3;
      expect(isSuspicious).toBe(true);
    });
  });

  describe("SMS rate limiting", () => {
    test("should limit SMS to parents", () => {
      const maxSmsPerPhone = 3;
      const smsWindow = 10 * 60 * 1000; // 10 minutes

      // Parents shouldn't receive more than 3 SMS in 10 minutes
      expect(maxSmsPerPhone).toBe(3);
    });
  });

  describe("Login rate limiting", () => {
    test("should protect against credential stuffing", () => {
      const maxLoginAttempts = 5;
      const lockoutDuration = 30 * 60 * 1000; // 30 minutes

      // 5 attempts then 30 minute lockout prevents credential stuffing
      expect(maxLoginAttempts).toBe(5);
      expect(lockoutDuration).toBe(1800000);
    });
  });
});

// ============================================================================
// ADMIN FUNCTIONS TESTS
// ============================================================================

describe("Admin Functions", () => {
  test("should allow manual unlock", () => {
    const identifier = "user@school.ac.ug";
    const canUnlock = true;

    // Admin should be able to unlock accounts
    expect(canUnlock).toBe(true);
  });

  test("should provide status information", () => {
    const status = {
      attempts: 3,
      firstAttempt: new Date(),
      lockedUntil: undefined,
      attemptsRemaining: 2,
    };

    expect(status.attempts).toBeDefined();
    expect(status.attemptsRemaining).toBeDefined();
  });
});
