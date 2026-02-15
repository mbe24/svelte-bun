# Advanced Telemetry with OpenTelemetry Protocol (OTLP)

This guide explains how to use the four types of telemetry signals implemented in this SvelteKit application.

## Overview

The application implements comprehensive telemetry logging using OpenTelemetry Protocol (OTLP) to PostHog's Logs tab. All logs automatically include **user and session context** for correlation, making debugging and performance analysis easier.

## Four Types of Telemetry Signals

### 1. Database & External Fetch Latency (Spans as Logs)

Track database queries and external API calls with timing and metadata.

#### Database Query Logging

```typescript
import { wrapDatabaseQuery } from '$lib/telemetry';

// Automatic logging with wrapped query
const users = await wrapDatabaseQuery(
	() => db.select().from(users).where(eq(users.id, userId)),
	'users',
	'SELECT',
	{
		userId: locals.telemetryContext?.userId,
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId
	},
	platform?.env
);

// Manual logging
import { logDatabaseQuery } from '$lib/telemetry';

const startTime = Date.now();
try {
	const result = await db.select().from(users);
	const duration = Date.now() - startTime;
	
	await logDatabaseQuery('SELECT', 'users', duration, {
		userId: locals.telemetryContext?.userId,
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId,
		rowCount: result.length,
		success: true
	}, platform?.env);
	
	return result;
} catch (error) {
	const duration = Date.now() - startTime;
	await logDatabaseQuery('SELECT', 'users', duration, {
		userId: locals.telemetryContext?.userId,
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId,
		success: false,
		errorMessage: error.message
	}, platform?.env);
	throw error;
}
```

**Logged Attributes:**
- `db.system`: PostgreSQL
- `db.operation`: SELECT, INSERT, UPDATE, DELETE
- `db.table`: Table name
- `duration_ms`: Query duration
- `db.row_count`: Number of rows affected
- `success`: true/false
- `error.message`: Error details if failed

#### External API Call Logging

```typescript
import { trackedFetch } from '$lib/telemetry';

// Automatic logging with tracked fetch
const response = await trackedFetch('https://api.example.com/data', {
	method: 'POST',
	body: JSON.stringify({ data }),
	context: {
		userId: locals.telemetryContext?.userId,
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId
	},
	env: platform?.env
});

// Manual logging
import { logExternalFetch } from '$lib/telemetry';

const startTime = Date.now();
try {
	const response = await fetch('https://api.example.com/data');
	const duration = Date.now() - startTime;
	
	await logExternalFetch(
		'https://api.example.com/data',
		'GET',
		duration,
		{
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			statusCode: response.status,
			success: response.ok
		},
		platform?.env
	);
} catch (error) {
	const duration = Date.now() - startTime;
	await logExternalFetch(
		'https://api.example.com/data',
		'GET',
		duration,
		{
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			success: false,
			errorMessage: error.message
		},
		platform?.env
	);
}
```

**Logged Attributes:**
- `http.method`: GET, POST, etc.
- `http.url`: Sanitized URL (query params removed)
- `duration_ms`: Request duration
- `http.status_code`: Response status
- `success`: true/false
- `error.message`: Error details if failed

### 2. User & Session Context (Automatic Correlation)

All logs automatically include user and session context through **Resource Attributes**. This is set up in `hooks.server.ts` and available in `locals.telemetryContext`.

**Automatic Context Attributes:**
- `user.id`: Authenticated user ID
- `posthog.distinct_id`: PostHog distinct ID (user_${userId} or IP address)
- `session.id`: Session ID from cookie
- `service.name`: svelte-bun-server

**Usage:**
```typescript
// Context is automatically available in:
// - event.locals.telemetryContext in server-side code
// - Passed to all telemetry logging functions

// In API routes
export const GET: RequestHandler = async ({ locals, platform }) => {
	await logDatabaseQuery('SELECT', 'products', duration, {
		userId: locals.telemetryContext?.userId, // ← Automatic correlation
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId,
		success: true
	}, platform?.env);
};
```

### 3. SvelteKit Load Function Performance

Track SvelteKit load function performance with cache status and client-side navigation detection.

```typescript
import type { PageServerLoad } from './$types';
import { logLoadFunction } from '$lib/telemetry';

export const load: PageServerLoad = async ({ locals, platform, route, isDataRequest }) => {
	const startTime = Date.now();
	
	try {
		const data = await fetchData();
		const duration = Date.now() - startTime;
		
		await logLoadFunction(route.id || 'unknown', duration, {
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			isDataRequest: isDataRequest || false, // true for client-side navigation
			cacheStatus: data.fromCache ? 'HIT' : 'MISS',
			success: true
		}, platform?.env);
		
		return { data };
	} catch (error) {
		const duration = Date.now() - startTime;
		
		await logLoadFunction(route.id || 'unknown', duration, {
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			isDataRequest: isDataRequest || false,
			cacheStatus: 'BYPASS',
			success: false,
			errorMessage: error.message
		}, platform?.env);
		
		throw error;
	}
};
```

**Logged Attributes:**
- `route.id`: SvelteKit route ID (e.g., /products/[id])
- `duration_ms`: Load function duration
- `is_data_request`: true for client-side navigation, false for initial page load
- `cache_status`: HIT, MISS, or BYPASS
- `success`: true/false
- `error.message`: Error details if failed

