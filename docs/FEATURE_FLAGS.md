# Feature Flags

This document describes how to use feature flags in the application.

## Overview

Feature flags allow you to enable or disable features for specific users or groups without deploying new code. The application uses an interface-based approach that currently supports PostHog as a backend, but can be extended to support other providers.

## Architecture

### Interface-Based Design

The feature flag system is built around the `FeatureFlagProvider` interface, which decouples the application from any specific feature flag service:

```typescript
interface FeatureFlagProvider {
  isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean
  ): Promise<boolean>;

  getFeatureFlagPayload(
    flagKey: string,
    distinctId: string
  ): Promise<unknown>;
}
```

This design ensures that:
- The application is not tightly coupled to PostHog
- Feature flags work even when PostHog is not configured (using defaults)
- You can easily swap out or extend the provider in the future

### PostHog Implementation

The default implementation uses PostHog for feature flag evaluation:

```typescript
import { getFeatureFlagProvider, FeatureFlags } from '$lib/feature-flags';

const provider = getFeatureFlagProvider(env);
const isEnabled = await provider.isFeatureEnabled(
  FeatureFlags.RATE_LIMIT_COUNTER,
  'user_123',
  true // default value if PostHog is unavailable
);
```

## Available Feature Flags

### `rate-limit-counter`

Controls whether rate limiting is applied to counter operations.

- **Flag Key**: `rate-limit-counter`
- **Default Value**: `true` (rate limiting enabled by default)
- **Purpose**: Allows you to disable rate limiting for specific users or globally
- **Usage**: Applied in the counter API endpoint before checking Redis rate limits

## Usage Examples

### Checking a Feature Flag

```typescript
import { getFeatureFlagProvider, FeatureFlags } from '$lib/feature-flags';

// In a server endpoint or hook
export const POST: RequestHandler = async ({ locals, platform }) => {
  const provider = getFeatureFlagProvider(platform?.env);
  
  const isRateLimitEnabled = await provider.isFeatureEnabled(
    FeatureFlags.RATE_LIMIT_COUNTER,
    `user_${locals.userId}`,
    true // default value
  );

  if (isRateLimitEnabled) {
    // Apply rate limiting
  } else {
    // Skip rate limiting
  }
};
```

### Getting Feature Flag Payload

```typescript
const provider = getFeatureFlagProvider(env);
const payload = await provider.getFeatureFlagPayload(
  'feature-key',
  'user_123'
);

if (payload) {
  // Use payload data (e.g., configuration values)
  const config = payload as { maxRequests: number };
}
```

## Configuration

### Environment Variables

To enable PostHog feature flags, configure these environment variables:

```bash
# PostHog API Key (required)
POSTHOG_API_KEY=your_posthog_api_key

# PostHog Host (optional, defaults to https://app.posthog.com)
POSTHOG_HOST=https://app.posthog.com
```

### Without PostHog

When PostHog is not configured:
- Feature flags return their default values
- The application continues to work normally
- No errors are thrown

This ensures the application is resilient and works even when PostHog is unavailable.

## Setting Up Feature Flags in PostHog

1. **Create a Feature Flag**:
   - Go to your PostHog project
   - Navigate to "Feature Flags"
   - Click "New feature flag"
   - Enter the flag key (e.g., `rate-limit-counter`)

2. **Configure Rollout**:
   - Set to 100% for all users (enabled globally)
   - Or target specific users/groups
   - Add release conditions as needed

3. **Test the Flag**:
   - Use PostHog's testing tools to verify behavior
   - Check different user segments

## Best Practices

### Flag Naming

Feature flag names should follow these conventions:
- Use lowercase letters
- Separate words with hyphens (kebab-case)
- Be descriptive but concise
- Prefix with the feature domain if helpful

Examples:
- ✅ `rate-limit-counter`
- ✅ `new-dashboard-ui`
- ✅ `payment-processing-v2`
- ❌ `RATE_LIMIT_COUNTER` (wrong case)
- ❌ `rate_limit_counter` (wrong separator)

