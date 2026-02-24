# Database Migrations Guide

This guide explains how database migrations work in svelte-bun, why they are designed the way they are, and what the recommended approaches are for different deployment environments.

## Table of Contents

- [Why Is There an HTTP Endpoint for Migrations?](#why-is-there-an-http-endpoint-for-migrations)
- [Why Don't Migrations Run Automatically?](#why-dont-migrations-run-automatically)
- [Available Migration Approaches](#available-migration-approaches)
  - [Approach 1: HTTP Endpoint (Current Default)](#approach-1-http-endpoint-current-default)
  - [Approach 2: GitHub Actions CI/CD Step (Recommended for Production)](#approach-2-github-actions-cicd-step-recommended-for-production)
  - [Approach 3: Drizzle `migrate()` at Application Startup](#approach-3-drizzle-migrate-at-application-startup)
  - [Approach 4: `drizzle-kit push` (Development Only)](#approach-4-drizzle-kit-push-development-only)
  - [Approach 5: Manual SQL Execution](#approach-5-manual-sql-execution)
- [Drizzle ORM Migration Tools: Push vs Migrate](#drizzle-orm-migration-tools-push-vs-migrate)
- [Choosing the Right Approach](#choosing-the-right-approach)
- [How Drizzle Migrations Work Internally](#how-drizzle-migrations-work-internally)

---

## Why Is There an HTTP Endpoint for Migrations?

The migration endpoint at `/api/admin/migrate` exists specifically because of **Cloudflare Pages/Workers edge runtime constraints**:

### Edge Runtime Limitations

Cloudflare Pages runs your application inside lightweight **V8 isolates** — not full Node.js or Bun processes. This means:

1. **No persistent filesystem**: There is no disk to read migration files from at runtime. The traditional `drizzle-kit migrate` CLI command reads SQL files from the `drizzle/` directory, which does not exist in the deployed Cloudflare edge bundle.

2. **No build-time database access** by default: The GitHub Actions build step compiles your SvelteKit application into static assets and a Worker script. The database is a separate external service (e.g., Neon) that is not connected during the build phase unless you explicitly configure it.

3. **No long-running startup process**: Cloudflare Workers are invoked per-request. There is no traditional "application startup" sequence like you would have with a long-running Node.js server (e.g., `app.listen(3000)`). Each invocation starts cold and must respond quickly.

4. **No TCP socket connections during build**: The Cloudflare build environment cannot establish TCP connections to external databases — only HTTP(S) connections are permitted.

### The Solution: An HTTP Endpoint

The HTTP migration endpoint works around all of these constraints by:
- Embedding the migration SQL directly in the server-side code (no filesystem needed)
- Executing the migration on-demand via an HTTP request after deployment
- Running inside the same edge function that already has database access via `platform.env.DATABASE_URL`
- Being safe to run multiple times thanks to `CREATE TABLE IF NOT EXISTS` and conditional constraint creation

This approach is common for serverless/edge deployments where you cannot run arbitrary CLI commands in the production environment.

---

## Why Don't Migrations Run Automatically?

Even though automatic migrations sound convenient, there are several strong reasons they are **not** run automatically on every deployment or request:

### 1. Safety — Migrations Can Be Destructive

Migrations may include `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN`, or data transformations. Running these automatically without human oversight on every deployment is dangerous, especially in production. An accidental schema change could destroy user data irreversibly.

### 2. Cold Start Performance

Cloudflare Workers must respond to requests in milliseconds. Running a migration check (or even a read query to check whether tables exist) on every cold start adds latency and consumes execution time budget. Users would experience slower first-requests.

### 3. Concurrent Migration Conflicts

Cloudflare deploys to hundreds of edge nodes globally. If migrations ran at startup, multiple instances could attempt to run the same migration simultaneously, leading to race conditions and duplicate-key errors even with `IF NOT EXISTS` guards.

### 4. Separation of Concerns

Deployment (pushing code) and schema changes (modifying the database) are separate operations with different risk profiles. Keeping them separate lets you:
- Roll back a bad deployment without touching the database
- Apply schema changes independently of code deployments
- Review and approve migrations as part of a separate workflow

### 5. Build/Runtime Environment Mismatch

The GitHub Actions build environment where `npm run build` runs does not have access to your production `DATABASE_URL` by default, nor should it — build-time credentials are harder to scope and rotate than runtime credentials.

---

## Available Migration Approaches

### Approach 1: HTTP Endpoint (Current Default)

**What it is:** A `POST /api/admin/migrate` endpoint embedded in the application that runs the migration SQL on demand.

**How to use:**
```bash
# Via browser: visit https://your-app.pages.dev/api/admin/migrate
# Via curl (no auth):
curl -X POST https://your-app.pages.dev/api/admin/migrate

# Via curl (with MIGRATION_SECRET configured):
curl -X POST https://your-app.pages.dev/api/admin/migrate \
  -H "Authorization: Bearer your-secret"
```

**Pros:**
- ✅ Works without any local tooling or credentials
- ✅ No CLI, no SSH, no local setup required
- ✅ Works in any environment including Cloudflare Pages edge runtime
- ✅ Idempotent — safe to run multiple times
- ✅ Includes a browser UI at `/api/admin/migrate`

**Cons:**
- ❌ Manual step — easy to forget after deploying a schema change
- ❌ The embedded SQL must be kept in sync with `drizzle/` migration files manually
- ❌ Does not track migration history (no `__drizzle_migrations` table)
- ❌ Does not support incremental/versioned migrations (only the full initial schema)

**Best for:** Initial setup and one-off deployments, especially when no CI/CD pipeline is configured.

> ⚠️ **Long-term maintenance warning:** This approach requires manually updating the embedded SQL in `+server.ts` every time the schema changes. For ongoing projects it should be treated as a **temporary fallback** and replaced with the [CI/CD approach](#approach-2-github-actions-cicd-step-recommended-for-production) once a pipeline is in place.

---

### Approach 2: GitHub Actions CI/CD Step (Recommended for Production)

**What it is:** Adding a migration step to your GitHub Actions workflow that runs `drizzle-kit migrate` (or `db:push`) against the production database before or after deploying the application code.

**How to configure:**

1. Add your production `DATABASE_URL` as a GitHub Actions secret (see [docs/GITHUB_SECRETS.md](GITHUB_SECRETS.md)):
   ```
   Settings → Secrets and variables → Actions → New repository secret
   Name: DATABASE_URL_PRODUCTION
   Value: postgresql://user:pass@your-neon-host.neon.tech/dbname?sslmode=require
   ```

2. Add a migration step to `.github/workflows/deploy.yml` before the deploy step:
   ```yaml
   - name: Run database migrations
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}
     run: npm run db:migrate
   ```

   Or using `db:push` (see [Push vs Migrate](#drizzle-orm-migration-tools-push-vs-migrate) below):
   ```yaml
   - name: Push database schema
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}
     run: npm run db:push
   ```

**Pros:**
- ✅ Fully automated — migrations run with every deployment
- ✅ Migrations are applied before traffic hits the new code
- ✅ Full migration history tracking (with `db:migrate`)
- ✅ Uses Drizzle's official tooling — no custom SQL to maintain
- ✅ Works with Neon and other HTTP-capable PostgreSQL providers

**Cons:**
- ❌ Requires `DATABASE_URL` to be available in GitHub Actions secrets
- ❌ Migrations run from the CI environment, not the edge — requires outbound database access
- ❌ Build step must complete successfully for migrations to run (or vice versa)

**Best for:** Production deployments with a CI/CD pipeline. This is the **recommended approach** for production use.

---

### Approach 3: Drizzle `migrate()` at Application Startup

**What it is:** Using Drizzle ORM's programmatic `migrate()` function inside your application to run migrations on the first request or at startup. This is possible in Node.js/Bun environments (e.g., Docker deployment) but not in Cloudflare Workers.

**How it works (Node.js/Bun only):**

```typescript
// src/lib/db/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations(connectionString: string) {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  
  // Reads migration files from the drizzle/ directory
  await migrate(db, { migrationsFolder: './drizzle' });
  
  await sql.end();
}
```

You can call this once at server startup (e.g., in a startup script or `hooks.server.ts`):

```typescript
// src/hooks.server.ts (Node.js/Docker only — NOT for Cloudflare Pages)
import { runMigrations } from '$lib/db/migrate';

// Run once at startup
if (typeof process !== 'undefined' && process.env.DATABASE_URL) {
  runMigrations(process.env.DATABASE_URL).catch(console.error);
}
```

**Pros:**
- ✅ Fully automatic — no manual step needed
- ✅ Uses Drizzle's official migration tracking
- ✅ Works seamlessly for Docker/Node.js deployments

**Cons:**
- ❌ **Does not work on Cloudflare Pages/Workers** — no filesystem access, no startup hook
- ❌ Adds latency to the first request if not run before server starts accepting traffic
- ❌ Risk of concurrent migrations if multiple instances start simultaneously (use a distributed lock)

**Best for:** Docker and traditional server deployments.

---

### Approach 4: `drizzle-kit push` (Development Only)

**What it is:** The `bun run db:push` (or `npm run db:push`) command uses `drizzle-kit push` to directly compare your TypeScript schema with the live database and apply the differences.

```bash
# Sync schema to local database
bun run db:push

# Sync schema to a specific database
DATABASE_URL="postgresql://..." bun run db:push
```

**Pros:**
- ✅ Fastest for local development — no need to generate migration files
- ✅ Always keeps the database in sync with your TypeScript schema

**Cons:**
- ❌ **Not safe for production** — does not track migration history
- ❌ Can cause data loss if Drizzle can't figure out renames (may drop and recreate columns)
- ❌ No rollback capability
- ❌ Requires interactive confirmation for destructive changes

**Best for:** Local development only. Never use in production.

---

### Approach 5: Manual SQL Execution

**What it is:** Directly running the SQL files in `drizzle/` against your database using `psql`, Neon SQL Editor, or another database client.

```bash
# Using psql
psql $DATABASE_URL -f drizzle/0000_perfect_meggan.sql

# Or paste contents into Neon SQL Editor
```

**Pros:**
- ✅ Full control — you see exactly what SQL runs
- ✅ Works for any PostgreSQL database

**Cons:**
- ❌ Entirely manual
- ❌ No migration tracking
- ❌ Easy to skip or apply migrations out of order

**Best for:** One-time setup or emergency fixes.

---

## Drizzle ORM Migration Tools: Push vs Migrate

Drizzle provides two distinct workflows for managing your database schema. Understanding the difference is essential for choosing the right approach:

### `drizzle-kit push` (`npm run db:push`)

- **Mechanism**: Introspects the live database schema, diffs it against your TypeScript schema, and generates + applies DDL statements directly.
- **Migration files**: Not used. No files are read or written.
- **History tracking**: None. Drizzle does not record that a migration was applied.
- **Safety**: Asks for confirmation on destructive changes locally, but is not safe for automated production use.
- **Use case**: Fast iteration during development.

### `drizzle-kit migrate` (`npm run db:migrate`)

- **Mechanism**: Reads SQL migration files from `drizzle/` (generated by `drizzle-kit generate`), checks which ones have already been applied (stored in a `__drizzle_migrations` table), and runs only the unapplied ones.
- **Migration files**: Required. Generated with `npm run db:generate`.
- **History tracking**: Yes — tracks applied migrations in `__drizzle_migrations` table.
- **Safety**: Only runs each migration once; idempotent and safe for production.
- **Use case**: Production deployments.

### Recommended Workflow

```
Development:
  1. Modify schema in src/lib/db/schema.ts
  2. Run: npm run db:push        ← fast local sync

Before committing a schema change:
  1. Run: npm run db:generate    ← generates a versioned SQL file in drizzle/
  2. Commit both schema.ts and the new migration file

In CI/CD (GitHub Actions):
  1. Run: npm run db:migrate     ← applies only new migrations, tracks history
  2. Then deploy the application
```

### Programmatic Migration with Drizzle's `migrate()`

For environments where you can run Node.js/Bun (Docker, VPS, traditional servers), Drizzle provides a `migrate()` function that applies migrations from the `drizzle/` folder programmatically:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: 'drizzle' });
await sql.end();
```

This is the **most robust programmatic approach** for non-edge deployments because it:
- Reads versioned migration files from disk
- Tracks which migrations have been applied
- Is safe to call multiple times (skips already-applied migrations)
- Uses the same migration files as `drizzle-kit migrate`

---

## Choosing the Right Approach

| Environment | Recommended Approach |
|---|---|
| **Local development** | `db:push` for fast iteration |
| **Cloudflare Pages (initial setup)** | HTTP endpoint `/api/admin/migrate` |
| **Cloudflare Pages (production CI/CD)** | GitHub Actions step with `db:migrate` |
| **Docker / traditional server** | Drizzle `migrate()` at startup, or CI/CD step |
| **Emergency fix** | Manual SQL execution |

### Improving the Current Setup

The current HTTP endpoint approach has one significant limitation: the embedded SQL must be kept in sync with the `drizzle/` migration files manually. As the schema evolves and new migration files are added, the SQL in `+server.ts` must be updated by hand.

A better long-term solution for Cloudflare Pages is to add a migration step to the GitHub Actions deploy workflow:

```yaml
# In .github/workflows/deploy.yml, before the deploy step:
- name: Run database migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npm run db:migrate
```

This approach:
- Uses Drizzle's official migration tracking (`__drizzle_migrations` table)
- Automatically handles incremental schema changes
- Removes the need to maintain embedded SQL in the HTTP endpoint
- Is fully automated — no manual steps after deploying a schema change

The HTTP endpoint can then be kept as a fallback or removed once the CI/CD workflow is in place.

---

## How Drizzle Migrations Work Internally

When you run `npm run db:generate`, Drizzle Kit:
1. Reads your TypeScript schema from `src/lib/db/schema.ts`
2. Optionally introspects the current database state
3. Generates a versioned SQL file in `drizzle/` (e.g., `0001_add_profile_table.sql`)
4. Updates `drizzle/meta/` with a snapshot of the current schema

When you run `npm run db:migrate`, Drizzle Kit:
1. Connects to the database
2. Creates a `__drizzle_migrations` table if it doesn't exist
3. Reads all SQL files in `drizzle/` and their checksums
4. Compares them with the records in `__drizzle_migrations`
5. Runs only the unapplied migrations in order
6. Records each applied migration in `__drizzle_migrations`

This ensures migrations are **applied exactly once**, in the correct order, even if the command is run multiple times.

For more information, see the [Drizzle ORM migrations documentation](https://orm.drizzle.team/docs/migrations).
