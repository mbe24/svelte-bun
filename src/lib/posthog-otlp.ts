/**
 * Server-side OTLP logging for PostHog
 */

import { getServiceName } from './environment';
import { getOTLPEndpoint, getSeverityNumber } from './otlp-utils';

export { getOTLPEndpoint };

/**
 * Send logs to PostHog using OTLP format
 */
async function sendOTLPLogs(logs: any[], apiKey: string, host: string, otlpHost?: string, env?: { ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): Promise<void> {
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
 * Log an exception to PostHog using OTLP
 */
export async function logServerException(
	error: Error,
	context: Record<string, any>,
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string; ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }
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
	env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string; POSTHOG_OTLP_HOST?: string; ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }
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
