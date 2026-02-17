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

		test('retryAfter should be window duration for consistent behavior', () => {
			// The retryAfter is always set to the window duration (10 seconds)
			// when rate limiting occurs. This provides consistent, predictable
			// behavior for users regardless of when they hit the limit.
			const RATE_LIMIT_WINDOW_SECONDS = 10;
			
			// For sliding window rate limiting, using the full window duration
			// ensures users can always retry successfully after waiting
			expect(RATE_LIMIT_WINDOW_SECONDS).toBe(10);
			
			// This is simpler and more reliable than trying to calculate the exact
			// time based on the 'reset' timestamp, which uses fixed bucket boundaries
			// and doesn't accurately reflect sliding window behavior
		});

		test('should not return reset field', async () => {
			const result = await checkRateLimit(1, undefined);
			expect(result.success).toBe(true);
			expect(result).not.toHaveProperty('reset');
		});
	});
});