### 4. Security & Authentication Events

Track authentication events with security context for anomaly detection.

```typescript
import { logAuthEvent } from '$lib/telemetry';

// Successful login
await logAuthEvent('login', {
	userId: user.id,
	sessionId: sessionId,
	distinctId: `user_${user.id}`,
	ipAddress: getClientAddress(),
	userAgent: request.headers.get('user-agent') || undefined,
	success: true,
	metadata: { 
		username: user.username,
		login_duration_ms: '250'
	}
}, platform?.env);

// Failed login attempt
await logAuthEvent('login_failure', {
	distinctId: locals.telemetryContext?.distinctId,
	ipAddress: getClientAddress(),
	userAgent: request.headers.get('user-agent') || undefined,
	success: false,
	errorMessage: 'Invalid password',
	metadata: { username: attemptedUsername }
}, platform?.env);

// Other auth events
await logAuthEvent('logout', { /* ... */ }, platform?.env);
await logAuthEvent('register', { /* ... */ }, platform?.env);
await logAuthEvent('password_reset', { /* ... */ }, platform?.env);
await logAuthEvent('session_expired', { /* ... */ }, platform?.env);
```

**Logged Attributes:**
- `auth.event_type`: login, logout, register, password_reset, login_failure, session_expired
- `auth.provider`: local, oauth_google, etc.
- `ip.address`: Client IP address (consider anonymizing)
- `user_agent`: Browser user agent
- `success`: true/false
- `error.message`: Error details if failed
- `metadata.*`: Custom metadata fields

## PostHog Analysis Features

With these telemetry signals, you can create powerful analyses in PostHog:

### 1. Slow Query Heatmap
Filter logs by `db.operation` and create a heatmap of `duration_ms` to identify slow queries across all users.

### 2. Cache Hit Rate Analysis
Filter logs by `span.kind: load_function` and analyze `cache_status` distribution to optimize caching strategy.

### 3. Authentication Anomaly Detection
Create an alert for when `auth.event_type: login_failure` exceeds a threshold (e.g., 50 failures from one IP in 1 minute).

### 4. User Journey Debugging
Use `posthog.distinct_id` or `user.id` to filter all logs for a specific user to see their complete journey including:
- Which pages they loaded
- Which database queries ran
- Which external APIs were called
- Any errors they encountered

### 5. Performance Regression Detection
Track `duration_ms` trends over time for specific operations to detect performance regressions.

## Best Practices

1. **Always use telemetryContext**: Pass `locals.telemetryContext` to all logging functions for automatic correlation.

2. **Wrap expensive operations**: Use `wrapDatabaseQuery()` and `trackedFetch()` for automatic performance logging.

3. **Log authentication events**: Always log authentication events for security monitoring.

4. **Sanitize sensitive data**: Never log passwords, tokens, or PII in query strings or metadata.

5. **Use consistent naming**: Use consistent operation names (SELECT, INSERT, etc.) and route IDs for easier filtering.

6. **Set cache status accurately**: Use HIT/MISS/BYPASS to track caching effectiveness.

7. **Include context in errors**: When logging errors, include enough context to debug without exposing sensitive data.

## Configuration

All telemetry logging requires the same PostHog configuration as the basic logging:

```bash
# .env or Cloudflare Pages environment variables
POSTHOG_API_KEY=phc_your_key_here
POSTHOG_HOST=https://app.posthog.com  # optional
```

Logs are automatically disabled if `POSTHOG_API_KEY` is not set, so telemetry is completely opt-in.

## Example: Complete API Route with Telemetry

```typescript
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { wrapDatabaseQuery, trackedFetch, logAuthEvent } from '$lib/telemetry';
import { getDb } from '$lib/db';
import { products } from '$lib/db/schema';

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	const productId = url.searchParams.get('id');
	
	if (!productId) {
		return json({ error: 'Product ID required' }, { status: 400 });
	}
	
	try {
		// Log database query with automatic correlation
		const db = getDb(platform?.env);
		const product = await wrapDatabaseQuery(
			() => db.select().from(products).where(eq(products.id, productId)),
			'products',
			'SELECT',
			{
				userId: locals.telemetryContext?.userId,
				sessionId: locals.telemetryContext?.sessionId,
				distinctId: locals.telemetryContext?.distinctId
			},
			platform?.env
		);
		
		if (!product.length) {
			return json({ error: 'Not found' }, { status: 404 });
		}
		
		// Fetch additional data from external API with tracking
		const enrichedData = await trackedFetch(
			`https://api.example.com/enrich/${productId}`,
			{
				method: 'GET',
				context: {
					userId: locals.telemetryContext?.userId,
					sessionId: locals.telemetryContext?.sessionId,
					distinctId: locals.telemetryContext?.distinctId
				},
				env: platform?.env
			}
		);
		
		return json({
			product: product[0],
			enriched: await enrichedData.json()
		});
	} catch (error) {
		console.error('Error fetching product:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
```

This example automatically logs:
- Database query with timing and correlation
- External API call with timing and correlation
- All logs include user ID, session ID, and distinct ID for filtering in PostHog
