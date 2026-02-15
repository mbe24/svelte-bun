# PostHog HTTP Request Logging - Setup Guide

This document explains how to configure PostHog for HTTP request logging in your Svelte-Bun application.

## What was implemented

The application now automatically logs all HTTP requests to PostHog when configured. Each request log includes:

- **Request Method**: GET, POST, PUT, DELETE, etc.
- **Request Path**: The URL path accessed
- **Status Code**: HTTP response status (200, 404, 500, etc.)
- **Response Time**: Duration of the request in milliseconds
- **User Agent**: Browser/client information
- **Referer**: Source of the request
- **Authentication Status**: Whether the request was authenticated
- **User ID**: The ID of the authenticated user (if logged in)

## Setup Instructions

### 1. Create a PostHog Account

1. Go to [posthog.com](https://posthog.com/)
2. Sign up for a free account (or use a self-hosted instance)
3. Create a new project
4. Navigate to Project Settings → Project API Key
5. Copy your **Project API Key**

### 2. Configure Environment Variables

#### For Local Development

Add the following to your `.env` file:

```bash
POSTHOG_API_KEY=phc_your_actual_api_key_here
POSTHOG_HOST=https://app.posthog.com
```

**Note:** 
- Replace `phc_your_actual_api_key_here` with your actual PostHog Project API Key
- If using PostHog EU cloud, use `https://eu.posthog.com` as the host
- If using self-hosted PostHog, use your instance URL

#### For Cloudflare Workers Deployment

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Navigate to **Settings → Environment variables**
4. Add the following variables for both **Production** and **Preview** environments:
   - **Variable name:** `POSTHOG_API_KEY`
   - **Value:** Your PostHog Project API Key (e.g., `phc_...`)
   
   - **Variable name:** `POSTHOG_HOST` (optional)
   - **Value:** `https://app.posthog.com` (or your custom host)

5. Save the variables
6. Redeploy your application for the changes to take effect

### 3. Verify the Setup

After configuration, the application will automatically start logging HTTP requests to PostHog.

To verify:

1. Access your application
2. Navigate to different pages
3. Go to your PostHog dashboard
4. Navigate to **Events** or **Activity**
5. You should see events named `http_request` with all the request details

### 4. Optional: Disable Logging

PostHog logging is completely optional. If you don't configure the environment variables, the application will work normally without logging. No errors will occur.

## Event Structure

Each HTTP request creates an event in PostHog with the following structure:

```javascript
{
  distinctId: "user_123" or "192.168.1.1" or "anonymous",
  event: "http_request",
  properties: {
    method: "GET",
    path: "/api/counter",
    status: 200,
    duration_ms: 45,
    user_agent: "Mozilla/5.0...",
    referer: "https://example.com/page",
    authenticated: true,
    user_id: 123
  }
}
```

## Privacy Considerations

- **Distinct ID**: For authenticated users, we use `user_{userId}`. For anonymous users, we use the IP address or "anonymous".
- **No Personal Data**: We don't log request bodies, cookies, or sensitive headers.
- **User Agent**: Browser information is logged for analytics purposes.

## Performance

- Logging is **asynchronous** and does not block request processing
- On Cloudflare Workers, we use `waitUntil()` to ensure events are flushed without blocking the response
- Failed logging attempts do not affect application functionality

## Troubleshooting

### Events not appearing in PostHog

1. Verify your API key is correct
2. Check that environment variables are set correctly
3. For Cloudflare Workers, ensure you've redeployed after adding environment variables
4. Check browser console or server logs for any PostHog errors

### Application errors after adding PostHog

1. Verify the API key format (should start with `phc_`)
2. Check that the POSTHOG_HOST URL is correct and accessible
3. Review server logs for specific error messages

## Need Help?

If you encounter any issues:

1. Check the [PostHog documentation](https://posthog.com/docs)
2. Review your PostHog project settings
3. Check the application logs for error messages
4. Open an issue in the GitHub repository
