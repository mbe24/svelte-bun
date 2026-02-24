# GitHub Actions Workflows

This document describes every GitHub Actions workflow in this repository and explains why the **Export OpenTelemetry Trace for CI/CD** standalone workflow was previously limited to the default branch (`main`) and how it was resolved.

---

## Table of Contents

1. [CI – Continuous Integration](#ci--continuous-integration)
2. [CD – Continuous Deployment](#cd--continuous-deployment)
3. [Why the standalone OTel workflow only ran on `main`](#why-the-standalone-otel-workflow-only-ran-on-main)
4. [Proposed Changes and Tradeoffs](#proposed-changes-and-tradeoffs)
5. [Traces vs Logs](#traces-vs-logs)

---

## CI – Continuous Integration

**File:** `.github/workflows/ci.yml`

### Triggers

| Event | Condition |
|---|---|
| `push` | `main` branch only |
| `pull_request` | PRs targeting `main` |

### Jobs

#### `build-and-test` – Build and Unit Tests

Runs on every triggered event. Steps:

1. Check out the repository.
2. Set up Bun (latest).
3. Restore the Bun dependency cache (keyed on `bun.lock`).
4. `bun install` – install dependencies.
5. `bun run check` – TypeScript / Svelte type checking.
6. `bun run build` – production build.
7. `bun test src/` – unit test suite.

#### `e2e-tests` – Run E2E Tests

Runs after `build-and-test` succeeds (`needs: build-and-test`). Spins up a PostgreSQL 16-Alpine service container and runs the full Playwright test suite against a live database.

Steps:

1. Check out the repository.
2. Set up Bun.
3. Restore Bun and Playwright browser caches.
4. Install dependencies and build.
5. Wait for PostgreSQL to become ready.
6. Push the Drizzle schema (`bun run db:push`).
7. Run Playwright E2E tests (`bun run test:e2e`).

**Required secrets:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (all fall back to `postgres`/`postgres`/`sveltekit_db` if not set).

#### `otel-export-trace` – Export OTLP Trace (inline)

Runs after both `build-and-test` and `e2e-tests` finish, regardless of their outcome (`if: always()`). Exports the current CI run as an OpenTelemetry trace using `corentinmusard/otel-cicd-action`. The export step is skipped unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and `continue-on-error: true` prevents a broken OTLP endpoint from affecting the overall workflow result.

---

## CD – Continuous Deployment

**File:** `.github/workflows/cd.yml`

### Triggers

| Event | Condition |
|---|---|
| `push` | `main` branch only |
| `pull_request` | PRs targeting `main` |

### Jobs

#### `deploy-production` – Deploy to Production

Runs **only** on a `push` to `main` (`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`).

Steps: checkout → Node.js 20 → `npm ci` → `npm run build` → copy `wrangler.toml` → deploy to Cloudflare Pages via `cloudflare/wrangler-action`.

**Required secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

#### `deploy-preview` – Deploy Preview

Runs **only** on `pull_request` events (`if: github.event_name == 'pull_request'`).

Same build steps as production, but deploys to the Cloudflare Pages preview environment using the PR's head branch name as the channel.

**Required secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

#### `otel-export-trace` – Export OTLP Trace (inline)

Runs after both `deploy-production` and `deploy-preview` finish, regardless of their outcome (`if: always()`). Because those two jobs each have a conditional `if` guard (only one runs per event), the OTel job waits for whichever actually executed and then exports the run trace. The export step is skipped unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

---

## Why the standalone OTel workflow only ran on `main`

The original standalone `otel-tracing.yml` (now removed) had two compounding limitations that prevented it from running on branches and PRs. OTel tracing has since been moved inline into the CI and CD workflows directly (see the `otel-export-trace` job in each workflow above).

### Reason 1 – `workflow_run` always executes from the default branch

GitHub's documentation states:

> "A workflow triggered by the `workflow_run` event always runs on the default branch of the repository, regardless of what branch the triggering workflow ran on."

This meant that even when CI finished on a feature-branch PR, the *code* of `otel-tracing.yml` that got executed was always the version on `main`. Any in-progress changes to the OTel workflow file on a feature branch were invisible until merged.

### Reason 2 – CI did not run on direct feature-branch pushes

The CI trigger was (and still is):

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

CI was therefore **not** triggered when a developer pushed directly to a feature branch without opening a pull request. Because `workflow_run` is downstream of CI, the OTel workflow was never triggered for those pushes either.

The combined effect of the old approach:

| Event | CI triggered? | OTel triggered? |
|---|---|---|
| Push to `main` | ✅ | ✅ |
| Push to feature branch (no PR) | ❌ | ❌ |
| Open / update PR targeting `main` | ✅ | ✅ (code from `main`) |

---

## Proposed Changes and Tradeoffs

### Option A – Expand the CI `push` trigger to all branches

Change the CI `push` trigger from `branches: [main]` to `branches: ['**']`.  
No changes are needed in `otel-tracing.yml`; the `workflow_run` chain picks up the new CI runs automatically.

```yaml
# ci.yml
on:
  push:
    branches: ['**']   # was: branches: [main]
  pull_request:
    branches: [ main ]
```

| | |
|---|---|
| **Pros** | Developers get build/test feedback on every push. OTel traces are exported for feature-branch work without touching the OTel workflow. |
| **Cons** | CI runs twice for PRs: once for the `push` to the head branch and once for the `pull_request` event. More CI minutes consumed (each push to any branch runs the full suite including E2E). The `otel-tracing.yml` code running for feature-branch CI runs still comes from `main`, so in-flight edits to the OTel file are not tested until merged. |

---

### Option B – Use a reusable `workflow_call` instead of inline jobs

Extract the OTel export logic into a dedicated reusable workflow file and call it as the last job in both CI and CD.

```yaml
# otel-export.yml (new reusable file)
on:
  workflow_call:
    secrets:
      OTEL_EXPORTER_OTLP_ENDPOINT:
        required: false
      OTEL_EXPORTER_OTLP_HEADERS:
        required: false
```

```yaml
# ci.yml (excerpt – replaces inline job)
  otel-export:
    needs: [build-and-test, e2e-tests]
    if: always()
    uses: ./.github/workflows/otel-export.yml
    secrets: inherit
```

| | |
|---|---|
| **Pros** | The OTel workflow executes in the *caller's* branch context, so feature-branch versions of the file are picked up immediately. Clean separation of concerns. |
| **Cons** | Requires coordinated changes to CI, CD, and the OTel workflow. The run ID passed to the action will be the *current* run (which includes the OTel job itself) rather than a cleanly finished predecessor run. |

---

### Option C – Add direct `push` / `pull_request` triggers to a standalone OTel workflow

Keep a standalone OTel workflow file and add push and pull_request events alongside `workflow_run`.

```yaml
on:
  push:
    branches: ['**']
  pull_request:
  workflow_run:
    workflows: [CI, CD]
    types: [completed]
  workflow_dispatch:
    inputs:
      runId:
        description: Workflow Run ID to export
        required: true
        type: string
```

The `runId` step must handle all cases:

```yaml
runId: ${{ github.event.workflow_run.id || github.run_id || inputs.runId }}
```

| | |
|---|---|
| **Pros** | Works for every trigger without modifying CI or CD. |
| **Cons** | When triggered by `push`/`pull_request` the export captures the *OTel workflow run itself* (not a separate CI/CD run), which has limited value. Duplicate runs will occur: once from `workflow_run` and once from `push`/`pull_request` for the same commit. |

---

### Option D – Scope `workflow_run` to specific branches

Add a `branches` filter to the `workflow_run` trigger to make the behaviour more explicit.

```yaml
on:
  workflow_run:
    workflows: [CI, CD]
    types: [completed]
    branches: ['**']   # explicit: fire for every branch
```

| | |
|---|---|
| **Pros** | Makes the intended scope self-documenting. |
| **Cons** | No functional change compared to omitting the filter entirely; all branches are already included by default. The "runs from `main`" constraint of `workflow_run` remains. |

---

**Resolution:** The inline job approach (effectively a simplified Option B) was chosen — OTel tracing is embedded directly in CI and CD as an `otel-export-trace` job with `if: always()`, which runs on every branch and PR without any of the `workflow_run` limitations.

---

## Traces vs Logs

### What is the difference?

**Traces** represent the execution flow of a process as a tree of **spans**. Each span records:

- A name (e.g. "Set up job", "Run actions/checkout@v4")
- Start and end timestamps (duration)
- A parent–child relationship (`parentSpanId`) so you can visualise the full call tree
- Key–value attributes describing what happened (status, conclusion, step number, etc.)

Traces do *not* only contain times — as visible in the OTLP export from `otel-cicd-action`, each span also carries attributes like `github.job.step.status`, `github.job.step.conclusion`, and `error`.

**Logs** are discrete, timestamped text messages (e.g. "Build failed: missing dependency"). In OTLP format they appear in `logRecords` inside `scopeLogs` / `instrumentationLibraryLogs`, not in `instrumentationLibrarySpans`.

In this repository:

| Signal | Emitter | Backend field |
|---|---|---|
| Traces | `otel-cicd-action` (CI/CD pipeline structure) | `instrumentationLibrarySpans` |
| Logs | PostHog OTLP integration (`hooks.server.ts`) | `logRecords` |

### Trace–log correlation

Correlating traces and logs is a core observability best practice. The standard mechanism is injecting the active `traceId` and `spanId` into every log record emitted during a span's execution. Observability tools (Grafana, Honeycomb, Jaeger, etc.) can then pivot directly from a log line to the trace that produced it, and vice versa.

In OTLP terms a correlated log record looks like:

```json
{
  "traceId": "e6acc63cccce3533bea761294d841e7f",
  "spanId":  "3f82c51aa032a236",
  "body":    "Database query took 450ms"
}
```

### Best practices

1. **Propagate context automatically** — use the OpenTelemetry SDK's built-in context propagation so `traceId`/`spanId` are injected into log records without manual work.
2. **Use structured logging** — emit logs as JSON (or OTLP `logRecords`) rather than plain text so the `traceId` field is machine-readable and indexable.
3. **Send both signals to the same backend** — use a single OTLP endpoint (e.g. Grafana Tempo + Loki, or Honeycomb) so the UI can correlate them natively without extra configuration.
4. **Set `service.name` consistently** — both trace resource attributes and log resource attributes must use the same `service.name` value (e.g. `svelte-bun/main`) so the backend can group signals by service and branch.
5. **Mind sampling** — traces are often sampled (e.g. 10% of requests); logs tied to sampled-out traces lose their correlation value. Head-based sampling (decided at the root span) keeps traces and their associated logs consistent.

### Application to this repository

The `otel-export-trace` jobs set `otelServiceName: svelte-bun/${{ github.head_ref || github.ref_name }}`. To enable full trace–log correlation, the PostHog OTLP log integration in `hooks.server.ts` should:

1. Use the same `service.name` value in its resource attributes.
2. Inject the active OpenTelemetry `traceId` and `spanId` into each `logRecord` it emits.

This allows Grafana (or any OTLP-compatible backend) to link a slow database log directly to the CI/CD pipeline span that triggered the request.
