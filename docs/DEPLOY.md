# Cloudflare Pages Deployment Guide

This guide explains how to deploy the svelte-bun application to Cloudflare Pages using GitHub Actions.

## Overview

The project is configured with automated deployment workflows that handle both production and preview deployments:

- **Production Deployments**: Automatically deploy to production when code is pushed to the `main` branch
- **Preview Deployments**: Automatically create preview deployments for pull requests

## Architecture

The deployment uses:
- **@sveltejs/adapter-cloudflare**: SvelteKit adapter that builds the app for Cloudflare Pages
- **Cloudflare Wrangler**: CLI tool for deploying to Cloudflare Pages
- **GitHub Actions**: Automation platform that runs the deployment workflows
- **wrangler.toml**: Configuration file with Node.js compatibility flags for the Cloudflare Workers runtime

When the build completes, the adapter generates a worker script and static assets in `.svelte-kit/cloudflare/`, which is then deployed to Cloudflare Pages.

### Node.js Compatibility

The application requires Node.js built-in modules (like `fs`, `path`, `crypto`, etc.) through dependencies. These imports use the `node:` prefix (e.g., `import { randomBytes } from 'node:crypto'`). To support these modules in the Cloudflare Workers runtime, the `nodejs_compat_populate_process_env` compatibility flag must be enabled in your Cloudflare Pages project settings (see Step 3b below).

The project includes a `wrangler.toml` file with the compatibility flag specification. The GitHub Actions workflow copies it to the deployment directory for proper bundling configuration.

## Setting Up Cloudflare Pages Deployment

### Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. Admin access to the GitHub repository

### Step 1: Create a Cloudflare Account

If you don't have a Cloudflare account:

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Sign up with your email address
3. Verify your email address
4. Log in to the Cloudflare dashboard

