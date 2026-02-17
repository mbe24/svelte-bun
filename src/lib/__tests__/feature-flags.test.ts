import { describe, test, expect, beforeEach } from 'bun:test';
import {
	PostHogFeatureFlagService,
	getFeatureFlagService,
	FeatureFlags,
} from '../feature-flags';
import { shutdownPostHog } from '../posthog';

describe('Feature Flags', () => {
	beforeEach(async () => {
		// Clean up PostHog client before each test
		await shutdownPostHog();
	});

	describe('PostHogFeatureFlagService', () => {
		test('should return default value when PostHog is not configured', async () => {
			const service = new PostHogFeatureFlagService();
			const isEnabled = await service.isFeatureEnabled(
				'test-flag',
				'user_123',
				true
			);
			expect(isEnabled).toBe(true);
		});

		test('should return default value false when PostHog is not configured', async () => {
			const service = new PostHogFeatureFlagService();
			const isEnabled = await service.isFeatureEnabled(
				'test-flag',
				'user_123',
				false
			);
			expect(isEnabled).toBe(false);
		});

		test('should return default value when API key is empty', async () => {
			const service = new PostHogFeatureFlagService({
				POSTHOG_API_KEY: '',
			});
			const isEnabled = await service.isFeatureEnabled(
				'test-flag',
				'user_123',
				true
			);
			expect(isEnabled).toBe(true);
		});

		test('should check global feature flag without distinctId', async () => {
			const service = new PostHogFeatureFlagService();
			const isEnabled = await service.isFeatureEnabledGlobal(
				'test-flag',
				true
			);
			expect(isEnabled).toBe(true);
		});

		test('should return default value for global flag when PostHog not configured', async () => {
			const service = new PostHogFeatureFlagService();
			const isEnabled = await service.isFeatureEnabledGlobal(
				'test-flag',
				false
			);
			expect(isEnabled).toBe(false);
		});
	});

	describe('getFeatureFlagService', () => {
		test('should return a PostHogFeatureFlagService instance', () => {
			const service = getFeatureFlagService();
			expect(service).toBeInstanceOf(PostHogFeatureFlagService);
		});

		test('should return a service with environment variables', () => {
			const env = {
				POSTHOG_API_KEY: 'test_key',
				POSTHOG_HOST: 'https://app.posthog.com',
			};
			const service = getFeatureFlagService(env);
			expect(service).toBeInstanceOf(PostHogFeatureFlagService);
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
