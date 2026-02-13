# Security Configuration

This document explains how to properly configure environment variables and secrets for the svelte-bun application.

## Environment Variables

### Local Development

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file with your credentials:**
   ```
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_secure_password_here
   POSTGRES_DB=sveltekit_db
   DATABASE_URL=postgresql://postgres:your_secure_password_here@localhost:5432/sveltekit_db
   ```

   ⚠️ **Important:** Never commit the `.env` file to version control. It's already listed in `.gitignore`.

### Docker Deployment

When using Docker Compose, create a `.env` file in the same directory as `docker-compose.yml`:

```bash
# .env file for Docker Compose
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=sveltekit_db
DATABASE_URL=postgresql://postgres:your_secure_password_here@db:5432/sveltekit_db
```

Note: The host in `DATABASE_URL` should be `db` (the service name in docker-compose.yml) instead of `localhost`.

Then run:
```bash
docker-compose up -d
```

Docker Compose will automatically load environment variables from the `.env` file.

## GitHub Actions Secrets

For CI/CD workflows, you should configure GitHub Secrets instead of hardcoding credentials.

### Setting Up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets (optional - defaults are used if not set):

   | Secret Name | Description | Default Value (if not set) |
   |-------------|-------------|---------------------------|
   | `POSTGRES_USER` | PostgreSQL username | `postgres` |
   | `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
   | `POSTGRES_DB` | Database name | `sveltekit_db` |

### Using Defaults in CI

The CI workflow is configured to use default values (`postgres` for user and password) if secrets are not set. This allows the CI to work out of the box while still supporting custom secrets if needed.

If you want to use custom credentials in CI:
1. Set the secrets as described above
2. The workflow will automatically use them instead of the defaults

## Best Practices

1. **Never commit credentials to version control**
   - Always use `.env` files for local development
   - Ensure `.env` is in `.gitignore` (already configured)

2. **Use strong passwords in production**
   - The example passwords are for development only
   - Generate strong, unique passwords for production environments

3. **Use different credentials for different environments**
   - Development credentials should differ from production
   - Consider using a password manager or secrets management service

4. **Rotate credentials regularly**
   - Change database passwords periodically
   - Update `.env` files and secrets accordingly

5. **Limit access to secrets**
   - Only give repository access to trusted team members
   - Use GitHub's environment protection rules for sensitive deployments

## Verifying Your Setup

### Local Development
```bash
# Check if .env file exists and is not tracked by git
cat .env
git status .env  # Should show it's ignored
```

### Docker Compose
```bash
# Test that environment variables are loaded correctly
docker-compose config
```

### GitHub Actions
- Check the workflow runs in the Actions tab
- Ensure the database connection is successful
- If using custom secrets, verify they're being used correctly

## Troubleshooting

### "POSTGRES_PASSWORD not set" Error

If you see an error about `POSTGRES_PASSWORD` not being set when running Docker Compose:
1. Make sure you have a `.env` file in the same directory as `docker-compose.yml`
2. Check that `POSTGRES_PASSWORD` is defined in the `.env` file
3. Verify the file format (no quotes needed around values)

### CI Workflow Failing

If the GitHub Actions workflow fails with database connection errors:
1. Check that the secrets are set correctly (if using custom values)
2. Verify the secret names match exactly: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
3. The workflow uses fallback defaults, so it should work even without secrets

### Connection Refused

If you get connection refused errors:
1. For local development, use `localhost` as the database host
2. For Docker Compose, use `db` (the service name) as the database host
3. Make sure `DATABASE_URL` matches your setup
