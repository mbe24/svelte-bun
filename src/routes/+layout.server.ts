import type { LayoutServerLoad } from './$types';
import { logLoadFunction } from '$lib/telemetry';

const ROUTE_ID = '/layout';

/**
 * Determine the environment name for service identification
 * Priority:
 * 1. ENVIRONMENT if explicitly set
 * 2. CF_PAGES_BRANCH for Cloudflare Pages (production, preview, or branch name)
 * 3. NODE_ENV if set
 * 4. Defaults to 'development'
 */
function getEnvironmentName(env?: { ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): string {
	// Check explicit ENVIRONMENT first
	if (env?.ENVIRONMENT) {
		return env.ENVIRONMENT;
	}
	
	// For Cloudflare Pages, use CF_PAGES_BRANCH
	// 'main' or 'master' branch -> 'production'
	// Other branches -> 'preview'
	if (env?.CF_PAGES_BRANCH) {
		const branch = env.CF_PAGES_BRANCH;
		if (branch === 'main' || branch === 'master') {
			return 'production';
		}
		return 'preview';
	}
	
	// Fallback to NODE_ENV if available
	if (typeof process !== 'undefined' && process.env.NODE_ENV) {
		return process.env.NODE_ENV;
	}
	
	// Default to development
	return 'development';
}

export const load: LayoutServerLoad = async ({ platform, locals, route, isDataRequest }) => {
	const startTime = Date.now();
	
	try {
		// Get PostHog configuration from environment variables
		const env = platform?.env as { 
			POSTHOG_API_KEY?: string; 
			POSTHOG_HOST?: string; 
			POSTHOG_OTLP_HOST?: string;
			ENVIRONMENT?: string;
			CF_PAGES_BRANCH?: string;
		} | undefined;
		const posthogApiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
		const posthogHost = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined);
		const posthogOtlpHost = env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);

		const result = {
			posthog: (posthogApiKey && typeof posthogApiKey === 'string' && posthogApiKey.length > 0) 
				? {
					apiKey: posthogApiKey,
					host: posthogHost || undefined,
					otlpHost: posthogOtlpHost || undefined,
					environment: getEnvironmentName(env)
				}
				: undefined
		};

		// Log load function performance
		const duration = Date.now() - startTime;
		await logLoadFunction(route.id || ROUTE_ID, duration, {
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			isDataRequest: isDataRequest || false,
			cacheStatus: 'BYPASS', // Root layout typically doesn't cache
			success: true
		}, env);

		return result;
	} catch (error) {
		const duration = Date.now() - startTime;
		const env = platform?.env as { 
			POSTHOG_API_KEY?: string; 
			POSTHOG_HOST?: string; 
			POSTHOG_OTLP_HOST?: string;
			ENVIRONMENT?: string;
			CF_PAGES_BRANCH?: string;
		} | undefined;
		
		await logLoadFunction(route.id || ROUTE_ID, duration, {
			userId: locals.telemetryContext?.userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId,
			isDataRequest: isDataRequest || false,
			cacheStatus: 'BYPASS',
			success: false,
			errorMessage: error instanceof Error ? error.message : String(error)
		}, env);
		
		throw error;
	}
};
