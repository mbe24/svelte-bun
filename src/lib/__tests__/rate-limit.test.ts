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

		test('should return null when UPSTASH_REDIS_REST_URL is empty string', () => {
			const ratelimit = createRateLimiter({
				UPSTASH_REDIS_REST_URL: '',
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
	});
});
