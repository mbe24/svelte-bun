import posthog from 'posthog-js';
import { browser } from '$app/environment';

let initialized = false;
let posthogApiKey = '';
let posthogHost = '';
let posthogOtlpHost = '';
let environment = 'development'; // Default environment

/**
 * Initialize PostHog client-side analytics
 * This should be called once on the client side
 */
export function initPostHogClient(apiKey: string, host?: string, otlpHost?: string, env?: string): void {
	if (!browser || initialized) {
		return;
	}

	posthogApiKey = apiKey;
	posthogHost = host || 'https://app.posthog.com';
	// Only set posthogOtlpHost if it's explicitly provided and not an empty string
	posthogOtlpHost = (otlpHost && otlpHost.length > 0) ? otlpHost : '';
	// Set environment - try to detect from hostname if not provided
	environment = env || detectEnvironment();

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
 * Detect environment from hostname
 */
function detectEnvironment(): string {
	if (!browser) return 'development';
	
	const hostname = window.location.hostname;
	
	// Production domains
	if (hostname === 'yourdomain.com' || hostname === 'www.yourdomain.com') {
		return 'production';
	}
	
	// Cloudflare Pages preview deployments
	if (hostname.includes('.pages.dev')) {
		return 'preview';
	}
	
	// Local development
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		return 'development';
	}
	
	// Default
	return 'development';
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
		console.warn('Failed to parse PostHog host URL:', posthogHost, e);
		// Fallback to US ingestion endpoint
		return 'https://us.i.posthog.com';
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
		const otlpEndpoint = getOTLPEndpoint(posthogHost, posthogOtlpHost);
		
		// Debug logging to help diagnose endpoint issues
		if (!otlpEndpoint || otlpEndpoint.length === 0) {
			console.error('OTLP endpoint is empty. posthogHost:', posthogHost, 'posthogOtlpHost:', posthogOtlpHost);
			return;
		}
		
		const otlpPayload = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{
								key: 'service.name',
								value: {
									stringValue: `svelte-bun-${environment}`
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

		const response = await fetch(`${otlpEndpoint}/i/v1/logs`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${posthogApiKey}`
			},
			body: JSON.stringify(otlpPayload)
		});

		if (!response.ok) {
			console.error('Failed to send OTLP logs to', `${otlpEndpoint}/i/v1/logs`, '- Status:', response.status, response.statusText);
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
