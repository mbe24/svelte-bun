import { getPostHog } from './posthog';

/**
 * Feature flag interface to decouple from specific feature flag provider implementations
 */
export interface FeatureFlagProvider {
	/**
	 * Check if a feature flag is enabled for a user
	 * @param flagKey - The feature flag key
	 * @param distinctId - User identifier (e.g., user ID, session ID, or anonymous ID)
	 * @param defaultValue - Default value to return if the flag cannot be evaluated
	 * @returns Promise resolving to whether the flag is enabled
	 */
	isFeatureEnabled(
		flagKey: string,
		distinctId: string,
		defaultValue: boolean
	): Promise<boolean>;

	/**
	 * Get the payload for a feature flag
	 * @param flagKey - The feature flag key
	 * @param distinctId - User identifier
	 * @returns Promise resolving to the flag payload (if any)
	 */
	getFeatureFlagPayload(flagKey: string, distinctId: string): Promise<unknown>;
}

/**
 * PostHog implementation of the feature flag provider
 */
export class PostHogFeatureFlagProvider implements FeatureFlagProvider {
	constructor(
		private env?: {
			POSTHOG_API_KEY?: string;
			POSTHOG_HOST?: string;
		}
	) {}

	async isFeatureEnabled(
		flagKey: string,
		distinctId: string,
		defaultValue: boolean
	): Promise<boolean> {
		const posthog = getPostHog(this.env);

		if (!posthog) {
			return defaultValue;
		}

		try {
			const isEnabled = await posthog.isFeatureEnabled(flagKey, distinctId);
			return isEnabled ?? defaultValue;
		} catch (error) {
			console.error(`Error checking feature flag ${flagKey}:`, error);
			return defaultValue;
		}
	}

	async getFeatureFlagPayload(flagKey: string, distinctId: string): Promise<unknown> {
		const posthog = getPostHog(this.env);

		if (!posthog) {
			return null;
		}

		try {
			return await posthog.getFeatureFlagPayload(flagKey, distinctId);
		} catch (error) {
			console.error(`Error getting feature flag payload for ${flagKey}:`, error);
			return null;
		}
	}
}

/**
 * Feature flag keys following best practices:
 * - Use lowercase with hyphens
 * - Prefix with feature domain/area
 * - Be descriptive but concise
 */
export const FeatureFlags = {
	/**
	 * Enable rate limiting for counter operations
	 * When enabled, users are limited to 3 counter actions per 10 seconds
	 * Default: true (rate limiting is enabled by default)
	 */
	RATE_LIMIT_COUNTER: 'rate-limit-counter',
} as const;

/**
 * Get a feature flag provider instance
 * @param env - Environment variables
 * @returns FeatureFlagProvider instance
 */
export function getFeatureFlagProvider(env?: {
	POSTHOG_API_KEY?: string;
	POSTHOG_HOST?: string;
}): FeatureFlagProvider {
	return new PostHogFeatureFlagProvider(env);
}
