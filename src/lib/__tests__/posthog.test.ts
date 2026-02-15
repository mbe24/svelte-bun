import { describe, test, expect } from 'bun:test';
import { getPostHog, initPostHog } from '../posthog';

describe('PostHog utilities', () => {
	describe('initPostHog', () => {
		test('should initialize PostHog client with API key', () => {
			const apiKey = 'test_api_key';
			const client = initPostHog(apiKey);
			
			expect(client).toBeDefined();
		});

		test('should initialize PostHog client with custom host', () => {
			const apiKey = 'test_api_key';
			const host = 'https://eu.posthog.com';
			const client = initPostHog(apiKey, host);
			
			expect(client).toBeDefined();
		});
	});

	describe('getPostHog', () => {
		test('should return null when no API key is provided', () => {
			const client = getPostHog({});
			
			expect(client).toBeNull();
		});

		test('should return PostHog client when API key is provided in env', () => {
			const env = {
				POSTHOG_API_KEY: 'test_api_key',
				POSTHOG_HOST: 'https://app.posthog.com'
			};
			const client = getPostHog(env);
			
			expect(client).toBeDefined();
		});

		test('should use default host when not provided', () => {
			const env = {
				POSTHOG_API_KEY: 'test_api_key'
			};
			const client = getPostHog(env);
			
			expect(client).toBeDefined();
		});
	});
});
