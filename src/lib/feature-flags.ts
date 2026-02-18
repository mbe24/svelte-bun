import { getPostHog } from './posthog';
import { getEnvironmentName, getServiceName } from './environment';

/**
 * Log feature flag evaluation to PostHog OTLP
 */
async function logFeatureFlagEvaluation(
	flagKey: string,
	distinctId: string,
	result: boolean,
	defaultValue: boolean,
	cacheHit: boolean,
	env?: {
		POSTHOG_API_KEY?: string;
		POSTHOG_HOST?: string;
		POSTHOG_OTLP_HOST?: string;
		ENVIRONMENT?: string;
		CF_PAGES_BRANCH?: string;
	}
): Promise<void> {
	const apiKey = env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
	if (!apiKey) return;

	const host = env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';
	const otlpHost = env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);

	try {
		// Determine OTLP endpoint
		const otlpEndpoint = getOTLPEndpoint(host, otlpHost);

		const logRecord = {
			timeUnixNano: String(Date.now() * 1000000),
			severityNumber: 5, // DEBUG
			severityText: 'DEBUG',
			body: {
				stringValue: `Feature flag "${flagKey}" evaluated to ${result} (${cacheHit ? 'cache hit' : 'fetched from PostHog'})`
			},
			attributes: [
				{ key: 'feature_flag.key', value: { stringValue: flagKey } },
				{ key: 'feature_flag.distinct_id', value: { stringValue: distinctId } },
				{ key: 'feature_flag.result', value: { stringValue: String(result) } },
				{ key: 'feature_flag.default_value', value: { stringValue: String(defaultValue) } },
				{ key: 'feature_flag.cache_hit', value: { stringValue: String(cacheHit) } },
				{ key: 'feature_flag.source', value: { stringValue: cacheHit ? 'cache' : 'posthog' } },
				{ key: 'span.kind', value: { stringValue: 'feature_flag' } }
			]
		};

		const otlpPayload = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{ key: 'service.name', value: { stringValue: getServiceName(env) } }
						]
					},
					scopeLogs: [
						{
							scope: {
								name: 'svelte-feature-flags'
							},
							logRecords: [logRecord]
						}
					]
				}
			]
		};

		await fetch(`${otlpEndpoint}/i/v1/logs`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify(otlpPayload)
		});
	} catch (error) {
		// Silently fail to not disrupt feature flag functionality
		console.error('[Feature Flag Telemetry] Error logging feature flag evaluation:', error);
	}
}

/**
 * Get OTLP ingestion endpoint from PostHog host
 */
