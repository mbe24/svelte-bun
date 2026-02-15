# Environment-Based Log Filtering

This guide explains how to differentiate logs from different environments (production, preview, development) in PostHog.

## Overview

All OTLP logs are tagged with a `service.name` attribute that includes the environment, making it easy to filter logs by environment in PostHog.

## Service Naming Convention

Logs are tagged with `service.name` in the format: `svelte-bun-{environment}`

Examples:
- `svelte-bun-production` - Production environment
- `svelte-bun-preview` - Preview/staging environment
- `svelte-bun-development` - Local development

## Configuration

### Option 1: Automatic Detection (Recommended for Cloudflare Pages)

On Cloudflare Pages, the environment is automatically detected from the `CF_PAGES_BRANCH` environment variable:

- **`main` or `master` branch** → `production`
- **Any other branch** → `preview`
- **No CF_PAGES_BRANCH** → `development`

**No configuration needed!** Just deploy to Cloudflare Pages and logs will be automatically tagged.

### Option 2: Explicit Environment Variable

Set the `POSTHOG_ENVIRONMENT` environment variable to explicitly specify the environment:

```bash
# In .env or Cloudflare Pages environment variables
POSTHOG_ENVIRONMENT=production
```

Supported values:
- `production`
- `preview`
- `staging`
- `development`
- Any custom value you want

**Priority**: `POSTHOG_ENVIRONMENT` takes precedence over `CF_PAGES_BRANCH` if both are set.

### Option 3: Client-Side Detection

For client-side logs, the environment is detected from the hostname if not explicitly provided:

- `yourdomain.com` → `production`
- `*.pages.dev` → `preview`
- `localhost` or `127.0.0.1` → `development`

## Filtering Logs in PostHog

### By Service Name

In PostHog's Logs tab, you can filter by `service.name`:

```
service.name = "svelte-bun-production"
```

or

```
service.name contains "production"
```

### Create Separate Views

1. Go to **Logs** tab in PostHog
2. Click **Add filter**
3. Select **service.name**
4. Choose your environment
5. Save as a custom view

### Example Queries

**Production errors only:**
```
service.name = "svelte-bun-production" AND severity_text = "ERROR"
```

**Preview environment performance issues:**
```
service.name = "svelte-bun-preview" AND duration_ms > 1000
```

**All non-production logs:**
```
service.name != "svelte-bun-production"
```

## Environment Detection Logic

### Server-Side (Priority Order)

1. **POSTHOG_ENVIRONMENT** - If explicitly set, always use this value
2. **CF_PAGES_BRANCH** - For Cloudflare Pages:
   - `main` or `master` → `production`
   - Other branches → `preview`
3. **NODE_ENV** - Fallback to Node.js environment
4. **Default** - `development` if none of the above are set

### Client-Side (Priority Order)

1. **Passed environment** - If explicitly passed to `initPostHogClient()`
2. **Hostname detection**:
   - Production domain → `production`
   - `*.pages.dev` → `preview`
   - `localhost` → `development`
3. **Default** - `development`

## Examples

### Cloudflare Pages Deployment

**Production (main branch):**
```bash
# No configuration needed!
# Automatically tagged as "svelte-bun-production"
```

**Preview (feature-branch):**
```bash
# No configuration needed!
# Automatically tagged as "svelte-bun-preview"
```

### Custom Environment Names

```bash
# In Cloudflare Pages environment variables
POSTHOG_ENVIRONMENT=staging

# Logs will be tagged as "svelte-bun-staging"
```

### Local Development

```bash
# In .env file
POSTHOG_API_KEY=phc_your_key
POSTHOG_HOST=https://app.posthog.com
POSTHOG_ENVIRONMENT=development

# Logs will be tagged as "svelte-bun-development"
```

## Best Practices

1. **Use automatic detection** on Cloudflare Pages - it just works!
2. **Set POSTHOG_ENVIRONMENT explicitly** for other hosting providers
3. **Keep environment names consistent** across your organization
4. **Create saved views** in PostHog for each environment
5. **Set up alerts** specific to production environment
6. **Use preview environments** for testing before production

## Troubleshooting

### Logs not showing correct environment

1. Check that environment variables are set in Cloudflare Pages settings
2. Verify `CF_PAGES_BRANCH` is available (it should be automatic on Cloudflare Pages)
3. Set `POSTHOG_ENVIRONMENT` explicitly if auto-detection isn't working

### All logs showing as "development"

This means:
- No `POSTHOG_ENVIRONMENT` is set
- No `CF_PAGES_BRANCH` is detected
- Not running on Cloudflare Pages

**Solution**: Set `POSTHOG_ENVIRONMENT` environment variable explicitly.

### Want to use different naming convention

You can modify the `getServiceName()` function in:
- `src/lib/posthog-otlp.ts` (server-side)
- `src/lib/telemetry.ts` (server-side telemetry)
- `src/lib/posthog-client.ts` (client-side)

Example custom format:
```typescript
function getServiceName(env?: { POSTHOG_ENVIRONMENT?: string; CF_PAGES_BRANCH?: string }): string {
	const environment = getEnvironmentName(env);
	return `myapp-${environment}-logs`; // Custom format
}
```

## Related Documentation

- [PostHog Setup Guide](./POSTHOG_SETUP.md)
- [Telemetry Guide](./TELEMETRY.md)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)
