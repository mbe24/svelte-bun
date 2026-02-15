import posthog from 'posthog-js';
import { browser } from '$app/environment';

let initialized = false;

/**
 * Initialize PostHog client-side analytics
 * This should be called once on the client side
 */
export function initPostHogClient(apiKey: string, host?: string): void {
	if (!browser || initialized) {
		return;
	}

	posthog.init(apiKey, {
		api_host: host || 'https://app.posthog.com',
		// Capture console logs
		capture_pageview: true,
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
 * Log an exception to PostHog
 */
export function logException(error: Error, context?: Record<string, any>): void {
	if (!browser || !initialized) {
		return;
	}

	posthog.capture('exception', {
		error_message: error.message,
		error_name: error.name,
		error_stack: error.stack,
		...context
	});
}

/**
 * Log a custom message to PostHog
 */
export function logMessage(level: 'info' | 'warn' | 'error' | 'debug', message: string, properties?: Record<string, any>): void {
	if (!browser || !initialized) {
		return;
	}

	posthog.capture('log', {
		level,
		message,
		...properties
	});
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
