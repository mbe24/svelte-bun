import type { HandleClientError } from '@sveltejs/kit';
import { initPostHogClient, logException } from '$lib/posthog-client';

// Initialize PostHog on the client side
if (typeof window !== 'undefined') {
	const apiKey = import.meta.env.PUBLIC_POSTHOG_API_KEY;
	const host = import.meta.env.PUBLIC_POSTHOG_HOST;

	if (apiKey) {
		initPostHogClient(apiKey, host);
	}
}

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
