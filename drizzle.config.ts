import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		// Fallback for local development - use .env file for actual credentials
		url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sveltekit_db'
	}
});
