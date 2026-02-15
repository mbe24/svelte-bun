import posthog from 'posthog-js';
import { browser } from '$app/environment';

let initialized = false;
let posthogApiKey = '';
let posthogHost = '';

/**
 * Initialize PostHog client-side analytics
 * This should be called once on the client side
 */
export function initPostHogClient(apiKey: string, host?: string): void {
	if (!browser || initialized) {
		return;
	}

	posthogApiKey = apiKey;
	posthogHost = host || 'https://app.posthog.com';

	posthog.init(apiKey, {
		api_host: posthogHost,
		// Disable automatic pageview tracking - we'll handle it manually in +layout.svelte
		capture_pageview: false,
		capture_pageleave: true,
		// Enable session recording (optional)
		// session_recording: {
		// 	recordCrossOriginIframes: false
		// }
	});

	initialized = true;
}

/**
 * Get the PostHog client instance
 */
export function getPostHogClient() {
	if (!browser) {
		return null;
	}
	return initialized ? posthog : null;
}

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
async function sendOTLPLogs(logs: any[]): Promise<void> {
	if (!browser || !initialized || !posthogApiKey) {
		return;
	}

	try {
		const otlpEndpoint = getOTLPEndpoint(posthogHost);
		
		const otlpPayload = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: {
									stringValue: 'svelte-bun-app'
								}
							}
						]
					},
					scopeLogs: [
						{
							scope: {
								name: 'svelte-app'
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
				'Authorization': `Bearer ${posthogApiKey}`
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
export async function logException(error: Error, context?: Record<string, any>): Promise<void> {
	if (!browser || !initialized) {
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
			...(context ? Object.entries(context).map(([key, value]) => ({
				key,
				value: {
					stringValue: String(value)
				}
			})) : [])
		]
	};

	await sendOTLPLogs([logRecord]);
}

/**
 * Log a custom message to PostHog using OTLP
 */
export async function logMessage(level: 'info' | 'warn' | 'error' | 'debug', message: string, properties?: Record<string, any>): Promise<void> {
	if (!browser || !initialized) {
		return;
	}

	const logRecord = {
		timeUnixNano: String(Date.now() * 1000000),
		severityNumber: getSeverityNumber(level),
		severityText: level.toUpperCase(),
		body: {
			stringValue: message
		},
		attributes: properties ? Object.entries(properties).map(([key, value]) => ({
			key,
			value: {
				stringValue: String(value)
			}
		})) : []
	};

	await sendOTLPLogs([logRecord]);
}

/**
 * Identify a user in PostHog
 */
export function identifyUser(userId: string | number, properties?: Record<string, any>): void {
	if (!browser || !initialized) {
		return;
	}

	posthog.identify(userId.toString(), properties);
}

/**
 * Reset PostHog identity (on logout)
 */
export function resetPostHog(): void {
	if (!browser || !initialized) {
		return;
	}

	posthog.reset();
}
