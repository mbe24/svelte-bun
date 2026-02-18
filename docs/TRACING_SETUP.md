# External Configuration Steps for OpenTelemetry Tracing

This document outlines the external configuration steps required to enable OpenTelemetry distributed tracing with PostHog OTLP in your deployed application.

## Overview

The tracing implementation exports traces to PostHog via OTLP (OpenTelemetry Protocol). All code changes are complete - you only need to configure environment variables in your deployment environments.

## PostHog Configuration

### 1. Verify OTLP Traces Support

**Action Required:** Ensure your PostHog account has OTLP traces ingestion enabled.

1. Log in to your PostHog account at [app.posthog.com](https://app.posthog.com/) (or [eu.posthog.com](https://eu.posthog.com/) for EU)
2. Navigate to **Settings → Project Settings → Data Management**
3. Verify that "OpenTelemetry" or "OTLP" is listed as an available ingestion method
4. If not visible, contact PostHog support or check your plan (OTLP may require a paid plan)

### 2. Get Your PostHog API Key

Your existing PostHog API key (used for events) works for OTLP traces:

1. Go to **Settings → Project Settings → Project API Key**
2. Copy your API key (starts with `phc_`)
3. This key will be used as the `Authorization: Bearer <key>` header for OTLP requests

**Note:** PostHog API keys are designed to be publicly visible (they're used in browsers), but keep them secure in server-side environments.

### 3. Determine Your OTLP Endpoint

The OTLP traces endpoint is automatically determined from your `POSTHOG_HOST`:

| PostHog Host | OTLP Traces Endpoint |
|--------------|---------------------|
| `https://app.posthog.com` or `https://us.posthog.com` | `https://us.i.posthog.com/v1/traces` |
| `https://eu.posthog.com` | `https://eu.i.posthog.com/v1/traces` |
| Self-hosted | `https://<your-host>/v1/traces` |

**No action needed** - the application automatically maps your `POSTHOG_HOST` to the correct OTLP endpoint.

### 4. View Traces in PostHog

After deployment:

1. Log in to PostHog
2. Navigate to **Activity → Traces** (or **Data Management → Traces**)
3. You'll see incoming HTTP requests as root spans
4. Click any trace to view the full span hierarchy with timings

## Cloudflare Workers/Pages Configuration

### Required Environment Variables

Configure these in Cloudflare Pages/Workers settings:

**Path:** Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables

#### For Production Environment:

| Variable | Value | Required | Description |
|----------|-------|----------|-------------|
| `POSTHOG_API_KEY` | `phc_...` | ✅ Yes | Your PostHog project API key |
| `POSTHOG_HOST` | `https://app.posthog.com` | ✅ Yes | PostHog host (US: app.posthog.com, EU: eu.posthog.com) |
| `TRACE_SUCCESS_SAMPLE_RATE` | `0.1` | ⚠️ Recommended | Sample rate for successful requests (0.0-1.0, default 0.1 = 10%) |
| `SERVICE_NAME` | `svelte-bun-production` | ⚠️ Recommended | Service name for identification |
| `APP_RELEASE` | `v1.0.0` | Optional | Release version for deployment correlation |

#### For Preview Environment:

Configure the same variables with environment-specific values:

| Variable | Value | Notes |
|----------|-------|-------|
| `POSTHOG_API_KEY` | Same as production | Or use a separate PostHog project |
| `POSTHOG_HOST` | Same as production | |
| `TRACE_SUCCESS_SAMPLE_RATE` | `0.5` | Higher sample rate for testing (50%) |
| `SERVICE_NAME` | `svelte-bun-preview` | Differentiate preview traces |
| `APP_RELEASE` | `preview` | Or use commit SHA |

### Steps to Configure:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages → Your Project → Settings → Environment variables**
3. Click **Add variable** for each required variable
4. Select environment: **Production** or **Preview** (or both)
5. Click **Save**
6. Redeploy your application (or wait for next deployment)

### Network Requirements

**Verify outbound access** to PostHog OTLP endpoints:

- US: `https://us.i.posthog.com/v1/traces`
- EU: `https://eu.i.posthog.com/v1/traces`

**By default,** Cloudflare Workers have unrestricted egress access. If you've configured network restrictions:

1. Go to **Workers & Pages → Settings → Variables → Network**
2. Ensure OTLP endpoints are not blocked
3. Add to allowlist if necessary

## GitHub Actions Configuration (CI/CD)

### For Testing (Optional)

If you want to run E2E tests that check tracing behavior in CI:

**Path:** GitHub Repository → Settings → Secrets and variables → Actions

Add these **Repository Secrets**:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `POSTHOG_API_KEY` | `phc_...` | Enable tracing in CI tests |
| `TRACE_EXPORTER` | `memory` | Use in-memory exporter for tests |

**Alternative:** Set `TRACE_EXPORTER=memory` in your test script to avoid external dependencies:

```yaml
# .github/workflows/ci.yml
env:
  TRACE_EXPORTER: memory  # Skip OTLP export in tests
  POSTHOG_API_KEY: test_key  # Dummy key for initialization
```

### For Cloudflare Deployment

**No additional secrets needed.** The GitHub Actions workflow for Cloudflare Pages deployment uses the environment variables you configured in Cloudflare Pages settings.

## Verification Steps

### 1. Check Initialization Logs

After deployment, check Cloudflare Pages logs:

```bash
# You should see:
[Tracing] Initialized with OTLP exporter to https://us.i.posthog.com/v1/traces
```

### 2. Verify X-Trace-Id Headers

Make a request to your deployed app:

```bash
curl -I https://your-app.pages.dev/api/auth/login

# Response headers should include:
# X-Trace-Id: 4bf92f3577b34da6a3ce929d0e0e4736
```

### 3. View Traces in PostHog

1. Make a few requests to your app (e.g., login, counter operations)
2. Go to PostHog → **Activity → Traces**
3. Look for traces with your `SERVICE_NAME`
4. Click a trace to see the span hierarchy

### 4. Check Structured Logs

View Cloudflare Pages logs to see structured trace logs:

```json
{
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "method": "POST",
  "route": "/api/auth/login",
  "status": 200,
  "duration_ms": 145
}
```

## Troubleshooting

### No Traces Appearing in PostHog

**Possible causes:**

1. **Missing POSTHOG_API_KEY**: Check Cloudflare environment variables
2. **Wrong POSTHOG_HOST**: Verify US vs EU region
3. **OTLP not enabled**: Contact PostHog support
4. **Network blocked**: Check Cloudflare egress settings
5. **Sampling**: Error requests are always traced, but success requests are sampled (default 10%)

**Debug steps:**

```bash
# Check logs for initialization message
# In Cloudflare Pages → Functions → Logs

# If you see:
# [Tracing] No POSTHOG_API_KEY provided, tracing disabled
# → Add POSTHOG_API_KEY to environment variables

# If you see:
# [Tracing] Initialized with OTLP exporter to https://us.i.posthog.com/v1/traces
# → Tracing is enabled, check PostHog ingestion settings
```

### X-Trace-Id Header Missing

**Check:**

1. Ensure the request reaches the application (not a Cloudflare error page)
2. Verify tracing is initialized (check logs)
3. Make sure you're checking API responses (not static assets)

### High Trace Volume

**Adjust sampling:**

Set `TRACE_SUCCESS_SAMPLE_RATE=0.01` (1%) in Cloudflare environment variables for lower trace volume.

## Optional: Custom OTLP Headers

If PostHog requires additional authentication headers (rare):

```bash
# In Cloudflare environment variables:
OTLP_HEADERS='{"X-Custom-Header":"value","X-Another-Header":"value"}'
```

## Summary Checklist

- [ ] **PostHog**: Verify OTLP traces ingestion is enabled
- [ ] **Cloudflare Production**: Set `POSTHOG_API_KEY`, `POSTHOG_HOST`, `TRACE_SUCCESS_SAMPLE_RATE`, `SERVICE_NAME`
- [ ] **Cloudflare Preview**: Set same variables with preview-specific values
- [ ] **Verify**: Check initialization logs in Cloudflare
- [ ] **Test**: Make requests and verify X-Trace-Id headers
- [ ] **View**: Check traces appear in PostHog dashboard
- [ ] **Optional**: Configure GitHub Actions secrets for CI testing

## Support

- **PostHog Documentation**: https://posthog.com/docs/integrate/opentelemetry
- **Cloudflare Pages**: https://developers.cloudflare.com/pages/platform/functions/bindings/
- **OpenTelemetry**: https://opentelemetry.io/docs/

---

**No code changes are required** - all configuration is done via environment variables.
