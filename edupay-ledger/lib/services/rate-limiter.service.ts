/**
 * Rate Limiting Service
 * Prevents brute force attacks on authentication
 */

// ============================================================================
// Types
// ============================================================================

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5, // Max attempts before lockout
  windowMs: 15 * 60 * 1000, // 15 minute window
  lockoutMs: 30 * 60 * 1000, // 30 minute lockout
};

const STORAGE_KEY = "edupay_rate_limit";

// ============================================================================
// Rate Limiter Class
// ============================================================================

class RateLimiter {
  private config: RateLimitConfig;
  private entries: Map<string, RateLimitEntry> = new Map();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Load rate limit data from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.entries = new Map(Object.entries(data));
        this.cleanup();
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Save rate limit data to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      const data = Object.fromEntries(this.entries);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.entries.forEach((entry, key) => {
      // Remove entries outside the window with no active lockout
      if (
        !entry.lockedUntil &&
        now - entry.firstAttempt > this.config.windowMs
      ) {
        keysToDelete.push(key);
      }
      // Remove expired lockouts
      if (entry.lockedUntil && now > entry.lockedUntil) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.entries.delete(key));
    this.saveToStorage();
  }

  /**
   * Check if an identifier is currently rate limited
   */
  isRateLimited(identifier: string): {
    limited: boolean;
    retryAfter?: number;
    attemptsRemaining?: number;
  } {
    this.cleanup();

    const entry = this.entries.get(identifier);
    const now = Date.now();

    if (!entry) {
      return { limited: false, attemptsRemaining: this.config.maxAttempts };
    }

    // Check if locked out
    if (entry.lockedUntil && now < entry.lockedUntil) {
      return {
        limited: true,
        retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    // Check if within window but not locked
    if (now - entry.firstAttempt < this.config.windowMs) {
      const attemptsRemaining = Math.max(
        0,
        this.config.maxAttempts - entry.attempts,
      );
      return {
        limited: entry.attempts >= this.config.maxAttempts,
        attemptsRemaining,
        retryAfter:
          entry.attempts >= this.config.maxAttempts
            ? Math.ceil(
                (entry.firstAttempt + this.config.windowMs - now) / 1000,
              )
            : undefined,
      };
    }

    // Window expired, reset
    this.entries.delete(identifier);
    this.saveToStorage();
    return { limited: false, attemptsRemaining: this.config.maxAttempts };
  }

  /**
   * Record a failed attempt
   */
  recordFailedAttempt(identifier: string): {
    locked: boolean;
    attemptsRemaining: number;
    lockoutSeconds?: number;
  } {
    const now = Date.now();
    let entry = this.entries.get(identifier);

    if (!entry || now - entry.firstAttempt > this.config.windowMs) {
      // Start new window
      entry = {
        attempts: 1,
        firstAttempt: now,
      };
    } else {
      // Increment attempts
      entry.attempts++;
    }

    // Check if should lock out
    if (entry.attempts >= this.config.maxAttempts) {
      entry.lockedUntil = now + this.config.lockoutMs;
    }

    this.entries.set(identifier, entry);
    this.saveToStorage();

    return {
      locked: !!entry.lockedUntil,
      attemptsRemaining: Math.max(0, this.config.maxAttempts - entry.attempts),
      lockoutSeconds: entry.lockedUntil
        ? Math.ceil(this.config.lockoutMs / 1000)
        : undefined,
    };
  }

  /**
   * Record a successful attempt (reset the counter)
   */
  recordSuccess(identifier: string): void {
    this.entries.delete(identifier);
    this.saveToStorage();
  }

  /**
   * Get remaining attempts for an identifier
   */
  getRemainingAttempts(identifier: string): number {
    const entry = this.entries.get(identifier);
    if (!entry) return this.config.maxAttempts;
    return Math.max(0, this.config.maxAttempts - entry.attempts);
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.entries.clear();
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

// Auth rate limiter (stricter)
export const authRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 30 * 60 * 1000, // 30 minutes
});

// API rate limiter (more lenient)
export const apiRateLimiter = new RateLimiter({
  maxAttempts: 100,
  windowMs: 60 * 1000, // 1 minute
  lockoutMs: 5 * 60 * 1000, // 5 minutes
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format seconds into human-readable time
 */
export function formatRateLimitTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

/**
 * Check rate limit and throw error if limited
 */
export function checkRateLimit(identifier: string): void {
  const result = authRateLimiter.isRateLimited(identifier);
  if (result.limited) {
    throw new RateLimitError(
      `Too many attempts. Please try again in ${formatRateLimitTime(result.retryAfter || 0)}.`,
      result.retryAfter,
    );
  }
}

/**
 * Custom error class for rate limiting
 */
export class RateLimitError extends Error {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export default RateLimiter;
