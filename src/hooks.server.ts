import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import { getPostHog } from '$lib/posthog';
import { 
	initTracer, 
	startRootSpan, 
	extractTraceContext,
	getTraceId,
	recordError,
	withSpan,
	setUserId
} from '$lib/tracing';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const sessionId = event.cookies.get('session');

	// Initialize tracer (idempotent)
	initTracer(event.platform?.env);

	// Extract incoming trace context from headers
	const parentContext = extractTraceContext(event.request.headers);

	// Determine route template for stable span naming
	// Use route ID (like /api/auth/login) instead of full URL to avoid high cardinality
	const routeId = event.route?.id || event.url.pathname;
	const spanName = `HTTP ${event.request.method} ${routeId}`;

	// Start root span with extracted parent context
	const span = startRootSpan(spanName, {
		attributes: {
			'http.method': event.request.method,
			'http.route': routeId,
			'http.target': event.url.pathname,
			'http.url': event.url.href,
			'http.scheme': event.url.protocol.replace(':', ''),
			'http.host': event.url.host,
		},
	}, parentContext);

	// Enhance event.locals with telemetry context for use in load functions and API routes
	// This context is automatically available to all logs via resource attributes
	event.locals.telemetryContext = {
		sessionId: sessionId || undefined,
		distinctId: event.getClientAddress() || 'anonymous',
		ipAddress: event.getClientAddress() || undefined
	};

	// Validate session and attach user info
	if (sessionId) {
		// Pass platform.env for Cloudflare Workers compatibility
		const env = event.platform?.env as { DATABASE_URL?: string } | undefined;
		const userId = await validateSession(sessionId, env);
		if (userId) {
			event.locals.userId = userId;
			// Update telemetry context with user info
			event.locals.telemetryContext.userId = userId;
			event.locals.telemetryContext.distinctId = `user_${userId}`;
			// Set user ID on span with PII protection (hashed)
			setUserId(span, userId);
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	let response: Response | undefined;
	let error: Error | null = null;

	try {
		// Execute request handling within the span context
		response = await context.with(trace.setSpan(context.active(), span), async () => {
			return await resolve(event);
		});
	} catch (err) {
		error = err as Error;
		// Record error on span
		recordError(span, error);
		throw err;
	} finally {
		// Set HTTP status code
		const statusCode = error ? 500 : (response?.status || 500);
		span.setAttribute('http.status_code', statusCode);

		// Mark span status as error for 4xx/5xx
		if (statusCode >= 400) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: error ? error.message : `HTTP ${statusCode}`,
			});
		} else {
			span.setStatus({ code: SpanStatusCode.OK });
		}

		// Get trace ID for response header
		const traceId = getTraceId(span);

		// End the span
		span.end();

		// Add X-Trace-Id header to response
		if (response && traceId) {
			const headers = new Headers(response.headers);
			headers.set('X-Trace-Id', traceId);
			response = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
		}

		// Log structured line for correlation
		const duration = Date.now() - startTime;
		console.log(JSON.stringify({
			trace_id: traceId,
			method: event.request.method,
			route: routeId,
			status: statusCode,
			duration_ms: duration,
		}));
	}

	// Log HTTP request to PostHog if configured
	try {
		const posthog = getPostHog(event.platform?.env);
		if (posthog && response) {
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

	return response!;
};

