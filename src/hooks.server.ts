import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import { getPostHog } from '$lib/posthog';

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const sessionId = event.cookies.get('session');

	// Enhance event.locals with telemetry context for use in load functions and API routes
	// This context is automatically available to all logs via resource attributes
	event.locals.telemetryContext = {
		sessionId: sessionId || undefined,
		distinctId: event.getClientAddress() || 'anonymous',
		ipAddress: event.getClientAddress() || undefined
	};

	if (sessionId) {
		// Pass platform.env for Cloudflare Workers compatibility
		const env = event.platform?.env as { DATABASE_URL?: string } | undefined;
		const userId = await validateSession(sessionId, env);
		if (userId) {
			event.locals.userId = userId;
			// Update telemetry context with user info
			event.locals.telemetryContext.userId = userId;
			event.locals.telemetryContext.distinctId = `user_${userId}`;
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
			
			// Capture the event
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
					user_id: userId || undefined,
					session_id: sessionId || undefined
				}
			});

			// For Cloudflare Workers, ensure events are flushed before response
			// Use waitUntil if available to prevent event loss
			if (event.platform?.context?.waitUntil) {
				event.platform.context.waitUntil(posthog.flush());
			}
		}
	} catch (error) {
		// Silently fail if PostHog logging fails - don't break the request
		console.error('PostHog logging error:', error);
	}

	return response;
};

