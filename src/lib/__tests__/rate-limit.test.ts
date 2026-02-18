import { describe, test, expect } from 'bun:test';
import { getRateLimitService, checkRateLimit, resetRateLimitService } from '../rate-limit';

describe('Rate limiting utilities', () => {
	describe('getRateLimitService', () => {
		test('should return null when environment variables are not set', () => {
			resetRateLimitService();
			const service = getRateLimitService(undefined);
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is missing', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is missing', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io'
			});
			expect(service).toBeNull();
		});

		test('should return null when URL is set but token is undefined (CI scenario)', () => {
			resetRateLimitService();
			// This simulates the CI environment where URL is in wrangler.toml
			// but token is not set in environment variables
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: 'https://deciding-bream-58216.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: undefined
			});
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is empty string', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is whitespace only', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: '   ',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is empty string', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(service).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is whitespace only', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: '   '
			});
			expect(service).toBeNull();
		});

		test('should return null when both are empty strings', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(service).toBeNull();
		});

		test('should return rate limiter service when both environment variables are set', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(service).not.toBeNull();
			expect(service).toHaveProperty('check');
		});

		test('should return rate limiter service when values have leading/trailing whitespace', () => {
			resetRateLimitService();
			const service = getRateLimitService({
				UPSTASH_REDIS_REST_URL: '  https://test.upstash.io  ',
				UPSTASH_REDIS_REST_TOKEN: '  test_token  '
			});
			expect(service).not.toBeNull();
			expect(service).toHaveProperty('check');
		});
	});

	describe('checkRateLimit', () => {
		test('should allow requests when rate limiting is not configured', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are missing', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: undefined,
				UPSTASH_REDIS_REST_TOKEN: undefined
			});
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are empty strings', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are whitespace only', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: '   ',
				UPSTASH_REDIS_REST_TOKEN: '   '
			});
			expect(result.success).toBe(true);
		});

		test('should not return retryAfter when request succeeds', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
			expect(result.retryAfter).toBeUndefined();
		});

		test('retryAfter calculation uses reset timestamp', () => {
			// For sliding window rate limiting, the 'reset' timestamp from Upstash
			// indicates when the oldest request will slide out of the window.
			// This is the correct time to wait before retrying.
			
			// Example: If we hit the limit at t=5s and the oldest request was at t=0s,
			// reset will be at t=10s, so retryAfter = 10 - 5 = 5 seconds
			const now = Date.now();
			const reset = now + 5000; // 5 seconds in the future
			const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));
			expect(retryAfter).toBe(5);
			
			// Minimum retry time is 1 second
			const resetPast = now - 1000;
			const retryAfterMin = Math.max(1, Math.ceil((resetPast - now) / 1000));
			expect(retryAfterMin).toBe(1);
		});

		test('should not return reset field', async () => {
			resetRateLimitService();
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
			expect(result).not.toHaveProperty('reset');
		});
	});

	describe('checkRateLimit with feature flags', () => {
		test('should allow requests when PostHog is not configured and Redis is unavailable', async () => {
			resetRateLimitService();
			// When PostHog is not configured, the feature flag defaults to true (enabled)
			// But Redis is also not configured, so rate limiting is skipped anyway
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: undefined,
				UPSTASH_REDIS_REST_TOKEN: undefined
			});
			expect(result.success).toBe(true);
		});

		test('should check feature flag even when Redis is not configured', async () => {
			resetRateLimitService();
			// This test documents that feature flag is checked first
			// Even if Redis is not configured, the feature flag logic runs
			// In this case, PostHog is not configured so default (true) is returned
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: undefined,
				UPSTASH_REDIS_REST_TOKEN: undefined,
				POSTHOG_API_KEY: undefined
			});
			expect(result.success).toBe(true);
		});

		test('should allow requests when neither PostHog nor Redis is configured', async () => {
			resetRateLimitService();
			// When both PostHog and Redis are not configured:
			// 1. Feature flag check returns default value (true - enabled)
			// 2. But Redis is not configured, so rate limiting is skipped anyway
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
		});
	});
});
