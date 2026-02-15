import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
let isInitializing = false;

/**
 * Initialize PostHog client with API key and host
 * @param apiKey - PostHog API key
 * @param host - PostHog host URL (defaults to https://app.posthog.com)
 */
export function initPostHog(apiKey: string, host?: string): PostHog {
	if (!posthogClient) {
		posthogClient = new PostHog(apiKey, {
			host: host || 'https://app.posthog.com'
		});
	}
	return posthogClient;
}

/**
 * Get PostHog client instance
 * @param env - Environment variables (optional, for Cloudflare Workers)
 */
export function getPostHog(env?: { PUBLIC_POSTHOG_API_KEY?: string; PUBLIC_POSTHOG_HOST?: string }): PostHog | null {
	// Try to get from environment variables
	// Check PUBLIC_ prefixed variables first (SvelteKit convention)
	const apiKey = env?.PUBLIC_POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.PUBLIC_POSTHOG_API_KEY : undefined);
	const host = env?.PUBLIC_POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.PUBLIC_POSTHOG_HOST : undefined);

	if (!apiKey) {
		return null;
	}

	// Use singleton pattern - return existing client if already initialized
	if (!posthogClient && !isInitializing) {
		isInitializing = true;
		posthogClient = initPostHog(apiKey, host);
		isInitializing = false;
	}

	return posthogClient;
}

/**
 * Shutdown PostHog client
 */
export async function shutdownPostHog(): Promise<void> {
	if (posthogClient) {
		await posthogClient.shutdown();
		posthogClient = null;
		isInitializing = false;
	}
}
