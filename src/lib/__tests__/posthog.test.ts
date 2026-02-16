import { describe, test, expect, beforeEach } from 'bun:test';
import { getPostHog, initPostHog, shutdownPostHog } from '../posthog';

describe('PostHog utilities', () => {
	// Clean up after each test to avoid side effects
	beforeEach(async () => {
		await shutdownPostHog();
	});

	describe('initPostHog', () => {
		test('should initialize PostHog client with API key', () => {
			const apiKey = 'test_api_key';
			const client = initPostHog(apiKey);
			
			expect(client).toBeDefined();
		});

		test('should initialize PostHog client with custom host', () => {
			const apiKey = 'test_api_key_custom';
			const host = 'https://eu.posthog.com';
			const client = initPostHog(apiKey, host);
			
			expect(client).toBeDefined();
		});

		test('should return same instance on multiple calls (singleton)', async () => {
			const apiKey = 'test_api_key_singleton';
			const client1 = initPostHog(apiKey);
			const client2 = initPostHog('different_key');
			
			expect(client1).toBe(client2); // Should be the same instance
		});
	});

	describe('getPostHog', () => {
		test('should return null when no API key is provided', () => {
			const client = getPostHog({});
			
			expect(client).toBeNull();
		});

		test('should return PostHog client when API key is provided in env', () => {
			const env = {
				POSTHOG_API_KEY: 'test_api_key_env',
				POSTHOG_HOST: 'https://app.posthog.com'
			};
			const client = getPostHog(env);
			
			expect(client).toBeDefined();
		});

		test('should use default host when not provided', () => {
			const env = {
				POSTHOG_API_KEY: 'test_api_key_default'
			};
			const client = getPostHog(env);
			
			expect(client).toBeDefined();
		});

		test('should return same instance on multiple calls', () => {
			const env = {
				POSTHOG_API_KEY: 'test_api_key_multiple'
			};
			const client1 = getPostHog(env);
			const client2 = getPostHog(env);
			
			expect(client1).toBe(client2); // Should be the same instance
		});
	});
});
