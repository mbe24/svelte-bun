/**
 * Server-side OTLP logging for PostHog
 */

/**
 * Determine the environment name for service identification
 * Priority:
 * 1. POSTHOG_ENVIRONMENT if explicitly set
 * 2. CF_PAGES_BRANCH for Cloudflare Pages (production, preview, or branch name)
 * 3. NODE_ENV if set
 * 4. Defaults to 'development'
 */
function getEnvironmentName(env?: { POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): string {
	// Check explicit POSTHOG_ENVIRONMENT first
	if (env?.POSTHOG_ENVIRONMENT) {
		return env.POSTHOG_ENVIRONMENT;
	}
	
	// For Cloudflare Pages, use CF_PAGES_BRANCH
	// 'main' or 'master' branch -> 'production'
	// Other branches -> 'preview'
	if (env?.CF_PAGES_BRANCH) {
		const branch = env.CF_PAGES_BRANCH;
		if (branch === 'main' || branch === 'master') {
			return 'production';
		}
		return 'preview';
	}
	
	// Fallback to NODE_ENV if available
	if (typeof process !== 'undefined' && process.env.NODE_ENV) {
		return process.env.NODE_ENV;
	}
	
	// Default to development
	return 'development';
}

/**
 * Get service name with environment suffix
 */
function getServiceName(env?: { POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): string {
	const environment = getEnvironmentName(env);
	return `svelte-bun-${environment}`;
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
		console.warn('[PostHog OTLP] Failed to parse PostHog host URL:', posthogHost, e);
		// Fallback to US ingestion endpoint
		return 'https://us.i.posthog.com';
	}
}

/**
 * Send logs to PostHog using OTLP format
 */
async function sendOTLPLogs(logs: any[], apiKey: string, host: string, otlpHost?: string, env?: { POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): Promise<void> {
	try {
		const otlpEndpoint = getOTLPEndpoint(host, otlpHost);
		
		const otlpPayload = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: {
									stringValue: getServiceName(env)
								}
			}
						]
					},
					scopeLogs: [
						{
							scope: {
								name: 'server'
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
			console.error('[PostHog OTLP] Failed to send logs to', `${otlpEndpoint}/i/v1/logs`, '- Status:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('[PostHog OTLP] Error sending logs:', error);
	}
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
 * Log an exception to PostHog using OTLP
 */
export async function logServerException(
	error: Error,
	context: Record<string, any>,
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string; POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }
): Promise<void> {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';
	const otlpHost = env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);

	if (!apiKey) {
		return;
	}

	const logRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: 17, // ERROR
		severityText: 'ERROR',
		body: {
			stringValue: error.message
		},
		attributes: [
			{
				key: 'exception.type',
				value: {
					stringValue: error.name
				}
			},
			{
				key: 'exception.message',
				value: {
					stringValue: error.message
				}
			},
			{
				key: 'exception.stacktrace',
				value: {
					stringValue: error.stack || ''
				}
			},
			...Object.entries(context).map(([key, value]) => ({
				key,
				value: {
					stringValue: String(value)
				}
			}))
		]
	};

	await sendOTLPLogs([logRecord], apiKey, host, otlpHost, env);
}

/**
 * Log a custom message to PostHog using OTLP
 */
export async function logServerMessage(
	level: 'info' | 'warn' | 'error' | 'debug',
	message: string,
	properties: Record<string, any>,
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string; POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }
): Promise<void> {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';
	const otlpHost = env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);

	if (!apiKey) {
		return;
	}

	const logRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: getSeverityNumber(level),
		severityText: level.toUpperCase(),
		body: {
			stringValue: message
		},
		attributes: Object.entries(properties).map(([key, value]) => ({
			key,
			value: {
				stringValue: String(value)
			}
		}))
	};

	await sendOTLPLogs([logRecord], apiKey, host, otlpHost, env);
}
