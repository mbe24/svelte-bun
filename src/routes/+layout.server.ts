import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ platform }) => {
	// Get PostHog configuration from environment variables
	const env = platform?.env as { POSTHOG_API_KEY?: string; POSTHOG_HOST?: string } | undefined;
	const posthogApiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	const posthogHost = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined);

	return {
		posthog: {
			apiKey: posthogApiKey,
			host: posthogHost
		}
	};
};
