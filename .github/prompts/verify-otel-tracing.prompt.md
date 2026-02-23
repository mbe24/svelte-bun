---
mode: agent
description: Verify that the OpenTelemetry CI/CD tracing workflow is working correctly and diagnose any failures.
---

Check the most recent runs of the "Export OpenTelemetry Trace for CI/CD" workflow in the mbe24/svelte-bun GitHub Actions:

1. Report whether the latest runs succeeded or failed, including any error messages from the logs.
2. If there are failures, diagnose the root cause and propose a fix.
3. If the runs succeeded, confirm that traces are being exported with the service name `svelte-bun`.
4. Check whether a newer stable version of `corentinmusard/otel-cicd-action` is available beyond the currently pinned commit SHA, and report if an update is needed.
