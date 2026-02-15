import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import * as Sentry from "@sentry/sveltekit";
import { handleErrorWithSentry } from "@sentry/sveltekit";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/sveltekit/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
    // Enable logs to be sent to Sentry
    enableLogs: true,
  });
}

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		// Pass platform.env for Cloudflare Workers compatibility
		const env = event.platform?.env as { DATABASE_URL?: string } | undefined;
		const userId = await validateSession(sessionId, env);
		if (userId) {
			event.locals.userId = userId;
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};

// Export Sentry error handler
export const handleError = handleErrorWithSentry();
