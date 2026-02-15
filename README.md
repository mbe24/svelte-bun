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
POSTHOG_HOST=https://app.posthog.com
```

This enables:
- HTTP request logging (server-side)
- Exception tracking (client & server)
- Custom logs with `logMessage()` and `logException()`
- Page view tracking
- User identification

For Cloudflare Workers deployment, add these variables in your Cloudflare Pages environment settings.

See [docs/POSTHOG_SETUP.md](docs/POSTHOG_SETUP.md) for complete setup instructions and usage examples.

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
Sent to PostHog's `/v1/logs` endpoint with Authorization header containing the API key.

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

