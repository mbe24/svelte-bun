# GitHub Actions Workflows

This document describes every GitHub Actions workflow in this repository, explains the current behavior of each trigger, and analyses why the **Export OpenTelemetry Trace for CI/CD** workflow was previously limited to the default branch (`main`).

---

## Table of Contents

1. [CI – Continuous Integration](#ci--continuous-integration)
2. [CD – Continuous Deployment](#cd--continuous-deployment)
3. [Export OpenTelemetry Trace for CI/CD](#export-opentelemetry-trace-for-cicd)
4. [Why the OTel workflow only ran on `main`](#why-the-otel-workflow-only-ran-on-main)
5. [Proposed Changes and Tradeoffs](#proposed-changes-and-tradeoffs)

---

## CI – Continuous Integration

**File:** `.github/workflows/ci.yml`

### Triggers

| Event | Condition |
|---|---|
| `push` | Any branch (`**`) |
| `pull_request` | PRs targeting `main` |

> **Note:** Before the change described in this document the `push` trigger was scoped to `branches: [main]` only, meaning direct pushes to feature branches did *not* run CI.

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

#### `e2e-tests` – End-to-End Tests

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

---

## Export OpenTelemetry Trace for CI/CD

**File:** `.github/workflows/otel-tracing.yml`

### Triggers

| Event | Condition |
|---|---|
| `workflow_run` | Fires when **CI** or **CD** completes (any result) |
| `workflow_dispatch` | Manual trigger; requires a `runId` input |

### Jobs

#### `otel-export-trace` – OpenTelemetry Export Trace

Exports a completed workflow run as an OpenTelemetry trace using `corentinmusard/otel-cicd-action`.

- **Conditional execution:** the export step is skipped unless the `OTEL_EXPORTER_OTLP_ENDPOINT` secret is set.
- **Error handling:** `continue-on-error: true` prevents a broken OTLP endpoint from blocking the overall pipeline status.
- The `runId` is sourced from `github.event.workflow_run.id` (automatic) or the manual `inputs.runId` (dispatch).

**Required secrets:** `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`.

---

## Why the OTel workflow only ran on `main`

There are two compounding reasons.

### Reason 1 – `workflow_run` always executes from the default branch

GitHub's documentation states:

> "A workflow triggered by the `workflow_run` event always runs on the default branch of the repository, regardless of what branch the triggering workflow ran on."

This means that even when CI finishes on a feature-branch PR, the *code* of `otel-tracing.yml` that gets executed is always the version on `main`. Any in-progress changes to the OTel workflow file on a feature branch are invisible until they are merged.

### Reason 2 – CI did not run on direct feature-branch pushes

Before the fix in this PR the CI trigger was:

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

CI was therefore **not** triggered when a developer pushed directly to a feature branch without opening a pull request. Because `workflow_run` is downstream of CI, the OTel workflow was never triggered for those pushes either.

The combined effect:

| Event | CI triggered? | OTel triggered? |
|---|---|---|
| Push to `main` | ✅ | ✅ |
| Push to feature branch (no PR) | ❌ | ❌ |
| Open / update PR targeting `main` | ✅ | ✅ (code from `main`) |

---

## Proposed Changes and Tradeoffs

### Option A – Expand the CI `push` trigger to all branches *(implemented)*

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
| **Pros** | Minimal change. Developers get build/test feedback on every push. OTel traces are exported for feature-branch work without touching the OTel workflow. |
| **Cons** | More CI minutes consumed (each push to any branch runs the full suite including E2E). The `otel-tracing.yml` code running for feature-branch CI runs still comes from `main`, so in-flight edits to the OTel file are not tested until merged. |

---

### Option B – Replace `workflow_run` with `workflow_call` (reusable workflow)

Refactor `otel-tracing.yml` to expose a `workflow_call` trigger and call it as the last job in both CI and CD.

```yaml
# otel-tracing.yml (excerpt)
on:
  workflow_call:
    secrets:
      OTEL_EXPORTER_OTLP_ENDPOINT:
        required: false
      OTEL_EXPORTER_OTLP_HEADERS:
        required: false
  workflow_dispatch:
    inputs:
      runId:
        description: Workflow Run ID to export
        required: true
        type: string
```

```yaml
# ci.yml (excerpt – new final job)
  otel-export:
    needs: [build-and-test, e2e-tests]
    if: always()
    uses: ./.github/workflows/otel-tracing.yml
    secrets: inherit
```

| | |
|---|---|
| **Pros** | The OTel workflow executes in the *caller's* branch context, so feature-branch versions of the file are picked up immediately. Clean separation of concerns. |
| **Cons** | Requires coordinated changes to CI, CD, and the OTel workflow. The run ID passed to the action will be the *current* run (which includes the OTel job itself) rather than a cleanly finished predecessor run. |

---

### Option C – Add direct `push` / `pull_request` triggers to `otel-tracing.yml`

Add push and pull_request events alongside `workflow_run`.

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

**Recommendation:** Option A (implemented in this PR) is the lowest-risk path. It keeps the proven `workflow_run` chain intact and simply extends CI feedback — and therefore OTel traces — to every branch with minimal blast radius.
