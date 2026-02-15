import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import { handleErrorWithSentry } from "@sentry/sveltekit";
import * as Sentry from "@sentry/sveltekit";

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

	// Log HTTP request to Sentry
	const startTime = Date.now();
	
	// Add request context to Sentry
	Sentry.setContext('request', {
		url: event.url.toString(),
		method: event.request.method,
		headers: Object.fromEntries(event.request.headers.entries()),
		clientIP: event.getClientAddress(),
	});

	// Add user context if available
	if (event.locals.userId) {
		Sentry.setUser({ id: event.locals.userId.toString() });
	}

	const response = await resolve(event);

	// Log request with timing info
	const duration = Date.now() - startTime;
	
	Sentry.addBreadcrumb({
		category: 'http',
		message: `${event.request.method} ${event.url.pathname}`,
		level: 'info',
		data: {
			url: event.url.toString(),
			method: event.request.method,
			status: response.status,
			duration: `${duration}ms`,
			userId: event.locals.userId,
		},
	});

	return response;
};

// Export Sentry error handler
export const handleError = handleErrorWithSentry();
