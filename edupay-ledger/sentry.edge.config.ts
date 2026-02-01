/**
 * Sentry Edge Configuration
 * This file configures Sentry for Edge runtime
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: 1.0,

  // Debug mode
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
      platform: "edge",
    },
  },
});
