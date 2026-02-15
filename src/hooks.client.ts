import { handleErrorWithSentry, init } from "@sentry/sveltekit";

if (import.meta.env.SENTRY_DSN) {
  init({
    dsn: import.meta.env.SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: 1.0,
    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/sveltekit/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
    // Enable logs to be sent to Sentry
    enableLogs: true,
  });
}

// Export Sentry error handler
export const handleError = handleErrorWithSentry();