### Default Values

Always provide sensible default values:
- For safety features (like rate limiting): default to `true` (enabled)
- For experimental features: default to `false` (disabled)
- Choose defaults that keep the application secure and functional

### Error Handling

The feature flag system handles errors gracefully:
- If PostHog is unavailable, returns default value
- If network fails, returns default value
- Logs errors to console for debugging
- Never throws exceptions that could break the application

## Adding New Feature Flags

1. **Define the flag constant**:

```typescript
// src/lib/feature-flags.ts
export const FeatureFlags = {
  RATE_LIMIT_COUNTER: 'rate-limit-counter',
  NEW_FEATURE: 'new-feature', // Add your new flag here
} as const;
```

2. **Use the flag in your code**:

```typescript
const provider = getFeatureFlagProvider(env);
const isEnabled = await provider.isFeatureEnabled(
  FeatureFlags.NEW_FEATURE,
  userId,
  false // Choose appropriate default
);
```

3. **Create the flag in PostHog**:
   - Use the exact same key as defined in code
   - Configure rollout strategy
   - Test with different user segments

4. **Add tests**:

```typescript
test('should handle NEW_FEATURE flag', async () => {
  const provider = getFeatureFlagProvider();
  const isEnabled = await provider.isFeatureEnabled(
    FeatureFlags.NEW_FEATURE,
    'user_123',
    false
  );
  expect(isEnabled).toBe(false); // Default when PostHog not configured
});
```

## Example: Rate Limiting Feature Flag

The `rate-limit-counter` flag demonstrates a complete implementation:

```typescript
// In src/lib/rate-limit.ts
export async function checkRateLimit(
  userId: number,
  env?: { ... }
): Promise<{ success: boolean; ... }> {
  // Check if rate limiting feature is enabled
  const provider = getFeatureFlagProvider(env);
  const isRateLimitEnabled = await provider.isFeatureEnabled(
    FeatureFlags.RATE_LIMIT_COUNTER,
    `user_${userId}`,
    true // Default: enabled
  );

  // If disabled, allow all requests
  if (!isRateLimitEnabled) {
    return { success: true };
  }

  // Continue with rate limiting logic...
}
```

This allows you to:
- Disable rate limiting for specific users (e.g., premium accounts)
- Turn off rate limiting during maintenance
- Gradually roll out rate limiting changes
- A/B test different rate limit configurations

## Extending the System

To add a new feature flag provider (e.g., LaunchDarkly, Unleash):

1. **Implement the interface**:

```typescript
export class LaunchDarklyProvider implements FeatureFlagProvider {
  async isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean
  ): Promise<boolean> {
    // Implementation here
  }

  async getFeatureFlagPayload(
    flagKey: string,
    distinctId: string
  ): Promise<unknown> {
    // Implementation here
  }
}
```

2. **Update the factory function**:

```typescript
export function getFeatureFlagProvider(env?: any): FeatureFlagProvider {
  if (env?.LAUNCHDARKLY_KEY) {
    return new LaunchDarklyProvider(env);
  }
  return new PostHogFeatureFlagProvider(env);
}
```

## Troubleshooting

### Feature flag always returns default value

- Check that `POSTHOG_API_KEY` is set correctly
- Verify the flag exists in PostHog with the correct key
- Check PostHog logs for any errors
- Ensure the distinctId matches what you expect

### PostHog errors in console

- Verify network connectivity to PostHog
- Check API key permissions
- Review PostHog status page for outages
- The application will continue working with default values

### Flag not updating in real-time

- PostHog evaluates flags server-side
- Changes may take a few seconds to propagate
- Consider implementing client-side refresh if needed

## Related Documentation

- [PostHog Setup](POSTHOG_SETUP.md) - How to configure PostHog
- [Rate Limiting](RATE_LIMITING_UI.md) - Rate limiting implementation details
- [Environment Configuration](../README.md#optional-posthog-analytics) - Environment variables
