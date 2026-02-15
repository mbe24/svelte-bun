/**
 * Server-side OTLP logging for PostHog
 */

/**
 * Send logs to PostHog using OTLP format
 */
async function sendOTLPLogs(logs: any[], apiKey: string, host: string): Promise<void> {
	try {
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

		const response = await fetch(`${host}/v1/logs`, {
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
