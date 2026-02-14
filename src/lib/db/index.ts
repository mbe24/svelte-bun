import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection is initialized lazily per request in Cloudflare Workers
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Get or create the database connection
 * @param env - Platform environment (for Cloudflare Workers) or undefined (for Node.js)
 */
export function getDb(env?: { DATABASE_URL?: string }) {
	// For Cloudflare Workers, env will be provided via platform.env
	// For local development, use process.env fallback
	const connectionString = 
		env?.DATABASE_URL || 
		(typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ||
		'postgresql://postgres:postgres@localhost:5432/sveltekit_db';

	// Return existing connection if available
	if (_db && _client) {
		return _db;
	}

	// Create new connection
	_client = postgres(connectionString);
	_db = drizzle(_client, { schema });
	
	return _db;
}

// For backward compatibility with existing code in local development
// This will only work in Node.js environments, not in Cloudflare Workers
export const db = typeof process !== 'undefined' ? getDb() : null as any;
