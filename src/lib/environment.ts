/**
 * Environment detection utilities
 * 
 * Provides consistent environment detection across the application
 * for both server-side and client-side code.
 */

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
	ENVIRONMENT?: string;
	CF_PAGES_BRANCH?: string;
}

/**
 * Determine the environment name for service identification
 * 
 * Priority:
 * 1. ENVIRONMENT if explicitly set
 * 2. CF_PAGES_BRANCH for Cloudflare Pages (production, preview, or branch name)
 * 3. NODE_ENV if set
 * 4. Defaults to 'development'
 * 
 * @param env - Environment configuration object
 * @returns Resolved environment name
 */
export function getEnvironmentName(env?: EnvironmentConfig): string {
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

/**
 * Get service name with environment suffix
 * 
 * @param env - Environment configuration object
 * @returns Service name in format: svelte-bun-{environment}
 */
export function getServiceName(env?: EnvironmentConfig): string {
	const environment = getEnvironmentName(env);
	return `svelte-bun-${environment}`;
}
