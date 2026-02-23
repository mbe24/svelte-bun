/**
 * Shared OTLP utility functions used by server-side and client-side telemetry modules.
 */

/**
 * Convert severity level to OTLP severity number
 */
export function getSeverityNumber(level: 'info' | 'warn' | 'error' | 'debug'): number {
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
 * Get OTLP ingestion endpoint from PostHog host
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
export function getOTLPEndpoint(posthogHost: string, posthogOtlpHost?: string): string {
	if (posthogOtlpHost && posthogOtlpHost.length > 0) {
		return posthogOtlpHost;
	}

	try {
		const url = new URL(posthogHost);
		const hostname = url.hostname.toLowerCase();

		// If already using ingestion endpoint, return as-is
		if (hostname.endsWith('.i.posthog.com')) {
			return posthogHost;
		}

		// Map EU dashboard URLs to EU OTLP ingestion endpoint
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
	} catch {
		// Fallback to US ingestion endpoint
		return 'https://us.i.posthog.com';
	}
}
