# PostHog Analytics & Logging - Setup Guide

This document explains how to configure PostHog for analytics, HTTP request logging, exception tracking, and custom logs in your Svelte-Bun application.

## What was implemented

### Server-Side Features
The application now automatically logs all HTTP requests to PostHog when configured. Each request log includes:

- **Request Method**: GET, POST, PUT, DELETE, etc.
- **Request Path**: The URL path accessed
- **Status Code**: HTTP response status (200, 404, 500, etc.)
- **Response Time**: Duration of the request in milliseconds
- **User Agent**: Browser/client information
- **Referer**: Source of the request
- **Authentication Status**: Whether the request was authenticated
- **User ID**: The ID of the authenticated user (if logged in)

### Client-Side Features
The application also includes client-side PostHog integration for:

- **Page View Tracking**: Automatically tracks page navigation
- **Exception Logging**: Captures client-side errors and exceptions
- **Custom Logs**: Log custom messages with different severity levels (info, warn, error, debug)
- **User Identification**: Identify users for better analytics
- **Event Tracking**: Track custom events and user interactions

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
# PostHog Configuration (for both server and client-side tracking)
# PostHog API keys are safe to expose publicly - they're designed for browser use
POSTHOG_API_KEY=phc_your_actual_api_key_here
POSTHOG_HOST=https://app.posthog.com
```

**Note:** 
- Replace `phc_your_actual_api_key_here` with your actual PostHog Project API Key
- PostHog API keys are designed to be public (used in browsers), so it's safe to use them
- If using PostHog EU cloud, use `https://eu.posthog.com` as the host
- If using self-hosted PostHog, use your instance URL
- The server automatically passes these to the client for browser-side tracking

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

After configuration, the application will automatically start logging to PostHog.

To verify:

1. Access your application
2. Navigate to different pages
3. Go to your PostHog dashboard
4. Navigate to **Events** tab - You should see `http_request` events with all request details
5. Navigate to **Logs** tab - You should see custom logs and exceptions

### 4. Optional: Disable Logging

PostHog logging is completely optional. If you don't configure the environment variables, the application will work normally without logging. No errors will occur.

## Features & Event Types

### 1. HTTP Request Logging (Server-Side)

Automatically captures all HTTP requests:

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

### 2. Exception Logging

**Client-Side Exceptions:**
All uncaught errors are automatically logged via `hooks.client.ts`:

```javascript
{
  event: "exception",
  properties: {
    error_message: "Cannot read property 'x' of undefined",
    error_name: "TypeError",
    error_stack: "TypeError: Cannot read...",
    url: "/counter",
    route: "counter"
  }
}
```

**Server-Side Exceptions:**
Server errors are logged in catch blocks (see `/api/auth/login` for example):

```javascript
{
  event: "server_exception",
  properties: {
    error_message: "Database connection failed",
    error_code: "CONNECTION_ERROR",
    error_name: "Error",
    error_stack: "Error: Database...",
    endpoint: "/api/auth/login",
    method: "POST"
  }
}
```

### 3. Custom Logs

You can log custom messages from your client-side code:

```typescript
import { logMessage, logException } from '$lib/posthog-client';

// Log informational messages
logMessage('info', 'User completed checkout', { 
  order_id: '12345',
  amount: 99.99 
});

// Log warnings
logMessage('warn', 'API rate limit approaching', { 
  requests_remaining: 10 
});

// Log errors
logMessage('error', 'Payment failed', { 
  error_code: 'CARD_DECLINED' 
});

// Log exceptions with context
try {
  // ... your code
} catch (error) {
  if (error instanceof Error) {
    logException(error, { 
      action: 'checkout',
      step: 'payment' 
    });
  }
}
```

### 4. Page View Tracking

Page views are automatically tracked via `+layout.svelte`:

```javascript
{
  event: "$pageview",
  properties: {
    $current_url: "https://yourapp.com/counter"
  }
}
```

### 5. User Identification

You can identify users after login (add this to your login success handler):

```typescript
import { identifyUser } from '$lib/posthog-client';

// After successful login
identifyUser(userId, {
  username: 'john_doe',
  email: 'john@example.com',
  plan: 'free'
});
```

And reset on logout:

```typescript
import { resetPostHog } from '$lib/posthog-client';

// On logout
resetPostHog();
```

## Viewing Data in PostHog

### Events Tab
- View all captured events including `http_request`, `exception`, `$pageview`
- Filter by event type, user, or time range
- Analyze event properties and patterns

### Logs Tab
- View custom logs created with `logMessage()`
- Filter by log level (info, warn, error, debug)
- Search logs by message content
- See log context and properties

### Persons Tab
- View identified users
- See user properties and activity timeline
- Track user journey across events

## Code Examples

### Example: Counter Page with Logging

The counter page (`/src/routes/counter/+page.svelte`) demonstrates exception and log tracking:

```typescript
import { logException, logMessage } from '$lib/posthog-client';

// Log successful actions
async function updateCounter(action: 'increment' | 'decrement') {
  try {
    const response = await fetch('/api/counter', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    
    if (response.ok) {
      const data = await response.json();
      // Log successful action
      logMessage('info', 'Counter updated', { 
        action, 
        new_value: data.value 
      });
    }
  } catch (error) {
    // Log exceptions
    if (error instanceof Error) {
      logException(error, { 
        action: 'update_counter',
        counter_action: action 
      });
    }
  }
}
```

### Example: Server-Side Exception Logging

Server endpoints can log exceptions (see `/src/routes/api/auth/login/+server.ts`):

```typescript
import { getPostHog } from '$lib/posthog';

try {
  // ... your logic
} catch (error: any) {
  const posthog = getPostHog(platform?.env);
  if (posthog) {
    posthog.capture({
      distinctId: 'server',
      event: 'server_exception',
      properties: {
        error_message: error?.message,
        error_stack: error?.stack,
        endpoint: '/api/auth/login',
        method: 'POST'
      }
    });
  }
}
```

## Privacy Considerations

- **Distinct ID**: For authenticated users, we use `user_{userId}`. For anonymous users, we use the IP address or "anonymous".
- **No Personal Data**: We don't log request bodies, passwords, cookies, or sensitive headers.
- **User Agent**: Browser information is logged for analytics purposes.
- **Client-Side Data**: Only the data you explicitly log is sent to PostHog.

## Performance

- Logging is **asynchronous** and does not block request processing
- On Cloudflare Workers, we use `waitUntil()` to ensure events are flushed without blocking the response
- Failed logging attempts do not affect application functionality
- PostHog client buffers events and batches requests

## Troubleshooting

### Events not appearing in PostHog

1. Verify your API key is correct
2. Check that environment variables are set correctly
3. For Cloudflare Workers, ensure you've redeployed after adding environment variables
4. Check browser console or server logs for any PostHog errors
5. Ensure you're using the correct host URL for your PostHog instance

### Logs not appearing in Logs tab

1. Verify `PUBLIC_POSTHOG_API_KEY` is set for client-side logging
2. Check browser console for PostHog initialization messages
3. Make sure you're calling `logMessage()` or `logException()` from client-side code
4. Verify PostHog client is initialized (check Network tab for PostHog API calls)

### Application errors after adding PostHog

1. Verify the API key format (should start with `phc_`)
2. Check that the POSTHOG_HOST URL is correct and accessible
3. Review server logs for specific error messages
4. Ensure all environment variables are set correctly

## Need Help?

If you encounter any issues:

1. Check the [PostHog documentation](https://posthog.com/docs)
2. Review your PostHog project settings
3. Check the application logs for error messages
4. Open an issue in the GitHub repository
