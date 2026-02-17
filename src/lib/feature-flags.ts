import { getPostHog } from './posthog';

/**
 * Feature flag service interface to decouple from specific feature flag implementations
 */
export interface FeatureFlagService {
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
	 * Check if a feature flag is enabled without user-specific targeting
	 * Useful for global feature flags that don't require user context
	 * @param flagKey - The feature flag key
	 * @param defaultValue - Default value to return if the flag cannot be evaluated
	 * @returns Promise resolving to whether the flag is enabled
	 */
	isFeatureEnabledGlobal(flagKey: string, defaultValue: boolean): Promise<boolean>;
}

/**
 * Cache entry for feature flag values
 */
interface CacheEntry {
	value: boolean;
	expiresAt: number;
}

/**
 * PostHog implementation of the feature flag service with caching
 */
export class PostHogFeatureFlagService implements FeatureFlagService {
	private cache: Map<string, CacheEntry> = new Map();
	private cacheTTL: number;

	constructor(
		private env?: {
			POSTHOG_API_KEY?: string;
			POSTHOG_HOST?: string;
			FEATURE_FLAG_CACHE_TTL_MS?: string;
		}
	) {
		// Default to 10 minutes (600000ms), or use env variable
		const ttlFromEnv = env?.FEATURE_FLAG_CACHE_TTL_MS
			? parseInt(env.FEATURE_FLAG_CACHE_TTL_MS, 10)
			: 600000;
		this.cacheTTL = isNaN(ttlFromEnv) ? 600000 : ttlFromEnv;
	}

	/**
	 * Get cache key for a flag
	 */
	private getCacheKey(flagKey: string, distinctId: string): string {
		return `${flagKey}:${distinctId}`;
	}

	/**
	 * Get cached value if available and not expired
	 */
	private getCachedValue(cacheKey: string): boolean | null {
		const entry = this.cache.get(cacheKey);
		if (!entry) {
			return null;
		}

		const now = Date.now();
		if (now > entry.expiresAt) {
			// Cache expired, remove it
			this.cache.delete(cacheKey);
			return null;
		}

		return entry.value;
	}

	/**
	 * Set cached value
	 */
	private setCachedValue(cacheKey: string, value: boolean): void {
		const expiresAt = Date.now() + this.cacheTTL;
		this.cache.set(cacheKey, { value, expiresAt });
	}

	async isFeatureEnabled(
		flagKey: string,
		distinctId: string,
		defaultValue: boolean
	): Promise<boolean> {
		const cacheKey = this.getCacheKey(flagKey, distinctId);

		// Check cache first
		const cachedValue = this.getCachedValue(cacheKey);
		if (cachedValue !== null) {
			return cachedValue;
		}

		const posthog = getPostHog(this.env);

		if (!posthog) {
			return defaultValue;
		}

		try {
			const isEnabled = await posthog.isFeatureEnabled(flagKey, distinctId);
			const result = isEnabled ?? defaultValue;

			// Cache the result
			this.setCachedValue(cacheKey, result);

			return result;
		} catch (error) {
			console.error(`Error checking feature flag ${flagKey}:`, error);
			return defaultValue;
		}
	}

	async isFeatureEnabledGlobal(flagKey: string, defaultValue: boolean): Promise<boolean> {
		// Use a generic distinct ID for global flags
		return this.isFeatureEnabled(flagKey, 'global', defaultValue);
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
 * Get a feature flag service instance
 * @param env - Environment variables
 * @returns FeatureFlagService instance
 */
export function getFeatureFlagService(env?: {
	POSTHOG_API_KEY?: string;
	POSTHOG_HOST?: string;
	FEATURE_FLAG_CACHE_TTL_MS?: string;
}): FeatureFlagService {
	return new PostHogFeatureFlagService(env);
}

/**
 * @deprecated Use getFeatureFlagService instead
 */
export const getFeatureFlagProvider = getFeatureFlagService;
