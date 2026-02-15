import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import { getPostHog } from '$lib/posthog';

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
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

	const response = await resolve(event);

	// Log HTTP request to PostHog if configured
	try {
		const posthog = getPostHog(event.platform?.env);
		if (posthog) {
			const duration = Date.now() - startTime;
			const userId = event.locals.userId;
			
			// Create a distinct ID for the request (use userId if available, otherwise IP or a session identifier)
			const distinctId = userId ? `user_${userId}` : event.getClientAddress() || 'anonymous';
			
			posthog.capture({
				distinctId,
				event: 'http_request',
				properties: {
					method: event.request.method,
					path: event.url.pathname,
					status: response.status,
					duration_ms: duration,
					user_agent: event.request.headers.get('user-agent') || undefined,
					referer: event.request.headers.get('referer') || undefined,
					authenticated: !!userId,
					user_id: userId || undefined
				}
			});
		}
	} catch (error) {
		// Silently fail if PostHog logging fails - don't break the request
		console.error('PostHog logging error:', error);
	}

	return response;
};

