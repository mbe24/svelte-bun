# External Actions Required - OpenTelemetry Tracing Setup

This document provides a quick checklist of actions you must perform **outside of the code** to enable OpenTelemetry distributed tracing in your deployed application.

---

## Summary

**All code changes are complete.** You only need to configure environment variables in your deployment environments. No code modifications are required.

---

## 1. PostHog Configuration

### Verify OTLP Traces Support (5 minutes)

**What:** Ensure your PostHog account can ingest OTLP traces

**Where:** PostHog Dashboard → Settings → Project Settings → Data Management

**Actions:**
1. Log in to https://app.posthog.com (or https://eu.posthog.com for EU)
2. Navigate to Settings → Project Settings → Data Management
3. Verify "OpenTelemetry" or "OTLP" is listed as available
4. If not available, check your PostHog plan (OTLP may require paid tier) or contact support

**Note:** Your existing PostHog API key (the one you already use for events) will work for OTLP traces. No new key is needed.

---

## 2. Cloudflare Pages/Workers Configuration

### Set Environment Variables (10 minutes)

**What:** Configure tracing settings in Cloudflare

**Where:** Cloudflare Dashboard → Pages → [Your Project] → Settings → Environment Variables

**Required Actions:**

#### Production Environment:

Add these environment variables:

| Variable | Example Value | Required? | Description |
|----------|--------------|-----------|-------------|
| `POSTHOG_API_KEY` | `phc_abc123...` | ✅ **YES** | Your PostHog project API key (already set for events) |
| `POSTHOG_HOST` | `https://app.posthog.com` | ✅ **YES** | US: app.posthog.com, EU: eu.posthog.com |
| `TRACE_SUCCESS_SAMPLE_RATE` | `0.1` | ⚠️ Recommended | 10% of successful requests traced (errors always traced) |
| `SERVICE_NAME` | `svelte-bun-production` | ⚠️ Recommended | Identifies your service in PostHog |
| `APP_RELEASE` | `v1.0.0` | Optional | Release version for correlation |

#### Preview Environment:

Add the same variables with environment-specific values:

| Variable | Example Value |
|----------|--------------|
| `POSTHOG_API_KEY` | Same as production (or separate project) |
| `POSTHOG_HOST` | Same as production |
| `TRACE_SUCCESS_SAMPLE_RATE` | `0.5` (higher for testing) |
| `SERVICE_NAME` | `svelte-bun-preview` |
| `APP_RELEASE` | `preview` |

**Steps:**
1. Go to https://dash.cloudflare.com/
2. Navigate to **Pages → Your Project → Settings → Environment variables**
3. Click **Add variable** for each variable above
4. Select environment (Production or Preview)
5. Click **Save**
6. Trigger a redeployment (or wait for next deployment)

### Verify Network Access (2 minutes)

**What:** Ensure Cloudflare Workers can reach PostHog OTLP endpoints

**Where:** Same location (Settings → Environment variables)

**Actions:**
- **By default:** Cloudflare Workers have unrestricted egress. No action needed.
- **If you've restricted egress:** Add PostHog OTLP endpoints to your allowlist:
  - US: `https://us.i.posthog.com/v1/traces`
  - EU: `https://eu.i.posthog.com/v1/traces`

---

## 3. GitHub Actions Configuration (Optional - For CI Testing)

**What:** Enable tracing tests in CI/CD pipeline

**Where:** GitHub Repository → Settings → Secrets and variables → Actions

**When:** Only if you want to run E2E tests that verify tracing behavior in CI

**Actions:**

**Option A - Use Memory Exporter (Recommended):**

Add this to your CI workflow (no secrets needed):

```yaml
# .github/workflows/ci.yml
env:
  TRACE_EXPORTER: memory  # Uses in-memory exporter instead of PostHog
  POSTHOG_API_KEY: test_key  # Dummy key for initialization
```

**Option B - Test Against PostHog (Optional):**

Add repository secret:
- Secret name: `POSTHOG_API_KEY`
- Value: Your PostHog API key

**Note:** For most users, Option A (memory exporter) is sufficient for testing.

---

## 4. Verification Steps (5 minutes)

After deploying with the above configuration:

### Check Initialization Logs

**Where:** Cloudflare Dashboard → Pages → [Your Project] → Functions → Logs

**Look for:**
```
[Tracing] Initialized with OTLP exporter to https://us.i.posthog.com/v1/traces
```

### Verify X-Trace-Id Header

**Action:** Make a test request:

```bash
curl -I https://your-app.pages.dev/api/auth/login
```

**Expected:** Response includes header:
```
X-Trace-Id: 4bf92f3577b34da6a3ce929d0e0e4736
```

### View Traces in PostHog

**Where:** PostHog Dashboard → Activity → Traces

**Actions:**
1. Make a few requests to your app (login, counter operations, etc.)
2. Go to PostHog → Activity → Traces
3. Look for traces with your `SERVICE_NAME`
4. Click a trace to see span hierarchy (request → database → rate limit)

---

## Quick Reference: What Goes Where

| Configuration | Location | Time Required |
|--------------|----------|--------------|
| **Verify PostHog OTLP** | PostHog Dashboard | 5 minutes |
| **Cloudflare Production Vars** | Cloudflare Pages Settings | 5 minutes |
| **Cloudflare Preview Vars** | Cloudflare Pages Settings | 5 minutes |
| **GitHub Actions (Optional)** | GitHub Secrets | 2 minutes |
| **Verification** | Command line + PostHog | 5 minutes |
| **Total** | | **~20 minutes** |

---

## Troubleshooting

### No traces in PostHog?

**Check:**
1. ✅ `POSTHOG_API_KEY` set in Cloudflare?
2. ✅ Correct `POSTHOG_HOST` for your region (US vs EU)?
3. ✅ PostHog OTLP ingestion enabled for your project?
4. ✅ Made test requests? (Remember: only 10% of successful requests sampled by default)

**Solution:** Try setting `TRACE_SUCCESS_SAMPLE_RATE=1.0` (100%) temporarily for testing

### No X-Trace-Id header?

**Check:**
1. ✅ Request reached your app? (not a Cloudflare error page)
2. ✅ Tracing initialized? (check Cloudflare logs)
3. ✅ Testing API endpoint? (not static asset)

---

## Documentation References

- **Full Setup Guide:** [docs/TRACING_SETUP.md](TRACING_SETUP.md)
- **Configuration Examples:** [.env.example](../.env.example)
- **PostHog OTLP Docs:** https://posthog.com/docs/integrate/opentelemetry
- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/

---

## Support

If you encounter issues:
1. Check [docs/TRACING_SETUP.md](TRACING_SETUP.md) for detailed troubleshooting
2. Review Cloudflare Function logs for error messages
3. Verify PostHog OTLP ingestion status in PostHog dashboard

---

**✅ That's it!** Once these environment variables are configured, your tracing is fully operational. No further code changes needed.
