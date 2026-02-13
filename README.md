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
- **Build Tool**: Vite (Integrated in SvelteKit)
- **Unit/Integration Testing**: Bun Test (Built-in)
- **End-to-End Testing**: Playwright
- **Deployment**: Docker (using oven/bun image)

## Features

- User registration with password hashing (bcrypt)
- User login with session management
- Protected counter page (increment/decrement)
- Session-based authentication
- PostgreSQL database with Drizzle ORM
- Docker deployment with docker-compose

## Screenshots

### Home Page
![Home Page](screenshots/home.png)
*Welcome page with login and registration options*

### Registration Page
![Registration Page](screenshots/register.png)
*User registration form with password confirmation*

### Login Page
![Login Page](screenshots/login.png)
*User login form*

### Counter Page (Protected)
![Counter Page](screenshots/counter.png)
*Protected counter page with increment/decrement functionality - only accessible to authenticated users*

![Counter with Value](screenshots/counter-incremented.png)
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

Copy the example environment file:

```bash
cp .env.example .env
```

Update the `DATABASE_URL` in `.env` if needed:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sveltekit_db
```

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

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Building Docker Image Manually

```bash
# Build the image
docker build -t svelte-bun-app .

# Run the container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host:5432/sveltekit_db \
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

