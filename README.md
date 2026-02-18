# svelte-bun

[![CI](https://github.com/mbe24/svelte-bun/actions/workflows/ci.yml/badge.svg)](https://github.com/mbe24/svelte-bun/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A full-stack web application built with SvelteKit and Bun, featuring user authentication and a simple counter functionality.

## What is this?

**svelte-bun** is a modern full-stack web application that demonstrates best practices for building web apps with cutting-edge technologies. It showcases:

- **Fast Development**: Uses Bun as both runtime and package manager for blazing-fast performance
- **Type-Safe**: Full TypeScript support throughout the stack
- **Modern Framework**: Built with SvelteKit, providing excellent developer experience and performance
- **Database Integration**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Secure user authentication with bcrypt password hashing and session management
- **Production Ready**: Includes Docker deployment configuration and comprehensive testing

This project serves as a reference implementation for building modern web applications and can be used as a starting point for new projects.

## Tech Stack

- **Runtime & Package Manager**: Bun
- **Fullstack Framework**: SvelteKit
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit
- **Database Drivers**: 
  - `@neondatabase/serverless` (for Cloudflare Workers/Pages)
  - `postgres` (for local development)
- **Build Tool**: Vite (Integrated in SvelteKit)
- **Unit/Integration Testing**: Bun Test (Built-in)
- **End-to-End Testing**: Playwright
- **Analytics**: PostHog (optional, for HTTP request logging)
- **Deployment**: Docker, Cloudflare Pages

## Features

- User registration with password hashing (bcryptjs)
- User login with session management
- Protected counter page (increment/decrement)
- **Rate limiting for counter actions** (3 actions per 10 seconds using Upstash Redis)
- Session-based authentication
- PostgreSQL database with Drizzle ORM
- Automatic runtime detection for database drivers
- Edge-compatible deployment (Cloudflare Pages)
- Docker deployment with docker-compose
- PostHog analytics integration (optional):
  - HTTP request logging
  - Exception tracking (client & server)
  - Custom logs and event tracking
  - Page view tracking
  - User identification

## Screenshots

### Home Page
![Home Page](docs/images/home.png)
*Welcome page with login and registration options*

### Registration Page
![Registration Page](docs/images/register.png)
*User registration form with password confirmation*

### Login Page
![Login Page](docs/images/login.png)
*User login form*

### Counter Page (Protected)
![Counter Page](docs/images/counter.png)
*Protected counter page with increment/decrement functionality - only accessible to authenticated users*

![Counter with Value](docs/images/counter-incremented.png)
*Counter after incrementing the value*

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0 (or Node.js >= 18.0.0)
- [PostgreSQL](https://www.postgresql.org/) >= 14
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mbe24/svelte-bun.git
cd svelte-bun
```

### 2. Install dependencies

```bash
bun install
# or
npm install
```

### 3. Set up environment variables

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit the `.env` file and update the credentials (use secure passwords in production):

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=sveltekit_db
DATABASE_URL=postgresql://postgres:your_secure_password_here@localhost:5432/sveltekit_db
```

**Optional: PostHog Analytics**

To enable analytics, logging, and exception tracking with PostHog:

1. Sign up for a free account at [posthog.com](https://posthog.com/) or use a self-hosted instance
2. Get your Project API Key from PostHog project settings
3. Add to your `.env` file:

```bash
# PostHog tracking (both server and client-side)
# PostHog API keys are safe to expose publicly - they're designed for browser use
POSTHOG_API_KEY=your_posthog_api_key_here

# PostHog Events API Host (for HTTP requests, page views, custom events)
# US: https://app.posthog.com or https://us.posthog.com
# EU: https://eu.posthog.com
POSTHOG_HOST=https://app.posthog.com

# PostHog OTLP Logs API Host (for logs, exceptions, telemetry) - OPTIONAL
# If not set, automatically derived from POSTHOG_HOST
# US: https://us.i.posthog.com
# EU: https://eu.i.posthog.com
# POSTHOG_OTLP_HOST=https://us.i.posthog.com
```

**Note:** The `POSTHOG_OTLP_HOST` is optional. If not provided, it will be automatically derived from `POSTHOG_HOST` (e.g., `app.posthog.com` maps to `us.i.posthog.com`).

This enables:
- HTTP request logging (server-side, Events tab)
- Exception tracking (client & server, Logs tab)
- Custom logs with `logMessage()` and `logException()` (Logs tab)
- Page view tracking (Events tab)
- User identification
- Database & API latency tracking (Logs tab)
- Security & auth event tracking (Logs tab)

For Cloudflare Workers deployment, add these variables in your Cloudflare Pages environment settings.

See [docs/POSTHOG_SETUP.md](docs/POSTHOG_SETUP.md) for complete setup instructions and usage examples.

**Optional: Upstash Redis Rate Limiting**

To enable rate limiting for counter actions (3 actions per 10 seconds):

1. Sign up for a free account at [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Get your REST URL and REST token
4. Add to your `.env` file:

```bash
# Upstash Redis for rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_secret_token_here
```

For Cloudflare Pages deployment:
- Add `UPSTASH_REDIS_REST_TOKEN` to Cloudflare Pages environment variables
- Update `UPSTASH_REDIS_REST_URL` in `wrangler.toml`

See [docs/UPSTASH_REDIS_SETUP.md](docs/UPSTASH_REDIS_SETUP.md) for complete setup instructions.

**Note:** If Upstash Redis is not configured, the application will work normally without rate limiting.

⚠️ **Security Note:** Never commit the `.env` file to version control. It contains sensitive credentials and is already excluded via `.gitignore`.

For more details on security configuration, see [docs/SECURITY.md](docs/SECURITY.md).

### 4. Set up the database

Make sure PostgreSQL is running, then generate and run migrations:

```bash
# Generate migrations from schema
bun run db:generate

# Run migrations
bun run db:push
```

### 5. Run the development server

```bash
bun run dev
# or
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

- `bun run dev` - Start the development server
- `bun run build` - Build the application for production
- `bun run preview` - Preview the production build
- `bun run check` - Run TypeScript and Svelte checks
- `bun run db:generate` - Generate Drizzle migrations
- `bun run db:push` - Push schema changes to the database
- `bun run db:studio` - Open Drizzle Studio (database GUI)
- `bun test` - Run unit tests

## Deployment

### Cloudflare Pages Deployment

This application is optimized for deployment on Cloudflare Pages with automatic edge runtime compatibility.

**Key Features:**
- Automatic database driver selection (Neon serverless for edge, postgres-js for local)
- HTTP-based database connections for Cloudflare Workers
- No TCP sockets required

**Prerequisites:**
- ⚠️ **Required**: A Neon PostgreSQL database ([neon.tech](https://neon.tech/) - free tier available)
- ⚠️ **Required**: DATABASE_URL configured in Cloudflare Pages environment variables
- ⚠️ **Required**: Database migrations must be run to create tables

**Quick Start:**
1. Create a free [Neon](https://neon.tech/) PostgreSQL database
2. Get your connection string from Neon dashboard
3. Follow the detailed guide in [docs/DEPLOY.md](docs/DEPLOY.md)
4. **Critical**: Add `DATABASE_URL` to Cloudflare Pages Settings → Environment variables (both Production and Preview)
5. Push to GitHub - automatic deployment via GitHub Actions
6. **⭐ Run migrations** by visiting this URL in your browser:
   ```
   https://your-app.pages.dev/api/admin/migrate
   ```
   Click the "Run Database Migration" button - that's it!
   
   Alternative methods:
   - **curl**: `curl -X POST https://your-app.pages.dev/api/admin/migrate`
   - **Local**: Run `npm run db:push` with DATABASE_URL set
   - See [docs/DEPLOY.md](docs/DEPLOY.md) for all migration methods

⚠️ **Important**: 
- Without DATABASE_URL configured, user registration and login will fail with a database configuration error.
- Without running migrations, you'll get "relation 'users' does not exist" errors.
- **Just visit `/api/admin/migrate` in your browser and click the button to fix this!**

See [docs/DEPLOY.md](docs/DEPLOY.md) for complete step-by-step instructions, including separate database setup for preview/production environments.

## Docker Deployment

### Using Docker Compose (Recommended)

**Important:** Before running Docker Compose, create a `.env` file with your credentials:

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

Make sure your `.env` file includes:
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=sveltekit_db
DATABASE_URL=postgresql://postgres:your_secure_password_here@db:5432/sveltekit_db
```

Note: Use `@db:5432` (not `@localhost:5432`) in `DATABASE_URL` for Docker Compose.

Then start the services:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at [http://localhost:3000](http://localhost:3000).

For more details on security configuration, see [docs/SECURITY.md](docs/SECURITY.md).

### Building Docker Image Manually

```bash
# Build the image
docker build -t svelte-bun-app .

# Run the container (replace with your actual credentials)
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://username:password@host:5432/sveltekit_db \
  svelte-bun-app
```

## Project Structure

```
svelte-bun/
├── src/
│   ├── lib/
│   │   ├── auth/         # Authentication utilities
│   │   └── db/           # Database schema and connection
│   ├── routes/
│   │   ├── api/          # API endpoints
│   │   │   ├── auth/     # Authentication endpoints
│   │   │   └── counter/  # Counter endpoints
│   │   ├── login/        # Login page
│   │   ├── register/     # Registration page
│   │   ├── counter/      # Counter page (protected)
│   │   └── +page.svelte  # Home page
│   ├── app.d.ts          # TypeScript definitions
│   ├── app.html          # HTML template
│   └── hooks.server.ts   # Server hooks for authentication
├── drizzle/              # Database migrations
├── drizzle.config.ts     # Drizzle configuration
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Docker image configuration
└── package.json          # Project dependencies

```

## Database Schema

### Users Table
- `id` (serial, primary key)
- `username` (text, unique, not null)
- `password` (text, not null) - bcrypt hashed
- `created_at` (timestamp, default now)

### Sessions Table
- `id` (text, primary key)
- `user_id` (integer, foreign key to users)
- `expires_at` (timestamp, not null)

### Counters Table
- `id` (serial, primary key)
- `user_id` (integer, foreign key to users, unique)
- `value` (integer, default 0)
- `updated_at` (timestamp, default now)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with username and password
- `POST /api/auth/logout` - Logout and delete session

### Counter
- `GET /api/counter` - Get current counter value (requires authentication)
- `POST /api/counter` - Increment or decrement counter (requires authentication)
  - Body: `{ "action": "increment" | "decrement" }`

## Analytics and Monitoring

### OpenTelemetry Distributed Tracing

This application implements comprehensive distributed tracing using OpenTelemetry, exporting traces to PostHog via OTLP (OpenTelemetry Protocol). Every incoming request produces a root span with child spans for database operations, external API calls, and rate limiting checks.

**Features:**
- **Full Request Tracing**: Every HTTP request creates a root span with method and route information
- **Database Tracing**: All database queries are automatically traced with operation type and table info
- **Upstash Redis Tracing**: Rate limiting calls to Upstash are traced as child spans
- **Trace Context Propagation**: W3C traceparent headers are extracted from incoming requests and injected into outgoing calls
- **X-Trace-Id Header**: Every response includes an `X-Trace-Id` header for log correlation
- **Sampling**: Error requests are always traced; successful requests use configurable sampling (default 10%)
- **PII Protection**: User IDs are hashed before being stored in spans

**Configuration:**

Add these variables to your `.env` file (all optional):

```bash
# Tracing Sample Rate for Successful Requests (0.0 to 1.0)
# Error requests are ALWAYS traced regardless of this setting
# Default: 0.1 (10% of successful requests)
TRACE_SUCCESS_SAMPLE_RATE=0.1

# Service Name (for identifying your service in traces)
# Default: svelte-bun
SERVICE_NAME=svelte-bun

# Application Release Version (useful for deployment correlation)
# Default: unknown
APP_RELEASE=v1.0.0

# Trace Exporter Type
# Options: otlp (default, exports to PostHog), memory (for tests), console (for debugging)
# Default: otlp
TRACE_EXPORTER=otlp

# Additional OTLP Headers (JSON format) - rarely needed
# The POSTHOG_API_KEY is automatically used as Authorization Bearer token
# OTLP_HEADERS={"X-Custom-Header":"value"}
```

**For Cloudflare Pages Deployment:**

1. Go to your Cloudflare Pages project → Settings → Environment variables
2. Add the following variables (for both Production and Preview):
   - `POSTHOG_API_KEY`: Your PostHog API key (required for tracing)
   - `POSTHOG_HOST`: Your PostHog host (e.g., `https://app.posthog.com` or `https://eu.posthog.com`)
   - `TRACE_SUCCESS_SAMPLE_RATE`: Sample rate for successful requests (e.g., `0.1` for 10%)
   - `SERVICE_NAME`: Your service name (e.g., `svelte-bun-production`)
   - `APP_RELEASE`: Your release version (e.g., `v1.0.0`)

3. Ensure your Cloudflare Worker has egress access to PostHog OTLP endpoint:
   - US: `https://us.i.posthog.com`
   - EU: `https://eu.i.posthog.com`
   
   (Cloudflare Workers have unrestricted egress by default unless you've configured restrictions)

**📋 Quick Setup Checklist:** See [docs/EXTERNAL_ACTIONS_REQUIRED.md](docs/EXTERNAL_ACTIONS_REQUIRED.md) for a complete step-by-step guide to external configuration.

**📚 Detailed Setup Guide:** See [docs/TRACING_SETUP.md](docs/TRACING_SETUP.md) for comprehensive configuration instructions, troubleshooting, and PostHog setup.

**Viewing Traces in PostHog:**

1. Log in to your PostHog account at [app.posthog.com](https://app.posthog.com/) or your self-hosted instance
2. Navigate to **Activity → Traces** (or **Data Management → Traces** depending on your PostHog version)
3. You'll see all incoming HTTP requests as root spans
4. Click on any trace to see the full span hierarchy:
   - Root span: `HTTP POST /api/auth/login`
   - Child spans: `db.query.users` (database operations)
   - Child spans: `ratelimit.check` (rate limiting)
   - Duration, status codes, and error information

**Using X-Trace-Id for Log Correlation:**

Every API response includes an `X-Trace-Id` header containing the OpenTelemetry trace ID:

```bash
curl -i https://your-app.pages.dev/api/auth/login
# Response headers include:
# X-Trace-Id: 4bf92f3577b34da6a3ce929d0e0e4736
```

Use this trace ID to:
- Search for related logs in PostHog
- Correlate frontend errors with backend traces
- Debug production issues by finding the exact request trace

**For Testing and Development:**

When running tests, use the memory exporter to collect spans in-memory:

```bash
TRACE_EXPORTER=memory npm test
```

This is automatically configured in CI environments to avoid external dependencies during testing.

### PostHog HTTP Request Logging

When configured, the application automatically logs all HTTP requests to PostHog with the following information:

- **Request Method**: GET, POST, etc.
- **Request Path**: The URL path accessed
- **Status Code**: HTTP response status (200, 404, etc.)
- **Response Time**: Duration of the request in milliseconds
- **User Agent**: Browser/client information
- **Referer**: Source of the request
- **Authentication Status**: Whether the request was authenticated
- **User ID**: The ID of the authenticated user (if logged in)

**Logs & Exceptions:**
- **Exception Logging**: Both client and server exceptions are logged using OpenTelemetry Protocol (OTLP) format
- **Custom Logs**: Use `logMessage()` and `logException()` functions to send logs via OTLP
- **Logs Tab**: OTLP logs appear in PostHog's Logs tab (not Events tab)
- **Events Tab**: HTTP requests and page views appear in Events tab
- **OTLP Endpoint**: Automatically maps your POSTHOG_HOST to the correct OTLP ingestion endpoint (`https://app.posthog.com` → `https://us.i.posthog.com/i/v1/logs`, `https://eu.posthog.com` → `https://eu.i.posthog.com/i/v1/logs`)

**Configuration:**
- Set `POSTHOG_API_KEY` and optionally `POSTHOG_HOST` in your environment variables
- If these variables are not set, the application works normally without logging
- Logging is performed asynchronously and does not affect request performance
- Errors in logging are caught and logged to console without breaking requests

**Event Format (HTTP Requests):**
```javascript
{
  distinctId: "user_123" or "ip_address" or "anonymous",
  event: "http_request",
  properties: {
    method: "GET",
    path: "/api/counter",
    status: 200,
    duration_ms: 45,
    user_agent: "Mozilla/5.0...",
    authenticated: true,
    user_id: 123
  }
}
```

**OTLP Log Format (Exceptions & Custom Logs):**
Sent to PostHog's `/i/v1/logs` endpoint with Authorization header containing the API key.

## Testing

### Unit Tests (Bun Test)

```bash
bun test
```

### End-to-End Tests (Playwright)

```bash
# Install Playwright browsers
bunx playwright install

# Run E2E tests
bun run test:e2e
```

## Security Features

- Password hashing with bcrypt
- HTTP-only session cookies
- Session expiration (7 days)
- SQL injection protection (Drizzle ORM)
- CSRF protection (SvelteKit built-in)
- Environment variable-based configuration (no hardcoded credentials)

For detailed information about security configuration:
- **Local Development & Docker**: See [docs/SECURITY.md](docs/SECURITY.md)
- **GitHub Actions CI/CD**: See [docs/GITHUB_SECRETS.md](docs/GITHUB_SECRETS.md)

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running and accessible
- Verify `DATABASE_URL` in your `.env` file is correct
- Check that the database `sveltekit_db` exists

### Port Already in Use
- If port 5173 (dev) or 3000 (production) is already in use, you can modify the port in `vite.config.ts` or use the `--port` flag:
  ```bash
  bun run dev -- --port 3001
  ```

### Docker Issues
- If Docker build fails, ensure you have a stable internet connection for package installation
- Try cleaning Docker cache: `docker system prune -a`
- Make sure Docker has enough resources allocated (memory/disk space)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Apache License 2.0

