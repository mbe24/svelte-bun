# Upstash Redis Setup for Rate Limiting

This guide explains how to configure Upstash Redis for rate limiting counter actions in the application.

## What is Upstash Redis?

Upstash Redis is a serverless Redis database designed for edge computing and serverless environments. It's perfect for this application because:

- **Serverless-friendly**: REST API that works in Cloudflare Workers
- **Pay-per-request**: Only pay for what you use
- **Low latency**: Global edge locations for fast response times
- **Free tier available**: Great for getting started

## Rate Limiting Details

The application implements rate limiting for counter actions (increment/decrement) with the following configuration:

- **Rate Limit**: 3 actions per 10 seconds per user
- **Algorithm**: Sliding window (more accurate than fixed window)
- **Scope**: Per-user rate limiting (each user has their own limit)
- **Graceful degradation**: If Redis is not configured or unavailable, the application continues to work without rate limiting

## Setup Instructions

### 1. Create an Upstash Redis Database

1. Sign up for a free account at [Upstash Console](https://console.upstash.com/)
2. Click "Create Database"
3. Choose a name for your database (e.g., "svelte-bun-ratelimit")
4. Select a region close to your users
5. Click "Create"

### 2. Get Your Connection Credentials

After creating the database, you'll see your connection details:

1. **UPSTASH_REDIS_REST_URL**: The REST API endpoint URL (e.g., `https://xxx.upstash.io`)
2. **UPSTASH_REDIS_REST_TOKEN**: The REST API token (secret)

### 3. Configure for Local Development

For local development, add these variables to your `.env` file:

```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_secret_token_here
```

### 4. Configure for Cloudflare Pages Deployment

For production deployment on Cloudflare Pages:

1. Go to your Cloudflare Pages project settings
2. Navigate to **Settings** → **Environment variables**
3. Add the following variables:

   **For Production:**
   - Variable name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: Your Upstash REST token (the secret one)
   - Environment: Production

   **For Preview:**
   - Variable name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: Your Upstash REST token (or a separate token for preview)
   - Environment: Preview

4. Update `wrangler.toml` with your REST URL:
   ```toml
   [vars]
   UPSTASH_REDIS_REST_URL = "https://your-redis-instance.upstash.io"
   ```

   **Note**: The REST URL is public and safe to commit to your repository. The REST token is secret and should only be set in Cloudflare environment variables.

### 5. Verify the Configuration

After configuring the environment variables:

1. Deploy or restart your application
2. Navigate to the counter page
3. Try clicking increment/decrement buttons more than 3 times within 10 seconds
4. You should see an error message: "Too many actions. Please wait X seconds before trying again."

## Testing Rate Limiting

To test that rate limiting is working:

1. Log in to the application
2. Go to the counter page
3. Click the increment or decrement button rapidly
4. After the 3rd click within 10 seconds, you should see a rate limit error message
5. Wait for the countdown to reach 0, then try again

## Troubleshooting

### Rate limiting is not working

**Check environment variables:**
```bash
# In local development
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

**Check Cloudflare Pages environment variables:**
- Go to your Cloudflare Pages project → Settings → Environment variables
- Verify that `UPSTASH_REDIS_REST_TOKEN` is set

**Check the browser console:**
- Open DevTools → Console
- Look for any error messages related to rate limiting

### Rate limiting is too strict/lenient

The rate limit is configured in `src/lib/rate-limit.ts`:

```typescript
// Current: 3 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 s'),
  // ...
});
```

To adjust:
- Change the first parameter (3) to allow more/fewer requests
- Change the second parameter ('10 s') to use a different time window
  - Examples: '5 s', '1 m', '1 h'

### Application is not working at all

If Redis is misconfigured or unavailable, the application should continue to work without rate limiting. Check the server logs for errors.

## Cost Considerations

**Upstash Free Tier (as of 2024):**
- 10,000 commands per day
- Sufficient for most small to medium applications

**Estimate for this application:**
- Each rate-limited action = 1-2 Redis commands
- 10,000 commands ≈ 5,000-10,000 counter actions per day
- Perfect for development and small production deployments

For larger deployments, consider upgrading to a paid plan.

## Security Notes

- **REST URL**: Safe to commit to Git (it's public)
- **REST Token**: **Never** commit to Git (it's a secret)
- The REST token should only be set in environment variables
- Use different tokens for development and production
- Rotate tokens periodically for security

## Additional Resources

- [Upstash Documentation](https://docs.upstash.com/)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration#environment-variables)

## Architecture

The rate limiting implementation:

1. **Client** → Sends counter action request
2. **API Handler** (`/api/counter`) → Checks rate limit via Upstash Redis
3. **Redis** → Tracks request count per user in a sliding window
4. **API Handler** → Returns 429 if rate limited, or processes the request
5. **Client** → Displays error message if rate limited

This architecture ensures:
- Low latency (Redis is fast)
- Accurate rate limiting (sliding window algorithm)
- Scalability (serverless Redis)
- Resilience (graceful degradation if Redis is down)
