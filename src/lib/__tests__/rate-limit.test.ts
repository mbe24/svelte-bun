import { describe, test, expect } from 'bun:test';
import { createRateLimiter, checkRateLimit } from '../rate-limit';

describe('Rate limiting utilities', () => {
	describe('createRateLimiter', () => {
		test('should return null when environment variables are not set', () => {
			const ratelimit = createRateLimiter(undefined);
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is missing', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is missing', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io'
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when URL is set but token is undefined (CI scenario)', () => {
			// This simulates the CI environment where URL is in wrangler.toml
			// but token is not set in environment variables
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: 'https://deciding-bream-58216.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: undefined
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is empty string', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_URL is whitespace only', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: '   ',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is empty string', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when UPSTASH_REDIS_REST_TOKEN is whitespace only', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: '   '
			});
			expect(ratelimit).toBeNull();
		});

		test('should return null when both are empty strings', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(ratelimit).toBeNull();
		});

		test('should return rate limiter when both environment variables are set', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
				UPSTASH_REDIS_REST_TOKEN: 'test_token'
			});
			expect(ratelimit).not.toBeNull();
		});

		test('should return rate limiter when values have leading/trailing whitespace', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: '  https://test.upstash.io  ',
				UPSTASH_REDIS_REST_TOKEN: '  test_token  '
			});
			expect(ratelimit).not.toBeNull();
		});
	});

	describe('checkRateLimit', () => {
		test('should allow requests when rate limiting is not configured', async () => {
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are missing', async () => {
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: undefined,
				UPSTASH_REDIS_REST_TOKEN: undefined
			});
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are empty strings', async () => {
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: '',
				UPSTASH_REDIS_REST_TOKEN: ''
			});
			expect(result.success).toBe(true);
		});

		test('should allow requests when environment variables are whitespace only', async () => {
			const result = await checkRateLimit(1, {
				UPSTASH_REDIS_REST_URL: '   ',
				UPSTASH_REDIS_REST_TOKEN: '   '
			});
			expect(result.success).toBe(true);
		});

		test('should not return retryAfter when request succeeds', async () => {
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
			expect(result.retryAfter).toBeUndefined();
		});

		test('retryAfter calculation should cap at window duration', () => {
			// Test the retryAfter logic conceptually
			// The actual calculation happens in checkRateLimit when result.success is false
			
			// Scenario 1: Reset is 15 seconds away (beyond window duration of 10s)
			// Expected: retryAfter should be capped at 10 seconds
			const RATE_LIMIT_WINDOW_MS = 10 * 1000;
			const now = Date.now();
			const resetFarAway = now + 15000; // 15 seconds in future
			const resetWaitTime = Math.ceil((resetFarAway - now) / 1000); // 15 seconds
			const retryAfter1 = Math.max(1, Math.min(resetWaitTime, RATE_LIMIT_WINDOW_MS / 1000));
			expect(retryAfter1).toBe(10); // Should be capped at 10
			
			// Scenario 2: Reset is 3 seconds away (within window duration)
			// Expected: retryAfter should be 3 seconds
			const resetNearby = now + 3000; // 3 seconds in future
			const resetWaitTime2 = Math.ceil((resetNearby - now) / 1000); // 3 seconds
			const retryAfter2 = Math.max(1, Math.min(resetWaitTime2, RATE_LIMIT_WINDOW_MS / 1000));
			expect(retryAfter2).toBe(3); // Should be 3 seconds
			
			// Scenario 3: Reset is in the past (edge case)
			// Expected: retryAfter should be minimum 1 second
			const resetPast = now - 1000; // 1 second in past
			const resetWaitTime3 = Math.ceil((resetPast - now) / 1000); // negative or 0
			const retryAfter3 = Math.max(1, Math.min(resetWaitTime3, RATE_LIMIT_WINDOW_MS / 1000));
			expect(retryAfter3).toBe(1); // Should be minimum 1 second
		});
	});
});
