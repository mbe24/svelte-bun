/**
 * Server-side OTLP logging for PostHog
 */

/**
 * Map PostHog dashboard URL to OTLP ingestion endpoint
 * 
 * PostHog's OTLP logs endpoint is at a different subdomain than the dashboard:
 * - Dashboard: app.posthog.com or eu.posthog.com
 * - OTLP Ingestion: us.i.posthog.com or eu.i.posthog.com
 */
function getOTLPEndpoint(posthogHost: string): string {
	try {
		const url = new URL(posthogHost);
		const hostname = url.hostname.toLowerCase();
		
		// If already using ingestion endpoint, return as-is
		if (hostname.includes('.i.posthog.com')) {
			return posthogHost;
		}
		
		// Map dashboard URLs to ingestion endpoints
		if (hostname === 'eu.posthog.com' || hostname === 'app.eu.posthog.com') {
			return 'https://eu.i.posthog.com';
		}
		
		// Default to US ingestion endpoint
		// Handles: app.posthog.com, posthog.com, and self-hosted
		if (hostname === 'app.posthog.com' || hostname === 'posthog.com') {
			return 'https://us.i.posthog.com';
		}
		
		// For self-hosted instances, use the provided host as-is
		return posthogHost;
	} catch (e) {
		// If URL parsing fails, return as-is
		return posthogHost;
	}
}

/**
 * Send logs to PostHog using OTLP format
 */
async function sendOTLPLogs(logs: any[], apiKey: string, host: string): Promise<void> {
	try {
		const otlpEndpoint = getOTLPEndpoint(host);
		
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
			console.error('Failed to send OTLP logs:', response.statusText);
		}
	} catch (error) {
		console.error('Error sending OTLP logs:', error);
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
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string }
): Promise<void> {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';

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

	await sendOTLPLogs([logRecord], apiKey, host);
}

/**
 * Log a custom message to PostHog using OTLP
 */
export async function logServerMessage(
	level: 'info' | 'warn' | 'error' | 'debug',
	message: string,
	properties: Record<string, any>,
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string }
): Promise<void> {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';

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

	await sendOTLPLogs([logRecord], apiKey, host);
}
