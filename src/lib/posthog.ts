import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

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
export function getPostHog(env?: { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string }): PostHog | null {
	// Try to get from environment variables
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined);

	if (!apiKey) {
		return null;
	}

	if (!posthogClient) {
		posthogClient = initPostHog(apiKey, host);
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
	}
}
