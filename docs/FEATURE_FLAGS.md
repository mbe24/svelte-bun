# Feature Flags

This document describes how to use feature flags in the application.

## Overview

Feature flags allow you to enable or disable features for specific users or groups without deploying new code. The application uses an interface-based approach that currently supports PostHog as a backend, but can be extended to support other services.

## Architecture

### Interface-Based Design

The feature flag system is built around the `FeatureFlagService` interface, which decouples the application from any specific feature flag service:

```typescript
interface FeatureFlagService {
  isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean
  ): Promise<boolean>;

  isFeatureEnabledGlobal(
    flagKey: string,
    defaultValue: boolean
  ): Promise<boolean>;
}
```

This design ensures that:
- The application is not tightly coupled to PostHog
- Feature flags work even when PostHog is not configured (using defaults)
- You can easily swap out or extend the service in the future

### PostHog Implementation

The default implementation uses PostHog for feature flag evaluation:

```typescript
import { getFeatureFlagService, FeatureFlags } from '$lib/feature-flags';

const service = getFeatureFlagService(env);
const isEnabled = await service.isFeatureEnabled(
  FeatureFlags.RATE_LIMIT_COUNTER,
  'user_123',
  true // default value if PostHog is unavailable
);
```

**Important Notes:**
- **Singleton Pattern**: `getFeatureFlagService()` returns a singleton instance, so the service (and its cache) is shared across all requests
- **PostHog Value Inversion**: Due to PostHog's API behavior, the service automatically inverts boolean values. When you enable a flag in PostHog UI, it correctly shows as enabled in the application.

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
import { getFeatureFlagService, FeatureFlags } from '$lib/feature-flags';

// In a server endpoint or hook
export const POST: RequestHandler = async ({ locals, platform }) => {
  const service = getFeatureFlagService(platform?.env);
  
  const isRateLimitEnabled = await service.isFeatureEnabled(
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

### Checking a Global Feature Flag

For feature flags that don't require user-specific targeting, use `isFeatureEnabledGlobal`:

```typescript
import { getFeatureFlagService, FeatureFlags } from '$lib/feature-flags';

const service = getFeatureFlagService(env);

// Check a global flag without user context
const isEnabled = await service.isFeatureEnabledGlobal(
  'maintenance-mode',
  false // default value
);

if (isEnabled) {
  // Show maintenance message
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

# Feature Flag Cache TTL (optional, defaults to 600000ms = 10 minutes)
# This controls how long feature flag values are cached to reduce API calls
FEATURE_FLAG_CACHE_TTL_MS=600000
```

### Caching

Feature flag values are cached to improve performance and reduce API calls to PostHog:

- **Default TTL**: 10 minutes (600,000 milliseconds)
- **Configurable**: Set `FEATURE_FLAG_CACHE_TTL_MS` environment variable to customize
- **Per-flag cache**: Each flag+user combination is cached separately
- **Automatic expiration**: Cache entries expire after the TTL and are refreshed on next check

**When changes take effect:**
- If you change a flag in PostHog, the change will take effect after the cache expires (up to 10 minutes by default)
- To see changes faster, reduce the cache TTL (e.g., set to 60000 for 1 minute)
- No page reload or server restart required - cache expiration is automatic

### Observability & Debugging

Feature flag evaluations are automatically logged to PostHog OTLP for debugging and monitoring:

**What's logged:**
- Feature flag key that was evaluated
- Distinct ID (user identifier or 'global' for global flags)
- Evaluation result (true/false)
- Default value used
- Cache hit/miss status
- Source of the value (cache or PostHog API)

**Log attributes:**
```
feature_flag.key: "rate-limit-counter"
feature_flag.distinct_id: "global"
feature_flag.result: "true"
feature_flag.default_value: "true"
feature_flag.cache_hit: "true"
feature_flag.source: "cache"
span.kind: "feature_flag"
```

**Viewing logs:**
- Logs appear in PostHog under "Logs" section
- Filter by `span.kind: feature_flag` to see only feature flag evaluations
- Use `feature_flag.key` to filter for specific flags
- Severity level: DEBUG (non-intrusive)

This helps you understand:
- Which feature flags are being evaluated
- How often cache hits vs API calls occur
- When flags change their values
- Performance impact of feature flag checks

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
const service = getFeatureFlagService(env);
const isEnabled = await service.isFeatureEnabled(
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
  const service = getFeatureFlagService();
  const isEnabled = await service.isFeatureEnabled(
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
  const service = getFeatureFlagService(env);
  const isRateLimitEnabled = await service.isFeatureEnabled(
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

To add a new feature flag service (e.g., LaunchDarkly, Unleash):

1. **Implement the interface**:

```typescript
export class LaunchDarklyProvider implements FeatureFlagService {
  async isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    defaultValue: boolean
  ): Promise<boolean> {
    // Implementation here
  }

  async isFeatureEnabledGlobal(
    flagKey: string,
    defaultValue: boolean
  ): Promise<boolean> {
    // Implementation here
  }
}
```

2. **Update the factory function**:

```typescript
export function getFeatureFlagService(env?: any): FeatureFlagService {
  if (env?.LAUNCHDARKLY_KEY) {
    return new LaunchDarklyProvider(env);
  }
  return new PostHogFeatureFlagService(env);
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
