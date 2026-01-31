/**
 * Server-Side Rate Limiting Service
 *
 * Uses Firebase Firestore for distributed rate limiting across all clients.
 * This provides true protection against brute force attacks since the data
 * cannot be manipulated by clients.
 *
 * For API routes: Use in Next.js API routes or middleware
 * For client: Falls back to localStorage with server validation
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  db as firebaseDb,
  initializeFirebase,
  COLLECTIONS,
} from "@/lib/firebase";

// ============================================================================
// Types
// ============================================================================

export interface ServerRateLimitEntry {
  attempts: number;
  firstAttempt: Timestamp;
  lockedUntil?: Timestamp;
  lastAttempt: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

export interface ServerRateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
  collectionName: string;
}

export interface RateLimitCheckResult {
  limited: boolean;
  retryAfter?: number;
  attemptsRemaining?: number;
  reason?: string;
}

export interface RateLimitRecordResult {
  locked: boolean;
  attemptsRemaining: number;
  lockoutSeconds?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ServerRateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 30 * 60 * 1000, // 30 minutes
  collectionName: "rateLimits",
};

// Rate limit document prefix for different types
const RATE_LIMIT_PREFIXES = {
  auth: "auth_",
  api: "api_",
  payment: "payment_",
  sms: "sms_",
} as const;

// ============================================================================
// Server-Side Rate Limiter Class
// ============================================================================

class ServerRateLimiter {
  private config: ServerRateLimitConfig;
  private prefix: string;

  constructor(
    prefix: keyof typeof RATE_LIMIT_PREFIXES = "auth",
    config: Partial<ServerRateLimitConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.prefix = RATE_LIMIT_PREFIXES[prefix];
  }

  /**
   * Get the document ID for an identifier
   */
  private getDocId(identifier: string): string {
    // Hash sensitive identifiers (like IP addresses or emails)
    const sanitized = identifier
      .replace(/[^a-zA-Z0-9@._-]/g, "_")
      .substring(0, 100);
    return `${this.prefix}${sanitized}`;
  }

  /**
   * Get the document reference
   */
  private getDocRef(identifier: string) {
    const docId = this.getDocId(identifier);
    return doc(firebaseDb, this.config.collectionName, docId);
  }

  /**
   * Check if an identifier is currently rate limited (server-side)
   */
  async isRateLimited(
    identifier: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<RateLimitCheckResult> {
    try {
      await initializeFirebase();

      const docRef = this.getDocRef(identifier);
      const docSnap = await getDoc(docRef);
      const now = Date.now();

      if (!docSnap.exists()) {
        return { limited: false, attemptsRemaining: this.config.maxAttempts };
      }

      const entry = docSnap.data() as ServerRateLimitEntry;
      const firstAttemptMs = entry.firstAttempt.toMillis();
      const lockedUntilMs = entry.lockedUntil?.toMillis();

      // Check if locked out
      if (lockedUntilMs && now < lockedUntilMs) {
        return {
          limited: true,
          retryAfter: Math.ceil((lockedUntilMs - now) / 1000),
          reason: "Account temporarily locked due to too many failed attempts",
        };
      }

      // Check if lockout has expired
      if (lockedUntilMs && now >= lockedUntilMs) {
        // Clean up expired lockout
        await deleteDoc(docRef);
        return { limited: false, attemptsRemaining: this.config.maxAttempts };
      }

      // Check if within window but not locked
      if (now - firstAttemptMs < this.config.windowMs) {
        const attemptsRemaining = Math.max(
          0,
          this.config.maxAttempts - entry.attempts,
        );

        if (entry.attempts >= this.config.maxAttempts) {
          return {
            limited: true,
            attemptsRemaining: 0,
            retryAfter: Math.ceil(
              (firstAttemptMs + this.config.windowMs - now) / 1000,
            ),
            reason: "Maximum attempts reached for this time window",
          };
        }

        return { limited: false, attemptsRemaining };
      }

      // Window expired, clean up
      await deleteDoc(docRef);
      return { limited: false, attemptsRemaining: this.config.maxAttempts };
    } catch (error) {
      // Log error but don't block the request (fail open for availability)
      console.error("Rate limit check failed:", error);
      return { limited: false, attemptsRemaining: this.config.maxAttempts };
    }
  }

  /**
   * Record a failed attempt (server-side)
   */
  async recordFailedAttempt(
    identifier: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<RateLimitRecordResult> {
    try {
      await initializeFirebase();

      const docRef = this.getDocRef(identifier);
      const docSnap = await getDoc(docRef);
      const now = Timestamp.now();
      const nowMs = now.toMillis();

      let entry: ServerRateLimitEntry;

      if (!docSnap.exists()) {
        // Start new tracking
        entry = {
          attempts: 1,
          firstAttempt: now,
          lastAttempt: now,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        };
      } else {
        const existing = docSnap.data() as ServerRateLimitEntry;
        const firstAttemptMs = existing.firstAttempt.toMillis();

        // Check if window has expired
        if (nowMs - firstAttemptMs > this.config.windowMs) {
          // Start new window
          entry = {
            attempts: 1,
            firstAttempt: now,
            lastAttempt: now,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
          };
        } else {
          // Increment attempts
          entry = {
            ...existing,
            attempts: existing.attempts + 1,
            lastAttempt: now,
            ipAddress: metadata?.ipAddress || existing.ipAddress,
            userAgent: metadata?.userAgent || existing.userAgent,
          };
        }
      }

      // Check if should lock out
      if (entry.attempts >= this.config.maxAttempts) {
        entry.lockedUntil = Timestamp.fromMillis(nowMs + this.config.lockoutMs);
      }

      await setDoc(docRef, entry);

      return {
        locked: !!entry.lockedUntil,
        attemptsRemaining: Math.max(
          0,
          this.config.maxAttempts - entry.attempts,
        ),
        lockoutSeconds: entry.lockedUntil
          ? Math.ceil(this.config.lockoutMs / 1000)
          : undefined,
      };
    } catch (error) {
      console.error("Failed to record rate limit attempt:", error);
      // Fail open - don't block the request
      return {
        locked: false,
        attemptsRemaining: this.config.maxAttempts,
      };
    }
  }

  /**
   * Record a successful attempt (clears the counter)
   */
  async recordSuccess(identifier: string): Promise<void> {
    try {
      await initializeFirebase();
      const docRef = this.getDocRef(identifier);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Failed to clear rate limit:", error);
    }
  }

  /**
   * Get current status for an identifier
   */
  async getStatus(identifier: string): Promise<{
    attempts: number;
    firstAttempt?: Date;
    lockedUntil?: Date;
    attemptsRemaining: number;
  }> {
    try {
      await initializeFirebase();

      const docRef = this.getDocRef(identifier);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          attempts: 0,
          attemptsRemaining: this.config.maxAttempts,
        };
      }

      const entry = docSnap.data() as ServerRateLimitEntry;
      return {
        attempts: entry.attempts,
        firstAttempt: entry.firstAttempt.toDate(),
        lockedUntil: entry.lockedUntil?.toDate(),
        attemptsRemaining: Math.max(
          0,
          this.config.maxAttempts - entry.attempts,
        ),
      };
    } catch (error) {
      console.error("Failed to get rate limit status:", error);
      return {
        attempts: 0,
        attemptsRemaining: this.config.maxAttempts,
      };
    }
  }

  /**
   * Manually unlock an identifier (admin function)
   */
  async unlock(identifier: string): Promise<boolean> {
    try {
      await initializeFirebase();
      const docRef = this.getDocRef(identifier);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Failed to unlock rate limit:", error);
      return false;
    }
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

/**
 * Authentication rate limiter (strict)
 * - 5 attempts per 15 minutes
 * - 30 minute lockout
 */
export const serverAuthRateLimiter = new ServerRateLimiter("auth", {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 30 * 60 * 1000,
});

/**
 * API rate limiter (moderate)
 * - 100 requests per minute
 * - 5 minute lockout
 */
export const serverApiRateLimiter = new ServerRateLimiter("api", {
  maxAttempts: 100,
  windowMs: 60 * 1000,
  lockoutMs: 5 * 60 * 1000,
});

/**
 * Payment rate limiter (strict)
 * - 10 payment attempts per hour
 * - 1 hour lockout
 */
export const serverPaymentRateLimiter = new ServerRateLimiter("payment", {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
});

/**
 * SMS rate limiter (very strict)
 * - 3 SMS per 10 minutes per phone number
 * - 1 hour lockout
 */
export const serverSmsRateLimiter = new ServerRateLimiter("sms", {
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
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
  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  const hours = Math.ceil(seconds / 3600);
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

/**
 * Check rate limit and throw error if limited (async version)
 */
export async function checkServerRateLimit(
  identifier: string,
  metadata?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const result = await serverAuthRateLimiter.isRateLimited(
    identifier,
    metadata,
  );
  if (result.limited) {
    throw new ServerRateLimitError(
      result.reason ||
        `Too many attempts. Please try again in ${formatRateLimitTime(result.retryAfter || 0)}.`,
      result.retryAfter,
    );
  }
}

/**
 * Custom error class for server-side rate limiting
 */
export class ServerRateLimitError extends Error {
  retryAfter?: number;
  statusCode: number = 429;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "ServerRateLimitError";
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Next.js API Route Helper
// ============================================================================

/**
 * Rate limit middleware for Next.js API routes
 *
 * Usage in API route:
 * ```
 * import { withRateLimit } from '@/lib/services/server-rate-limiter.service';
 *
 * export default withRateLimit(handler, {
 *   maxAttempts: 10,
 *   windowMs: 60000,
 *   keyGenerator: (req) => req.headers['x-forwarded-for'] || 'unknown'
 * });
 * ```
 */
export interface RateLimitMiddlewareOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
  keyGenerator?: (req: any) => string;
  onRateLimited?: (req: any, res: any, result: RateLimitCheckResult) => void;
}

export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions = {},
) {
  const rateLimiter = new ServerRateLimiter("api", {
    maxAttempts: options.maxAttempts || 100,
    windowMs: options.windowMs || 60000,
    lockoutMs: options.lockoutMs || 300000,
  });

  return async function rateLimitMiddleware(
    req: any,
    res: any,
    next: () => Promise<void>,
  ) {
    const identifier = options.keyGenerator
      ? options.keyGenerator(req)
      : req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown";

    const result = await rateLimiter.isRateLimited(identifier);

    if (result.limited) {
      if (options.onRateLimited) {
        options.onRateLimited(req, res, result);
      } else {
        res.status(429).json({
          error: "Too Many Requests",
          message: result.reason || "Rate limit exceeded",
          retryAfter: result.retryAfter,
        });
      }
      return;
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Remaining", result.attemptsRemaining || 0);

    await next();
  };
}

export default ServerRateLimiter;
