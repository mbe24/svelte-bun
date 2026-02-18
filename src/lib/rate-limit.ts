import { Redis } from '@upstash/redis/cloudflare';
import { Ratelimit } from '@upstash/ratelimit';
import { getEnvironmentName } from './environment';
import { getFeatureFlagService, FeatureFlags } from './feature-flags';
import { createChildSpan } from './tracing';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
	success: boolean;
	remaining?: number;
	retryAfter?: number;
}

/**
 * Rate limit service interface to decouple from specific rate limiting implementations
 */
export interface RateLimitService {
	/**
	 * Check if an identifier is allowed to proceed based on rate limits
	 * @param identifier - Unique identifier (e.g., user ID, IP address)
	 * @returns Promise resolving to rate limit result
	 */
	check(identifier: string): Promise<RateLimitResult>;
}

/**
 * Upstash Redis implementation of the rate limit service with tracing
 */
class UpstashRateLimitService implements RateLimitService {
	private ratelimit: Ratelimit;

	constructor(ratelimit: Ratelimit) {
		this.ratelimit = ratelimit;
	}

	async check(identifier: string): Promise<RateLimitResult> {
		const span = createChildSpan('ratelimit.check', {
			attributes: {
				'db.system': 'redis',
				'db.operation': 'EVAL', // Upstash rate limit uses Lua scripts (EVAL)
				'ratelimit.identifier': identifier,
			},
		});

		try {
			const startTime = Date.now();
			const result = await this.ratelimit.limit(identifier);
			const duration = Date.now() - startTime;

			span.setAttribute('ratelimit.success', result.success);
			span.setAttribute('ratelimit.remaining', result.remaining);
			span.setAttribute('duration_ms', duration);
			span.setAttribute('http.status_code', 200); // Upstash HTTP call succeeded

			span.setStatus({ code: SpanStatusCode.OK });

			if (!result.success) {
				// For sliding window rate limiting, the 'reset' timestamp indicates when
				// the oldest request will slide out of the window, allowing a new request.
				// Calculate how many seconds until that happens.
				const now = Date.now();
				const retryAfter = Math.max(1, Math.ceil((result.reset - now) / 1000));

				return {
					success: result.success,
					remaining: result.remaining,
					retryAfter
				};
			}

			return {
				success: result.success,
				remaining: result.remaining
			};
		} catch (error) {
			span.recordException(error as Error);
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: (error as Error).message,
			});
			throw error;
		} finally {
			span.end();
		}
	}
}

/**
 * Create an Upstash rate limiter instance
 * Returns null if Redis is not configured
 */
function createUpstashRateLimiter(env?: {
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
	ENVIRONMENT?: string;
	CF_PAGES_BRANCH?: string;
}): RateLimitService | null {
	// Check if Upstash Redis is configured
	// Treat empty strings and missing values as unconfigured
	const url = env?.UPSTASH_REDIS_REST_URL?.trim();
	const token = env?.UPSTASH_REDIS_REST_TOKEN?.trim();
	
	if (!url || !token) {
		return null;
	}

	// Use Cloudflare-optimized Redis client with fromEnv
	// Pass only the required Redis credentials
	const redis = Redis.fromEnv({
		UPSTASH_REDIS_REST_URL: url,
		UPSTASH_REDIS_REST_TOKEN: token
	});

	// Get environment name for prefix to avoid key collisions between deployments
	const environment = getEnvironmentName(env);
	const prefix = `@upstash/ratelimit/${environment}`;

	// Create a sliding window rate limiter: 3 requests per 10 seconds
	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(3, '10 s'),
		analytics: true,
		prefix
	});

	return new UpstashRateLimitService(ratelimit);
}

/**
 * Singleton instance of the rate limit service
 */
let rateLimitServiceInstance: RateLimitService | null = null;

/**
 * Get a rate limit service instance (singleton)
 * @param env - Environment variables
 * @returns RateLimitService instance or null if not configured
 */
export function getRateLimitService(env?: {
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
	ENVIRONMENT?: string;
	CF_PAGES_BRANCH?: string;
}): RateLimitService | null {
	// Return existing instance if available
	if (!rateLimitServiceInstance) {
		rateLimitServiceInstance = createUpstashRateLimiter(env);
	}
	return rateLimitServiceInstance;
}

/**
 * Reset the rate limit service singleton (primarily for testing)
 */
export function resetRateLimitService(): void {
	rateLimitServiceInstance = null;
}

/**
 * Checks if a user can perform a counter action based on rate limits
 * Returns { success: true } if allowed, or { success: false, retryAfter: seconds } if rate limited
 */
export async function checkRateLimit(
	userId: number,
	env?: {
		UPSTASH_REDIS_REST_URL?: string;
		UPSTASH_REDIS_REST_TOKEN?: string;
		ENVIRONMENT?: string;
		CF_PAGES_BRANCH?: string;
		POSTHOG_API_KEY?: string;
		POSTHOG_HOST?: string;
		POSTHOG_OTLP_HOST?: string;
		FEATURE_FLAG_CACHE_TTL_MS?: string;
	}
): Promise<RateLimitResult> {
	// Check if rate limiting feature is enabled via feature flag
	// Feature flag values are cached to reduce API calls to PostHog
	// Cache TTL can be configured via FEATURE_FLAG_CACHE_TTL_MS env variable (default: 10 minutes)
	// Feature flag evaluations are logged to PostHog OTLP for debugging
	const featureFlagService = getFeatureFlagService(env);
	const isRateLimitEnabled = await featureFlagService.isFeatureEnabledGlobal(
		FeatureFlags.RATE_LIMIT_COUNTER,
		true // Default to enabled (rate limiting is on by default)
	);

	// If feature flag is disabled, allow all requests
	if (!isRateLimitEnabled) {
		return { success: true };
	}

	const rateLimitService = getRateLimitService(env);

	// If rate limiting is not configured, allow all requests
	if (!rateLimitService) {
		return { success: true };
	}

	try {
		const identifier = `user_${userId}`;
		return await rateLimitService.check(identifier);
	} catch (error) {
		// If rate limiting fails, log the error and allow the request
		// This ensures the application continues working even if Redis is down
		console.error('Rate limiting check failed:', error);
		return { success: true };
	}
}
