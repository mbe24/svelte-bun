/**
 * Server-side OTLP logging for PostHog
 */

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
async function sendOTLPLogs(logs: any[], apiKey: string, host: string, otlpHost?: string): Promise<void> {
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
									stringValue: 'svelte-bun-server'
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

		const response = await fetch(`${otlpEndpoint}/v1/logs`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify(otlpPayload)
		});

		if (!response.ok) {
			console.error('[PostHog OTLP] Failed to send logs to', `${otlpEndpoint}/v1/logs`, '- Status:', response.status, response.statusText);
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
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
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

	await sendOTLPLogs([logRecord], apiKey, host, otlpHost);
}

/**
 * Log a custom message to PostHog using OTLP
 */
export async function logServerMessage(
	level: 'info' | 'warn' | 'error' | 'debug',
	message: string,
	properties: Record<string, any>,
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string }
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

	await sendOTLPLogs([logRecord], apiKey, host, otlpHost);
}
