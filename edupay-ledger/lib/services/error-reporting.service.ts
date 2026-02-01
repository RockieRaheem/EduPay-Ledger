/**
 * Error Reporting Service
 *
 * Centralized error handling and reporting for eBursar.
 * Integrates with Sentry for production error tracking.
 * In development, it provides detailed console logging.
 */

import { ErrorInfo } from "react";
import * as Sentry from "@sentry/nextjs";

// ============================================================================
// Types
// ============================================================================

export type ErrorSeverity = "fatal" | "error" | "warning" | "info";

export interface ErrorContext {
  userId?: string;
  schoolId?: string;
  page?: string;
  action?: string;
  componentStack?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorReport {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  userAgent?: string;
  url?: string;
  environment: "development" | "production" | "test";
}

interface ErrorReportingConfig {
  enabled: boolean;
  dsn?: string; // Sentry DSN or similar
  environment: "development" | "production" | "test";
  release?: string;
  sampleRate?: number;
  beforeSend?: (report: ErrorReport) => ErrorReport | null;
}

// ============================================================================
// Configuration
// ============================================================================

const config: ErrorReportingConfig = {
  enabled: true,
  environment: (process.env.NODE_ENV ||
    "development") as ErrorReportingConfig["environment"],
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
  sampleRate: 1.0, // 100% of errors
};

// In-memory error queue for batch sending
const errorQueue: ErrorReport[] = [];
const MAX_QUEUE_SIZE = 50;

// ============================================================================
// Utility Functions
// ============================================================================

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeErrorMessage(message: string): string {
  // Remove sensitive data patterns (emails, phone numbers, tokens)
  return message
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
    .replace(/\+?[0-9]{10,}/g, "[PHONE]")
    .replace(/Bearer\s+[A-Za-z0-9-_]+/g, "Bearer [TOKEN]")
    .replace(/eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, "[JWT]");
}

function getDeviceInfo(): Record<string, string> {
  if (typeof window === "undefined") {
    return { platform: "server" };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen?.width?.toString() || "unknown",
    screenHeight: window.screen?.height?.toString() || "unknown",
    viewportWidth: window.innerWidth?.toString() || "unknown",
    viewportHeight: window.innerHeight?.toString() || "unknown",
    online: navigator.onLine?.toString() || "unknown",
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Creates an error report object
 */
function createErrorReport(
  error: Error,
  severity: ErrorSeverity,
  context: ErrorContext = {},
): ErrorReport {
  const report: ErrorReport = {
    id: generateErrorId(),
    timestamp: new Date(),
    message: sanitizeErrorMessage(error.message),
    stack: error.stack,
    severity,
    context: {
      ...context,
      ...getDeviceInfo(),
    },
    url: typeof window !== "undefined" ? window.location.href : undefined,
    environment: config.environment,
  };

  return report;
}

/**
 * Sends error report to external service
 */
async function sendToService(report: ErrorReport): Promise<boolean> {
  // In production with Sentry DSN configured
  if (config.dsn && config.environment === "production") {
    try {
      // Sentry HTTP API endpoint
      const response = await fetch(`https://sentry.io/api/0/envelope/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-sentry-envelope",
          "X-Sentry-Auth": `Sentry sentry_key=${config.dsn}`,
        },
        body: JSON.stringify(report),
      });

      return response.ok;
    } catch (e) {
      console.error("Failed to send error to Sentry:", e);
      return false;
    }
  }

  // Store locally for development or when service unavailable
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(
        localStorage.getItem("ebursar_error_logs") || "[]",
      );
      stored.push(report);
      // Keep only last 100 errors
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100);
      }
      localStorage.setItem("ebursar_error_logs", JSON.stringify(stored));
    } catch (e) {
      // localStorage might be full or unavailable
    }
  }

  return true;
}

/**
 * Flushes the error queue
 */
async function flushErrorQueue(): Promise<void> {
  while (errorQueue.length > 0) {
    const report = errorQueue.shift();
    if (report) {
      await sendToService(report);
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Reports an error to the error tracking service
 */
export async function reportError(
  error: Error,
  context: ErrorContext = {},
  severity: ErrorSeverity = "error",
): Promise<string> {
  if (!config.enabled) {
    return "";
  }

  const report = createErrorReport(error, severity, context);

  // Apply beforeSend hook if configured
  if (config.beforeSend) {
    const modifiedReport = config.beforeSend(report);
    if (!modifiedReport) {
      return ""; // Report was filtered out
    }
  }

  // Log to console in development
  if (config.environment === "development") {
    const consoleMethod =
      severity === "fatal" || severity === "error"
        ? console.error
        : severity === "warning"
          ? console.warn
          : console.info;

    consoleMethod(`[${severity.toUpperCase()}] ${report.message}`, {
      id: report.id,
      context: report.context,
      stack: report.stack,
    });
  }

  // Send to Sentry in production
  if (config.environment === "production" || config.dsn) {
    const sentryLevel =
      severity === "fatal"
        ? "fatal"
        : severity === "error"
          ? "error"
          : severity === "warning"
            ? "warning"
            : "info";

    Sentry.withScope((scope) => {
      scope.setLevel(sentryLevel);
      scope.setTag("error_id", report.id);

      if (context.userId) scope.setUser({ id: context.userId });
      if (context.schoolId) scope.setTag("school_id", context.schoolId);
      if (context.page) scope.setTag("page", context.page);
      if (context.action) scope.setTag("action", context.action);
      if (context.additionalData) {
        scope.setExtras(context.additionalData);
      }

      Sentry.captureException(error);
    });
  }

  // Queue the report for local storage backup
  errorQueue.push(report);

  // Flush immediately for fatal/error, batch for others
  if (severity === "fatal" || severity === "error") {
    await flushErrorQueue();
  } else if (errorQueue.length >= MAX_QUEUE_SIZE) {
    await flushErrorQueue();
  }

  return report.id;
}

/**
 * Reports an error from React ErrorBoundary
 */
export async function reportErrorBoundary(
  error: Error,
  errorInfo: ErrorInfo,
  additionalContext: ErrorContext = {},
): Promise<string> {
  return reportError(
    error,
    {
      ...additionalContext,
      componentStack: errorInfo.componentStack || undefined,
    },
    "error",
  );
}

/**
 * Reports a warning (non-critical issue)
 */
export async function reportWarning(
  message: string,
  context: ErrorContext = {},
): Promise<string> {
  const warning = new Error(message);
  return reportError(warning, context, "warning");
}

/**
 * Reports an informational message for tracking
 */
export async function reportInfo(
  message: string,
  context: ErrorContext = {},
): Promise<string> {
  const info = new Error(message);
  return reportError(info, context, "info");
}

/**
 * Reports a fatal error (application crash)
 */
export async function reportFatal(
  error: Error,
  context: ErrorContext = {},
): Promise<string> {
  return reportError(error, context, "fatal");
}

/**
 * Sets user context for all subsequent error reports
 */
let globalContext: ErrorContext = {};

export function setUserContext(userId: string, schoolId?: string): void {
  globalContext = {
    ...globalContext,
    userId,
    schoolId,
  };
}

export function clearUserContext(): void {
  globalContext = {};
}

/**
 * Gets current global context
 */
export function getGlobalContext(): ErrorContext {
  return { ...globalContext };
}

/**
 * Gets stored error logs (for debugging)
 */
export function getStoredErrorLogs(): ErrorReport[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(localStorage.getItem("ebursar_error_logs") || "[]");
  } catch {
    return [];
  }
}

/**
 * Clears stored error logs
 */
export function clearStoredErrorLogs(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("ebursar_error_logs");
  }
}

/**
 * Wraps a function with automatic error reporting
 */
export function withErrorReporting<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, context: ErrorContext = {}): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        await reportError(error, context);
      }
      throw error;
    }
  }) as T;
}

// Set up global error handlers
if (typeof window !== "undefined") {
  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    reportError(error, { action: "unhandledrejection" }, "error");
  });

  // Global errors
  window.addEventListener("error", (event) => {
    const error =
      event.error instanceof Error ? event.error : new Error(event.message);

    reportError(
      error,
      {
        action: "global_error",
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      },
      "error",
    );
  });

  // Flush queue before page unload
  window.addEventListener("beforeunload", () => {
    flushErrorQueue();
  });
}
