/**
 * Sentry Server Configuration
 * This file configures Sentry on the server side
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: 1.0,

  // Debug mode for development
  debug: false,

  // Filter out errors in development
  enabled: process.env.NODE_ENV === "production" || !!process.env.SENTRY_DSN,

  // Environment tag
  environment: process.env.NODE_ENV,

  // App version
  release: `ebursar@${process.env.npm_package_version || "1.0.0"}`,

  // Custom tags
  initialScope: {
    tags: {
      app: "ebursar",
      platform: "server",
    },
  },

  // Before send hook
  beforeSend(event) {
    // Remove sensitive data
    if (event.user) {
      delete event.user.ip_address;
    }

    // Don't include user passwords or auth tokens
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }

    return event;
  },
});
