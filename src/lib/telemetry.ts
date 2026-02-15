/**
 * Comprehensive Telemetry Module for PostHog OTLP Logging
 * 
 * Implements four types of telemetry signals:
 * 1. Database & External Fetch Latency (Spans as Logs)
 * 2. User & Session Context (Correlation)
 * 3. SvelteKit Load Metadata
 * 4. Security & Auth Events
 */

interface OTLPAttribute {
	key: string;
	value: {
		stringValue: string;
	};
}

interface OTLPLogRecord {
	timeUnixNano: string;
	severityNumber: number;
	severityText: string;
	body: {
		stringValue: string;
	};
	attributes: OTLPAttribute[];
}

interface ResourceAttributes {
	'user.id'?: string | number;
	'posthog.distinct_id'?: string;
	'session.id'?: string;
	'service.name': string;
	[key: string]: string | number | undefined;
}

/**
 * Convert severity level to OTLP severity number
 */
function getSeverityNumber(level: 'info' | 'warn' | 'error' | 'debug'): number {
	switch (level) {
		case 'debug':
			return 5; // DEBUG
		case 'info':
			return 9; // INFO
		case 'warn':
			return 13; // WARN
		case 'error':
			return 17; // ERROR
		default:
			return 9; // INFO
	}
}

/**
 * Get OTLP ingestion endpoint
 * 
 * PostHog has two different API endpoints:
 * 1. Events API (Capture API) - For HTTP requests, page views, custom events
 *    - US: app.posthog.com or us.posthog.com
 *    - EU: eu.posthog.com
 * 
 * 2. OTLP Logs API - For logs, exceptions, telemetry
 *    - US: us.i.posthog.com
 *    - EU: eu.i.posthog.com
 * 
 * This function:
 * - Returns POSTHOG_OTLP_HOST if explicitly set
 * - Otherwise, automatically maps POSTHOG_HOST to the correct OTLP endpoint
 * - Falls back to US ingestion endpoint if mapping fails
 */
function getOTLPEndpoint(posthogHost: string, posthogOtlpHost?: string): string {
	// If OTLP host is explicitly set and not empty, use it
	if (posthogOtlpHost && posthogOtlpHost.length > 0) {
		return posthogOtlpHost;
	}
	
	// Otherwise, derive from posthogHost
	try {
		const url = new URL(posthogHost);
		const hostname = url.hostname.toLowerCase();
		
		// If already using ingestion endpoint, return as-is
		if (hostname.includes('.i.posthog.com')) {
			return posthogHost;
		}
		
		// Map dashboard URLs to OTLP ingestion endpoints
		if (hostname === 'eu.posthog.com' || hostname === 'app.eu.posthog.com') {
			return 'https://eu.i.posthog.com';
		}
		
		// Default to US OTLP ingestion endpoint
		// Handles: app.posthog.com, us.posthog.com, posthog.com
		if (hostname === 'app.posthog.com' || hostname === 'us.posthog.com' || hostname === 'posthog.com') {
			return 'https://us.i.posthog.com';
		}
		
		// For self-hosted instances, assume OTLP is at the same host
		return posthogHost;
	} catch (e) {
		console.warn('[PostHog Telemetry] Failed to parse PostHog host URL:', posthogHost, e);
		// Fallback to US ingestion endpoint
		return 'https://us.i.posthog.com';
	}
}

/**
 * Send OTLP logs to PostHog with resource attributes for correlation
 */
async function sendOTLPLogs(
	logs: OTLPLogRecord[],
	resourceAttributes: ResourceAttributes,
	apiKey: string,
	host: string,
	otlpHost?: string
): Promise<void> {
	try {
		const otlpEndpoint = getOTLPEndpoint(host, otlpHost);
		
		const otlpPayload = {
			resourceLogs: [
				{
					resource: {
						attributes: Object.entries(resourceAttributes).map(([key, value]) => ({
							key,
							value: {
								stringValue: String(value)
							}
						}))
					},
					scopeLogs: [
						{
							scope: {
								name: 'svelte-telemetry'
							},
							logRecords: logs
						}
					]
				}
			]
		};

		const response = await fetch(`${otlpEndpoint}/i/v1/logs`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify(otlpPayload)
		});

		if (!response.ok) {
			console.error('[PostHog Telemetry] Failed to send logs to', `${otlpEndpoint}/i/v1/logs`, '- Status:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('[PostHog Telemetry] Error sending logs:', error);
	}
}

/**
 * Get PostHog configuration from environment
 */
function getPostHogConfig(env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }): {
	apiKey: string | undefined;
	host: string;
	otlpHost: string | undefined;
} {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';
	const otlpHost = env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);
	return { apiKey, host, otlpHost };
}

/**
 * 1. Log Database Query Latency
 * 
 * Logs database operations with timing and query metadata
 */