function getOTLPEndpoint(posthogHost: string, posthogOtlpHost?: string): string {
	if (posthogOtlpHost && posthogOtlpHost.length > 0) {
		return posthogOtlpHost;
	}
	
	try {
		const url = new URL(posthogHost);
		const hostname = url.hostname.toLowerCase();
		
		if (hostname.includes('.i.posthog.com')) {
			return posthogHost;
		}
		
		if (hostname === 'eu.posthog.com' || hostname === 'app.eu.posthog.com') {
			return 'https://eu.i.posthog.com';
		}
		
		if (hostname === 'app.posthog.com' || hostname === 'us.posthog.com' || hostname === 'posthog.com') {
			return 'https://us.i.posthog.com';
		}
		
		return posthogHost;
	} catch (e) {
		return 'https://us.i.posthog.com';
	}
}

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
			POSTHOG_OTLP_HOST?: string;
			FEATURE_FLAG_CACHE_TTL_MS?: string;
			ENVIRONMENT?: string;
			CF_PAGES_BRANCH?: string;
		}
	) {
		// Default to 10 minutes (600000ms), or use env variable
		const ttlFromEnv = env?.FEATURE_FLAG_CACHE_TTL_MS
			? parseInt(env.FEATURE_FLAG_CACHE_TTL_MS, 10)
			: 600000;
		this.cacheTTL = isNaN(ttlFromEnv) ? 600000 : ttlFromEnv;
		
		// Log cache TTL configuration
		console.log(`[Feature Flag Service] Initialized with cache TTL: ${this.cacheTTL}ms (${this.cacheTTL / 1000}s)`);
		
		// Log initial cache TTL to PostHog OTLP
		this.logCacheTTLInitialization().catch(err => 
			console.error('[Feature Flag] Failed to log cache TTL initialization:', err)
		);
	}

	/**
	 * Log cache TTL initialization to PostHog OTLP
	 */
	private async logCacheTTLInitialization(): Promise<void> {
		const apiKey = this.env?.POSTHOG_API_KEY || (typeof process !== 'undefined' ? process.env.POSTHOG_API_KEY : undefined);
		if (!apiKey) return;

		const host = this.env?.POSTHOG_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_HOST : undefined) || 'https://app.posthog.com';
		const otlpHost = this.env?.POSTHOG_OTLP_HOST || (typeof process !== 'undefined' ? process.env.POSTHOG_OTLP_HOST : undefined);

		try {
			const otlpEndpoint = getOTLPEndpoint(host, otlpHost);

			const logRecord = {
				timeUnixNano: String(Date.now() * 1000000),
				severityNumber: 9, // INFO
				severityText: 'INFO',
				body: {
					stringValue: `Feature flag service initialized with cache TTL: ${this.cacheTTL}ms`
				},
				attributes: [
					{ key: 'feature_flag.cache_ttl_ms', value: { stringValue: String(this.cacheTTL) } },
					{ key: 'feature_flag.cache_ttl_seconds', value: { stringValue: String(this.cacheTTL / 1000) } },
					{ key: 'span.kind', value: { stringValue: 'feature_flag_init' } }
				]
			};

			const otlpPayload = {
				resourceLogs: [
					{
						resource: {
							attributes: [
								{ key: 'service.name', value: { stringValue: getServiceName(this.env) } }
							]
						},
						scopeLogs: [
							{
								scope: {
									name: 'svelte-feature-flags'
								},
								logRecords: [logRecord]
							}
						]
					}
				]
			};

			await fetch(`${otlpEndpoint}/i/v1/logs`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify(otlpPayload)
			});
		} catch (error) {
			// Silently fail
		}
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
			// Log cache hit
			logFeatureFlagEvaluation(flagKey, distinctId, cachedValue, defaultValue, true, this.env)
				.catch(err => console.error('[Feature Flag] Failed to log evaluation:', err));
			return cachedValue;
		}

		const posthog = getPostHog(this.env);

		if (!posthog) {
			// Log using default value (PostHog not configured)
			logFeatureFlagEvaluation(flagKey, distinctId, defaultValue, defaultValue, false, this.env)
				.catch(err => console.error('[Feature Flag] Failed to log evaluation:', err));
			return defaultValue;
		}

		try {
			const isEnabled = await posthog.isFeatureEnabled(flagKey, distinctId);
			
			// Debug log to understand what PostHog returns
			console.log(`[Feature Flag Debug] PostHog returned for "${flagKey}": ${JSON.stringify(isEnabled)} (type: ${typeof isEnabled})`);
			
			// PostHog's isFeatureEnabled returns true when enabled, false when disabled
			// Use the value directly, defaulting to defaultValue if undefined/null
			const result = isEnabled !== undefined && isEnabled !== null ? isEnabled : defaultValue;

			// Cache the result
			this.setCachedValue(cacheKey, result);

			// Log fetch from PostHog
			logFeatureFlagEvaluation(flagKey, distinctId, result, defaultValue, false, this.env)
				.catch(err => console.error('[Feature Flag] Failed to log evaluation:', err));

			return result;
		} catch (error) {
			console.error(`Error checking feature flag ${flagKey}:`, error);
			// Log error fallback to default
			logFeatureFlagEvaluation(flagKey, distinctId, defaultValue, defaultValue, false, this.env)
				.catch(err => console.error('[Feature Flag] Failed to log evaluation:', err));
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
	POSTHOG_OTLP_HOST?: string;
	FEATURE_FLAG_CACHE_TTL_MS?: string;
	ENVIRONMENT?: string;
	CF_PAGES_BRANCH?: string;
}): FeatureFlagService {
	return new PostHogFeatureFlagService(env);
}

/**
 * @deprecated Use getFeatureFlagService instead
 */
export const getFeatureFlagProvider = getFeatureFlagService;
