import { describe, test, expect, beforeEach } from 'bun:test';
import {
	PostHogFeatureFlagProvider,
	getFeatureFlagProvider,
	FeatureFlags,
} from '../feature-flags';
import { shutdownPostHog } from '../posthog';

describe('Feature Flags', () => {
	beforeEach(async () => {
		// Clean up PostHog client before each test
		await shutdownPostHog();
	});

	describe('PostHogFeatureFlagProvider', () => {
		test('should return default value when PostHog is not configured', async () => {
			const provider = new PostHogFeatureFlagProvider();
			const isEnabled = await provider.isFeatureEnabled(
				'test-flag',
				'user_123',
				true
			);
			expect(isEnabled).toBe(true);
		});

		test('should return default value false when PostHog is not configured', async () => {
			const provider = new PostHogFeatureFlagProvider();
			const isEnabled = await provider.isFeatureEnabled(
				'test-flag',
				'user_123',
				false
			);
			expect(isEnabled).toBe(false);
		});

		test('should return null payload when PostHog is not configured', async () => {
			const provider = new PostHogFeatureFlagProvider();
			const payload = await provider.getFeatureFlagPayload('test-flag', 'user_123');
			expect(payload).toBeNull();
		});

		test('should return default value when API key is empty', async () => {
			const provider = new PostHogFeatureFlagProvider({
				POSTHOG_API_KEY: '',
			});
			const isEnabled = await provider.isFeatureEnabled(
				'test-flag',
				'user_123',
				true
			);
			expect(isEnabled).toBe(true);
		});
	});

	describe('getFeatureFlagProvider', () => {
		test('should return a PostHogFeatureFlagProvider instance', () => {
			const provider = getFeatureFlagProvider();
			expect(provider).toBeInstanceOf(PostHogFeatureFlagProvider);
		});

		test('should return a provider with environment variables', () => {
			const env = {
				POSTHOG_API_KEY: 'test_key',
				POSTHOG_HOST: 'https://app.posthog.com',
			};
			const provider = getFeatureFlagProvider(env);
			expect(provider).toBeInstanceOf(PostHogFeatureFlagProvider);
		});
	});

	describe('FeatureFlags constants', () => {
		test('should have RATE_LIMIT_COUNTER flag', () => {
			expect(FeatureFlags.RATE_LIMIT_COUNTER).toBe('rate-limit-counter');
		});

		test('flag names should follow best practices (lowercase with hyphens)', () => {
			// Check all flag names follow the pattern: lowercase, hyphens, no underscores
			const flagValues = Object.values(FeatureFlags);
			flagValues.forEach((flagName) => {
				expect(flagName).toMatch(/^[a-z0-9-]+$/);
				expect(flagName).not.toContain('_');
				expect(flagName).not.toContain(' ');
			});
		});
	});
});
