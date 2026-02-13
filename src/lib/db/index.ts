import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Fallback for local development - use .env file for actual credentials
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sveltekit_db';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
