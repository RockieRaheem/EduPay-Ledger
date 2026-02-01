/**
 * Sentry Client Configuration
 * This file configures Sentry on the client side
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Performance monitoring
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out errors in development
  enabled:
    process.env.NODE_ENV === "production" ||
    !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment tag
  environment: process.env.NODE_ENV,

  // App version
  release: `ebursar@${process.env.npm_package_version || "1.0.0"}`,

  // Don't send default PII
  sendDefaultPii: false,

  // Custom tags
  initialScope: {
    tags: {
      app: "ebursar",
      platform: "web",
    },
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    /Extension context/i,
    /chrome-extension/i,
    // Network errors that are expected
    "Network request failed",
    "Failed to fetch",
    // Firebase auth expected errors
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    // IndexedDB expected errors
    "AbortError",
  ],

  // Before send hook to sanitize data
  beforeSend(event) {
    // Don't send errors in demo mode
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("ebursar_demo_mode") === "true"
    ) {
      return null;
    }

    // Remove sensitive data
    if (event.user) {
      delete event.user.ip_address;
    }

    return event;
  },
});
