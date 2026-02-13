# GitHub Secrets Configuration Guide

This guide explains how to configure GitHub Secrets for the svelte-bun project.

## Overview

The CI/CD workflow has been updated to support GitHub Secrets for database credentials. **The workflow will work without any configuration** using default test credentials (`postgres`/`postgres`), but you can optionally set secrets if you need custom credentials for your CI environment.

## Default Behavior (No Configuration Required)

The GitHub Actions workflow uses these defaults if secrets are not configured:
- `POSTGRES_USER`: `postgres`
- `POSTGRES_PASSWORD`: `postgres`
- `POSTGRES_DB`: `sveltekit_db`

This means your CI will work immediately without any secret configuration.

## Optional: Setting Up Custom Secrets

If you want to use different credentials in your CI environment:

### Step 1: Navigate to Repository Settings
1. Go to your GitHub repository: https://github.com/mbe24/svelte-bun
2. Click on **Settings** (requires admin access)
3. In the left sidebar, expand **Secrets and variables**
4. Click on **Actions**

### Step 2: Add Repository Secrets
Click **New repository secret** for each of the following:

#### Secret 1: POSTGRES_USER
- **Name**: `POSTGRES_USER`
- **Value**: Your desired PostgreSQL username (e.g., `testuser`)
- Click **Add secret**

#### Secret 2: POSTGRES_PASSWORD
- **Name**: `POSTGRES_PASSWORD`
- **Value**: Your desired PostgreSQL password (e.g., `securePassword123!`)
- Click **Add secret**

#### Secret 3: POSTGRES_DB
- **Name**: `POSTGRES_DB`
- **Value**: Your desired database name (e.g., `test_db`)
- Click **Add secret**

### Step 3: Verify
After adding secrets:
1. Go to the **Actions** tab
2. Run a workflow (or push a commit)
3. Check the workflow logs to ensure it's using your custom secrets

## Important Notes

1. **Secrets are encrypted**: GitHub encrypts secrets and they cannot be viewed after creation
2. **Only visible to workflows**: Secrets are only accessible during workflow execution
3. **No secrets in logs**: GitHub automatically redacts secret values from logs
4. **Workflow permissions**: Workflows from forks cannot access secrets (security feature)

## When to Use Custom Secrets

You might want custom secrets if:
- You're integrating with external test databases
- You have specific compliance requirements
- You want to test with production-like credentials
- You're running integration tests against real services

## When NOT to Use Custom Secrets

For most projects, the default credentials are sufficient because:
- CI runs in isolated environments
- Each workflow run gets a fresh PostgreSQL container
- Test data is not persistent
- Security is not a concern for ephemeral test databases

## Troubleshooting

### Workflow fails after adding secrets
- Verify secret names are exactly: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Check that secrets don't contain special characters that need escaping
- Review workflow logs for connection errors

### Want to remove secrets
1. Go to Settings → Secrets and variables → Actions
2. Click the ⋮ menu next to the secret
3. Select **Remove secret**
4. The workflow will fall back to default credentials

## Current Status

✅ **Your repository is ready to use!**

The workflow is configured to work immediately with default test credentials. You only need to follow this guide if you want to customize the credentials used in CI.

For local development and Docker deployment, refer to the main [Security Documentation](SECURITY.md).