export async function logDatabaseQuery(
	queryType: string, // e.g., 'SELECT', 'INSERT', 'UPDATE'
	table: string,
	durationMs: number,
	options: {
		userId?: number;
		sessionId?: string;
		distinctId?: string;
		queryHash?: string; // Sanitized query identifier
		rowCount?: number;
		success: boolean;
		errorMessage?: string;
		dbSystem?: string; // e.g., 'PostgreSQL', 'MySQL', 'SQLite'
	},
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
): Promise<void> {
	const { apiKey, host, otlpHost } = getPostHogConfig(env);
	if (!apiKey) return;

	const logRecord: OTLPLogRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: options.success ? 9 : 17, // INFO or ERROR
		severityText: options.success ? 'INFO' : 'ERROR',
		body: {
			stringValue: `Database ${queryType} on ${table} took ${durationMs}ms`
		},
		attributes: [
			{ key: 'db.system', value: { stringValue: options.dbSystem || 'PostgreSQL' } },
			{ key: 'db.operation', value: { stringValue: queryType } },
			{ key: 'db.table', value: { stringValue: table } },
			{ key: 'duration_ms', value: { stringValue: String(durationMs) } },
			{ key: 'span.kind', value: { stringValue: 'database' } },
			...(options.queryHash ? [{ key: 'db.query_hash', value: { stringValue: options.queryHash } }] : []),
			...(options.rowCount !== undefined ? [{ key: 'db.row_count', value: { stringValue: String(options.rowCount) } }] : []),
			{ key: 'success', value: { stringValue: String(options.success) } },
			...(options.errorMessage ? [{ key: 'error.message', value: { stringValue: options.errorMessage } }] : [])
		]
	};

	const resourceAttributes: ResourceAttributes = {
		'service.name': 'svelte-bun-server',
		...(options.userId ? { 'user.id': options.userId } : {}),
		...(options.sessionId ? { 'session.id': options.sessionId } : {}),
		...(options.distinctId ? { 'posthog.distinct_id': options.distinctId } : {})
	};

	await sendOTLPLogs([logRecord], resourceAttributes, apiKey, host, otlpHost);
}

/**
 * 2. Log External API Fetch Latency
 * 
 * Logs external API calls with timing and response metadata
 */
export async function logExternalFetch(
	url: string,
	method: string,
	durationMs: number,
	options: {
		userId?: number;
		sessionId?: string;
		distinctId?: string;
		statusCode?: number;
		success: boolean;
		errorMessage?: string;
	},
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
): Promise<void> {
	const { apiKey, host, otlpHost } = getPostHogConfig(env);
	if (!apiKey) return;

	// Sanitize URL to remove sensitive parameters
	const sanitizedUrl = url.split('?')[0];

	const logRecord: OTLPLogRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: options.success ? 9 : 17,
		severityText: options.success ? 'INFO' : 'ERROR',
		body: {
			stringValue: `External ${method} to ${sanitizedUrl} took ${durationMs}ms`
		},
		attributes: [
			{ key: 'http.method', value: { stringValue: method } },
			{ key: 'http.url', value: { stringValue: sanitizedUrl } },
			{ key: 'duration_ms', value: { stringValue: String(durationMs) } },
			{ key: 'span.kind', value: { stringValue: 'http_client' } },
			...(options.statusCode ? [{ key: 'http.status_code', value: { stringValue: String(options.statusCode) } }] : []),
			{ key: 'success', value: { stringValue: String(options.success) } },
			...(options.errorMessage ? [{ key: 'error.message', value: { stringValue: options.errorMessage } }] : [])
		]
	};

	const resourceAttributes: ResourceAttributes = {
		'service.name': 'svelte-bun-server',
		...(options.userId ? { 'user.id': options.userId } : {}),
		...(options.sessionId ? { 'session.id': options.sessionId } : {}),
		...(options.distinctId ? { 'posthog.distinct_id': options.distinctId } : {})
	};

	await sendOTLPLogs([logRecord], resourceAttributes, apiKey, host, otlpHost);
}

/**
 * 3. Log SvelteKit Load Function Performance
 * 
 * Logs SvelteKit load function execution with caching and performance metadata
 */
export async function logLoadFunction(
	routeId: string,
	durationMs: number,
	options: {
		userId?: number;
		sessionId?: string;
		distinctId?: string;
		isDataRequest: boolean; // true for client-side navigation
		cacheStatus: 'HIT' | 'MISS' | 'BYPASS';
		success: boolean;
		errorMessage?: string;
	},
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
): Promise<void> {
	const { apiKey, host, otlpHost } = getPostHogConfig(env);
	if (!apiKey) return;

	const logRecord: OTLPLogRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: options.success ? 9 : 17,
		severityText: options.success ? 'INFO' : 'ERROR',
		body: {
			stringValue: `Load function for ${routeId} took ${durationMs}ms (${options.cacheStatus})`
		},
		attributes: [
			{ key: 'route.id', value: { stringValue: routeId } },
			{ key: 'duration_ms', value: { stringValue: String(durationMs) } },
			{ key: 'is_data_request', value: { stringValue: String(options.isDataRequest) } },
			{ key: 'cache_status', value: { stringValue: options.cacheStatus } },
			{ key: 'span.kind', value: { stringValue: 'load_function' } },
			{ key: 'success', value: { stringValue: String(options.success) } },
			...(options.errorMessage ? [{ key: 'error.message', value: { stringValue: options.errorMessage } }] : [])
		]
	};

	const resourceAttributes: ResourceAttributes = {
		'service.name': 'svelte-bun-server',
		...(options.userId ? { 'user.id': options.userId } : {}),
		...(options.sessionId ? { 'session.id': options.sessionId } : {}),
		...(options.distinctId ? { 'posthog.distinct_id': options.distinctId } : {})
	};

	await sendOTLPLogs([logRecord], resourceAttributes, apiKey, host, otlpHost);
}