### Step 2: Obtain Cloudflare Account ID

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on **Workers & Pages** in the left sidebar
3. On the right side of the page, you'll see your **Account ID**
4. Copy this Account ID (it looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

Alternatively:
1. Click on any domain in your Cloudflare account
2. Scroll down on the Overview page
3. On the right sidebar, under **API**, you'll find your **Account ID**

### Step 3: Create a Cloudflare Pages Project

**Important**: You must create the Cloudflare Pages project before the GitHub Actions workflow can deploy to it.

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on **Workers & Pages** in the left sidebar
3. Click **Create application**
4. Select the **Pages** tab
5. Click **Connect to Git** or **Direct Upload** (we'll use Direct Upload for Wrangler-based deployments)
6. Choose **Direct Upload**
7. Enter your project name: `svelte-bun` (this must match the `--project-name` in the workflow file)
8. Click **Create project**

The project is now created and ready to receive deployments from GitHub Actions.

**Note**: The project name you enter (in instruction 7 above) must exactly match the `--project-name` value in `.github/workflows/deploy.yml`. If you want to use a different name, update both locations.

### Step 3b: Configure Node.js Compatibility (Important!)

After creating the project, you must enable Node.js compatibility to avoid deployment errors:

1. In the Cloudflare Dashboard, go to your project (`svelte-bun`)
2. Click on **Settings** tab
3. Scroll down to **Functions** section
4. Find **Compatibility flags**
5. Click **Configure Workers compatibility flag**
6. Add the flag: `nodejs_compat_populate_process_env`
   - This is the full name of the flag that enables Node.js built-in modules and populates process environment variables
   - In the UI, it may appear as "nodejs_compat (populate process env)"
   - Do NOT use just "compat" (that's different)
7. Click **Save**

This enables Node.js built-in modules (`fs`, `path`, `crypto`, etc.) required by the application dependencies. The `node:` prefix in imports (e.g., `import { randomBytes } from 'node:crypto'`) works with this compatibility flag.

### Step 4: Create a Cloudflare API Token

You need to create an API token with the correct permissions to deploy to Cloudflare Pages.

1. Go to [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Click **Use template** next to "Edit Cloudflare Workers" OR create a custom token
4. For a custom token, set the following permissions:
   - **Account** → **Cloudflare Pages** → **Edit**
5. Optionally, you can restrict the token to:
   - Specific accounts (select your account)
   - IP address filtering (if deploying from a static IP)
   - TTL/expiration date (for security)
6. Click **Continue to summary**
7. Review the permissions and click **Create Token**
8. **Important**: Copy the token immediately - you won't be able to see it again!
   - The token looks like: `abcdef123456_EXAMPLE_TOKEN_789xyz`

### Step 5: Configure GitHub Secrets

Now you need to add the Cloudflare credentials to your GitHub repository as secrets.

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/svelte-bun`
2. Click on **Settings** (requires admin access)
3. In the left sidebar, expand **Secrets and variables**
4. Click on **Actions**
5. Click **New repository secret** for each of the following:

#### Secret 1: CLOUDFLARE_API_TOKEN
- **Name**: `CLOUDFLARE_API_TOKEN`
- **Value**: Paste the API token you copied in Step 4
- Click **Add secret**

#### Secret 2: CLOUDFLARE_ACCOUNT_ID
- **Name**: `CLOUDFLARE_ACCOUNT_ID`
- **Value**: Paste the Account ID you copied in Step 2
- Click **Add secret**

### Step 6: Verify the Setup

After adding both secrets:

1. Go to the **Actions** tab in your GitHub repository
2. Push a commit to the `main` branch or create a pull request
3. The deployment workflow should start automatically
4. Monitor the workflow run to ensure it completes successfully

## How the Automated Workflow Works

### Production Deployment (Push to main)

When code is pushed to the `main` branch:

1. GitHub Actions checks out the code
2. Installs Node.js and project dependencies
3. Builds the application with `npm run build`
   - SvelteKit compiles the app using `@sveltejs/adapter-cloudflare`
   - Output is generated in `.svelte-kit/cloudflare/`
4. Deploys to Cloudflare Pages using Wrangler
   - Uploads the built application to Cloudflare's global network
   - Updates the production URL

**Production URL**: `https://svelte-bun.pages.dev` (or your custom domain)

### Preview Deployment (Pull Requests)

When a pull request is created or updated:

1. GitHub Actions checks out the PR code
2. Installs Node.js and project dependencies
3. Builds the application with `npm run build`
4. Deploys to a unique preview URL using Wrangler
   - Each PR gets its own preview environment
   - Preview URL is based on the PR branch name

**Preview URL format**: `https://<branch-name>.svelte-bun.pages.dev`

The preview URL is automatically commented on the pull request, allowing reviewers to test the changes before merging.

## Workflow File

The deployment workflow is defined in `.github/workflows/deploy.yml`:

- **Trigger**: On push to `main` (production) or on pull requests (preview)
- **Jobs**:
  - `deploy-production`: Deploys to production (only on main branch)
  - `deploy-preview`: Deploys preview environment (only on PRs)
- **Steps**: Checkout → Install dependencies → Build → Deploy with Wrangler

## Environment Variables

The application uses platform-specific environment variable handling:
- **Local development**: Uses `process.env` from Node.js
- **Cloudflare Workers**: Uses `platform.env` from SvelteKit's request event

### For Cloudflare Pages Runtime

If your application requires environment variables (like `DATABASE_URL`), configure them in Cloudflare Pages:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages**
3. Select your project (`svelte-bun`)
4. Go to **Settings** → **Environment variables**
5. Add your environment variables:
   - Click **Add variable**
   - Enter variable name (e.g., `DATABASE_URL`)
   - Enter variable value
   - Choose environment: **Production** and/or **Preview**
   - Click **Save**

**Note**: Environment variables configured in Cloudflare Pages are available at runtime via `event.platform.env` in your SvelteKit application.

### For GitHub Actions Build

The GitHub Actions workflow uses `process.env` during the build step. If your build requires environment variables:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add your variables (e.g., `DATABASE_URL`)

**Important**: The `DATABASE_URL` secret is already configured in the GitHub Actions workflow for the build step. The application code uses lazy database initialization to defer connection until request time, where it accesses `platform.env` in Cloudflare Workers.

### Database Considerations for Cloudflare Pages

Cloudflare Workers (which power Cloudflare Pages) have specific limitations:

1. **No persistent filesystem**: Traditional file-based databases won't work
2. **No TCP connections**: Traditional database drivers that use TCP (like `postgres`) won't work
3. **Edge runtime**: Not all Node.js APIs are available

**This application supports:**
- **Neon serverless driver** (`@neondatabase/serverless`): HTTP-based PostgreSQL client for Cloudflare Workers
- **postgres-js** (local development): Traditional TCP-based PostgreSQL client for Node.js/Bun

The database connection logic automatically detects the runtime environment:
- **Cloudflare Workers/Pages**: Uses Neon serverless driver with HTTP connections
- **Local development**: Uses postgres-js with TCP connections

**Recommended database options:**
- [Neon](https://neon.tech/): Serverless PostgreSQL with edge-friendly HTTP-based connections (✅ **recommended and supported**)
- [Cloudflare D1](https://developers.cloudflare.com/d1/): Cloudflare's serverless SQLite database
- [Supabase](https://supabase.com/): PostgreSQL with REST API and edge support
- [Turso](https://turso.tech/): Edge-hosted SQLite with global replication

**To use Neon for Cloudflare Pages:**
1. Create a free account at [neon.tech](https://neon.tech/)
2. Create a new PostgreSQL database
3. Copy the connection string
4. Add it as an environment variable `DATABASE_URL` in Cloudflare Pages Settings → Environment variables
5. The application will automatically use the Neon serverless driver in the Cloudflare environment


## Custom Domains

To use a custom domain with your Cloudflare Pages deployment:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages**
3. Select your project (`svelte-bun`)
4. Go to **Custom domains**
5. Click **Set up a custom domain**
6. Enter your domain name (e.g., `app.example.com`)
7. Follow the DNS configuration instructions
8. Wait for DNS propagation (usually a few minutes)

## Troubleshooting

### Project Not Found Error (Code 8000007)

**Error**: `Project not found. The specified project name does not match any of your existing projects. [code: 8000007]`

**Cause**: The Cloudflare Pages project doesn't exist yet in your Cloudflare account.

**Solution**:
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click on **Workers & Pages** in the left sidebar
3. Click **Create application**
4. Select the **Pages** tab
5. Click **Direct Upload**
6. Enter project name: `svelte-bun` (must match `--project-name` in `.github/workflows/deploy.yml`)
7. Click **Create project**
8. Re-run the failed GitHub Actions workflow

**Important**: The project must be created manually in Cloudflare Dashboard before the first deployment. Wrangler cannot automatically create projects via the API.

### Deployment Fails with Authentication Error

**Error**: `Authentication error` or `Invalid API token`

**Solution**:
- Verify that `CLOUDFLARE_API_TOKEN` is correctly set in GitHub Secrets
- Ensure the API token has not expired
- Check that the token has the correct permissions (Cloudflare Pages → Edit)
- Try creating a new API token and updating the secret

### Deployment Fails with Account ID Error

**Error**: `Account ID not found` or `Invalid account ID`

**Solution**:
- Verify that `CLOUDFLARE_ACCOUNT_ID` is correctly set in GitHub Secrets
- Ensure you copied the Account ID correctly (no extra spaces or characters)
- Log in to Cloudflare Dashboard and verify your Account ID

### Build Fails

**Error**: Build process fails during `npm run build`

**Solution**:
- Check the workflow logs for specific error messages
- Ensure all dependencies are correctly specified in `package.json`
- Test the build locally with `npm run build` to identify issues
- Verify that the project builds successfully on the CI workflow (`.github/workflows/ci.yml`)

### Node.js Built-in Module Errors During Deployment

**Error**: `Could not resolve "fs"`, `Could not resolve "crypto"`, or similar errors for Node.js built-in modules during Wrangler bundling

**Example**:
```
✘ [ERROR] Could not resolve "crypto"
The package "crypto" wasn't found on the file system but is built into node.
- Add the "nodejs_compat" compatibility flag to your project.
```

**Cause**: The application or its dependencies use Node.js built-in modules that are not available by default in the Cloudflare Workers runtime.

**Solution**:
This should be automatically handled by the `wrangler.toml` file in the repository. If you still encounter this error:

1. Verify `wrangler.toml` exists in the root directory with:
   ```toml
   name = "svelte-bun"
   compatibility_flags = ["nodejs_compat_populate_process_env"]
   compatibility_date = "2024-01-01"
   ```

2. Ensure the GitHub Actions workflow includes the step to copy `wrangler.toml`:
   ```yaml
   - name: Copy wrangler.toml to deployment directory
     run: cp wrangler.toml .svelte-kit/cloudflare/
   ```

3. Verify that your Cloudflare Pages project has the `nodejs_compat_populate_process_env` compatibility flag configured in Settings → Functions → Compatibility flags.

4. Ensure Node.js built-in module imports use the `node:` prefix (e.g., `import { randomBytes } from 'node:crypto'` instead of `import { randomBytes } from 'crypto'`).

5. If issues persist, check if your code directly uses Node.js APIs that are not supported even with `nodejs_compat_populate_process_env`. Consider using edge-compatible alternatives.

### Native Dependency Errors

**Error**: Build or runtime errors related to native Node.js modules like `bcrypt`, `sqlite3`, `sharp`, or similar packages with C++ bindings

**Example**:
```
Error: Cannot find module './node_modules/bcrypt/...'
Module not found: Can't resolve 'bindings'
```

**Cause**: Native dependencies with C++ bindings don't work on Cloudflare Workers/Pages because they require native Node.js APIs that aren't available in the edge runtime.

**Solution**:
Replace native dependencies with pure JavaScript alternatives:

**Common replacements:**
- `bcrypt` → `bcryptjs` (pure JS password hashing)
- `sqlite3` → `@libsql/client` or Cloudflare D1 (edge-compatible SQLite)
- `sharp` → Cloudflare's Image Resizing API
- `canvas` → Consider server-side rendering alternatives or client-side canvas
- `postgres` → Use `@neondatabase/serverless` or HTTP-based PostgreSQL clients

**This project uses:**
- ✅ `bcryptjs` instead of `bcrypt` for password hashing
- ✅ `@neondatabase/serverless` for Cloudflare Workers/Pages (HTTP-based PostgreSQL)
- ✅ `postgres` for local development (TCP-based PostgreSQL)
- ✅ Automatic runtime detection to use the correct driver

The application automatically detects the runtime environment and uses the appropriate database driver:
- **Cloudflare Workers/Pages**: Uses `@neondatabase/serverless` with HTTP connections
- **Local development**: Uses `postgres` with TCP connections

**Database Connection:**
To use this application on Cloudflare Pages, you need a PostgreSQL database that supports HTTP connections. We recommend:
- [Neon](https://neon.tech/) - Free tier available, optimized for edge environments
- Set the `DATABASE_URL` environment variable in Cloudflare Pages Settings

### Deployment Works but Site Doesn't Load

**Error**: Deployment succeeds but the site shows errors or doesn't load

**Solution**:
- Check Cloudflare Pages logs in the dashboard for specific errors
- Verify the `DATABASE_URL` environment variable is correctly configured in Cloudflare Pages Settings
- Ensure your database (e.g., Neon) allows connections from Cloudflare's edge network
- Review the Cloudflare Workers runtime compatibility
- Check that the database has the required tables (run migrations)

### Preview Deployment URL Not Appearing

**Issue**: Pull request created but no preview URL is commented

**Solution**:
- Check the Actions tab for workflow status
- Ensure the workflow has `pull-requests: write` permission
- Verify the PR is targeting the `main` branch
- Check if the workflow run completed successfully

## Monitoring and Logs

### View Deployment Status

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Click on the latest workflow run
4. View logs for each step

### View Cloudflare Pages Logs

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages**
3. Select your project (`svelte-bun`)
4. Go to **Deployments** to see deployment history
5. Click on a deployment to view logs and details

### Analytics

Cloudflare Pages includes analytics for:
- Page views
- Request volume
- Bandwidth usage
- Error rates

Access analytics in: **Cloudflare Dashboard** → **Workers & Pages** → **Your Project** → **Analytics**

## Security Best Practices

1. **API Token Rotation**: Regularly rotate your Cloudflare API token (every 90 days recommended)
2. **Minimal Permissions**: Use tokens with only the required permissions (Cloudflare Pages → Edit)
3. **Token Scope**: Restrict tokens to specific accounts if possible
4. **Secret Management**: Never commit secrets to the repository
5. **Environment Variables**: Store sensitive data in Cloudflare Pages environment variables, not in code

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Workers Runtime](https://developers.cloudflare.com/workers/runtime-apis/)

## Support

If you encounter issues:

1. Check the [Cloudflare Community Forum](https://community.cloudflare.com/)
2. Review [SvelteKit Discussions](https://github.com/sveltejs/kit/discussions)
3. Open an issue in this repository with detailed logs and error messages

## Summary

With this setup, your svelte-bun application will:
- ✅ Automatically deploy to production on every push to `main`
- ✅ Create preview deployments for every pull request
- ✅ Leverage Cloudflare's global edge network for fast performance
- ✅ Scale automatically without managing servers
- ✅ Benefit from Cloudflare's DDoS protection and CDN

Your deployment workflow is now fully automated - just push code and let GitHub Actions and Cloudflare Pages handle the rest!
