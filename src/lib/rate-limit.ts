import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/**
 * Creates a rate limiter instance for counter actions
 * Configured to allow 3 requests per 10 seconds per user
 */
export function createRateLimiter(env?: {
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
}) {
	// Check if Upstash Redis is configured
	// Treat empty strings as missing configuration
	if (!env?.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_URL.trim() === '' ||
	    !env?.UPSTASH_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN.trim() === '') {
		return null;
	}

	const redis = new Redis({
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN
	});

	// Create a sliding window rate limiter: 3 requests per 10 seconds
	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(3, '10 s'),
		analytics: true,
		prefix: 'counter_action'
	});

	return ratelimit;
}

/**
 * Checks if a user can perform a counter action based on rate limits
 * Returns { success: true } if allowed, or { success: false, reset: timestamp } if rate limited
 */
export async function checkRateLimit(
	userId: number,
	env?: {
		UPSTASH_REDIS_REST_URL?: string;
		UPSTASH_REDIS_REST_TOKEN?: string;
	}
): Promise<{ success: boolean; reset?: number; remaining?: number }> {
	const ratelimit = createRateLimiter(env);

	// If rate limiting is not configured, allow all requests
	if (!ratelimit) {
		return { success: true };
	}

	try {
		const identifier = `user_${userId}`;
		const result = await ratelimit.limit(identifier);

		return {
			success: result.success,
			reset: result.reset,
			remaining: result.remaining
		};
	} catch (error) {
		// If rate limiting fails, log the error and allow the request
		// This ensures the application continues working even if Redis is down
		console.error('Rate limiting check failed:', error);
		return { success: true };
	}
}
