/**
 * Rate Limiter Service Tests
 */

import RateLimiter, {
  authRateLimiter,
  formatRateLimitTime,
  RateLimitError,
} from "@/lib/services/rate-limiter.service";

describe("RateLimiter", () => {
  let rateLimiter: typeof authRateLimiter;

  beforeEach(() => {
    // Clear storage before each test
    localStorage.clear();
    // Create fresh instance
    rateLimiter = new (RateLimiter as any)({
      maxAttempts: 3,
      windowMs: 60 * 1000, // 1 minute
      lockoutMs: 5 * 60 * 1000, // 5 minutes
    });
  });

  describe("isRateLimited", () => {
    it("should not rate limit new identifiers", () => {
      const result = rateLimiter.isRateLimited("test@example.com");
      expect(result.limited).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
    });

    it("should return remaining attempts correctly", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      const result = rateLimiter.isRateLimited("test@example.com");
      expect(result.limited).toBe(false);
      expect(result.attemptsRemaining).toBe(2);
    });

    it("should rate limit after max attempts", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");

      const result = rateLimiter.isRateLimited("test@example.com");
      expect(result.limited).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should track different identifiers separately", () => {
      rateLimiter.recordFailedAttempt("user1@example.com");
      rateLimiter.recordFailedAttempt("user1@example.com");
      rateLimiter.recordFailedAttempt("user1@example.com");

      const result1 = rateLimiter.isRateLimited("user1@example.com");
      const result2 = rateLimiter.isRateLimited("user2@example.com");

      expect(result1.limited).toBe(true);
      expect(result2.limited).toBe(false);
    });
  });

  describe("recordFailedAttempt", () => {
    it("should increment attempt count", () => {
      const result1 = rateLimiter.recordFailedAttempt("test@example.com");
      expect(result1.attemptsRemaining).toBe(2);

      const result2 = rateLimiter.recordFailedAttempt("test@example.com");
      expect(result2.attemptsRemaining).toBe(1);
    });

    it("should lock after max attempts", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");
      const result = rateLimiter.recordFailedAttempt("test@example.com");

      expect(result.locked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.lockoutSeconds).toBeGreaterThan(0);
    });

    it("should return locked=false before max attempts", () => {
      const result = rateLimiter.recordFailedAttempt("test@example.com");
      expect(result.locked).toBe(false);
    });
  });

  describe("recordSuccess", () => {
    it("should clear attempts on success", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordSuccess("test@example.com");

      const result = rateLimiter.isRateLimited("test@example.com");
      expect(result.limited).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
    });
  });

  describe("getRemainingAttempts", () => {
    it("should return max attempts for new identifier", () => {
      const remaining = rateLimiter.getRemainingAttempts("test@example.com");
      expect(remaining).toBe(3);
    });

    it("should return correct remaining after failed attempts", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      const remaining = rateLimiter.getRemainingAttempts("test@example.com");
      expect(remaining).toBe(2);
    });

    it("should return 0 when locked out", () => {
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");
      rateLimiter.recordFailedAttempt("test@example.com");
      const remaining = rateLimiter.getRemainingAttempts("test@example.com");
      expect(remaining).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear all rate limit data", () => {
      rateLimiter.recordFailedAttempt("user1@example.com");
      rateLimiter.recordFailedAttempt("user2@example.com");
      rateLimiter.clear();

      expect(rateLimiter.isRateLimited("user1@example.com").limited).toBe(
        false,
      );
      expect(rateLimiter.isRateLimited("user2@example.com").limited).toBe(
        false,
      );
    });
  });
});

describe("formatRateLimitTime", () => {
  it("should format seconds correctly", () => {
    expect(formatRateLimitTime(1)).toBe("1 second");
    expect(formatRateLimitTime(30)).toBe("30 seconds");
    expect(formatRateLimitTime(59)).toBe("59 seconds");
  });

  it("should format minutes correctly", () => {
    expect(formatRateLimitTime(60)).toBe("1 minute");
    expect(formatRateLimitTime(120)).toBe("2 minutes");
    expect(formatRateLimitTime(90)).toBe("2 minutes"); // Rounds up
  });

  it("should round up partial minutes", () => {
    expect(formatRateLimitTime(61)).toBe("2 minutes");
    expect(formatRateLimitTime(179)).toBe("3 minutes");
  });
});

describe("RateLimitError", () => {
  it("should create error with message", () => {
    const error = new RateLimitError("Test message");
    expect(error.message).toBe("Test message");
    expect(error.name).toBe("RateLimitError");
  });

  it("should store retryAfter value", () => {
    const error = new RateLimitError("Test message", 300);
    expect(error.retryAfter).toBe(300);
  });

  it("should be instanceof Error", () => {
    const error = new RateLimitError("Test message");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("localStorage persistence", () => {
  it("should persist rate limit data to localStorage", () => {
    const limiter = new (RateLimiter as any)({
      maxAttempts: 3,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
    });

    limiter.recordFailedAttempt("test@example.com");

    const stored = localStorage.getItem("ebursar_rate_limit");
    expect(stored).not.toBeNull();

    const data = JSON.parse(stored!);
    expect(data["test@example.com"]).toBeDefined();
    expect(data["test@example.com"].attempts).toBe(1);
  });

  it("should load rate limit data from localStorage", () => {
    // Pre-populate localStorage
    const data = {
      "test@example.com": {
        attempts: 2,
        firstAttempt: Date.now(),
      },
    };
    localStorage.setItem("ebursar_rate_limit", JSON.stringify(data));

    // Create new limiter that should load from storage
    const limiter = new (RateLimiter as any)({
      maxAttempts: 3,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
    });

    const remaining = limiter.getRemainingAttempts("test@example.com");
    expect(remaining).toBe(1);
  });
});