/**
 * 4. Log Security & Authentication Events
 * 
 * Logs authentication events with security context
 */
export async function logAuthEvent(
	eventType: 'login' | 'logout' | 'register' | 'password_reset' | 'login_failure' | 'session_expired',
	options: {
		userId?: number;
		sessionId?: string;
		distinctId?: string;
		provider?: string; // e.g., 'local', 'oauth_google'
		ipAddress?: string; // Consider anonymizing if needed
		userAgent?: string;
		success: boolean;
		errorMessage?: string;
		metadata?: Record<string, string>;
	},
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
): Promise<void> {
	const { apiKey, host, otlpHost } = getPostHogConfig(env);
	if (!apiKey) return;

	const logRecord: OTLPLogRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: options.success ? 9 : (eventType === 'login_failure' ? 13 : 17), // INFO, WARN, or ERROR
		severityText: options.success ? 'INFO' : (eventType === 'login_failure' ? 'WARN' : 'ERROR'),
		body: {
			stringValue: `Auth event: ${eventType} ${options.success ? 'succeeded' : 'failed'}`
		},
		attributes: [
			{ key: 'auth.event_type', value: { stringValue: eventType } },
			{ key: 'auth.provider', value: { stringValue: options.provider || 'local' } },
			...(options.ipAddress ? [{ key: 'ip.address', value: { stringValue: options.ipAddress } }] : []),
			...(options.userAgent ? [{ key: 'user_agent', value: { stringValue: options.userAgent } }] : []),
			{ key: 'success', value: { stringValue: String(options.success) } },
			...(options.errorMessage ? [{ key: 'error.message', value: { stringValue: options.errorMessage } }] : []),
			...(options.metadata ? Object.entries(options.metadata).map(([key, value]) => ({
				key: `metadata.${key}`,
				value: { stringValue: value }
			})) : [])
		]
	};

	const resourceAttributes: ResourceAttributes = {
		'service.name': 'svelte-bun-server',
		...(options.userId ? { 'user.id': options.userId } : {}),
		...(options.sessionId ? { 'session.id': options.sessionId } : {}),
		...(options.distinctId ? { 'posthog.distinct_id': options.distinctId } : {})
	};

	await sendOTLPLogs([logRecord], resourceAttributes, apiKey, host, otlpHost);
}

/**
 * Utility: Create a database query wrapper that automatically logs performance
 */
export function wrapDatabaseQuery<T>(
	queryFn: () => Promise<T>,
	table: string,
	queryType: string,
	context: {
		userId?: number;
		sessionId?: string;
		distinctId?: string;
	},
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
): Promise<T> {
	const startTime = Date.now();
	
	return queryFn()
		.then(result => {
			const duration = Date.now() - startTime;
			logDatabaseQuery(queryType, table, duration, {
				...context,
				success: true,
				rowCount: Array.isArray(result) ? result.length : undefined
			}, env).catch(err => console.error('Failed to log database query:', err));
			return result;
		})
		.catch(error => {
			const duration = Date.now() - startTime;
			logDatabaseQuery(queryType, table, duration, {
				...context,
				success: false,
				errorMessage: error.message
			}, env).catch(err => console.error('Failed to log database query:', err));
			throw error;
		});
}

/**
 * Utility: Create a fetch wrapper that automatically logs performance
 */
export async function trackedFetch(
	url: string,
	options: RequestInit & {
		context?: {
			userId?: number;
			sessionId?: string;
			distinctId?: string;
		};
		env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string };
	} = {}
): Promise<Response> {
	const startTime = Date.now();
	const method = options.method || 'GET';
	const { context = {}, env, ...fetchOptions } = options;
	
	try {
		const response = await fetch(url, fetchOptions);
		const duration = Date.now() - startTime;
		
		logExternalFetch(url, method, duration, {
			...context,
			statusCode: response.status,
			success: response.ok
		}, env).catch(err => console.error('Failed to log external fetch:', err));
		
		return response;
	} catch (error) {
		const duration = Date.now() - startTime;
		
		logExternalFetch(url, method, duration, {
			...context,
			success: false,
			errorMessage: error instanceof Error ? error.message : String(error)
		}, env).catch(err => console.error('Failed to log external fetch:', err));
		
		throw error;
	}
}
