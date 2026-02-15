import type { HandleClientError } from '@sveltejs/kit';
import { logException } from '$lib/posthog-client';

// PostHog is initialized in +layout.svelte using data from +layout.server.ts

// Global error handler for client-side errors
export const handleError: HandleClientError = ({ error, event }) => {
	// Log the error to PostHog
	if (error instanceof Error) {
		logException(error, {
			url: event.url.pathname,
			route: event.route?.id || 'unknown'
		});
	}

	// Log to console for debugging
	console.error('Client error:', error);

	// Return a user-friendly error message
	return {
		message: 'An unexpected error occurred'
	};
};
