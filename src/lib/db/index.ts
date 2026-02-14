import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { neonConfig, Pool } from '@neondatabase/serverless';
import * as schema from './schema';

// Detect if running in Cloudflare Workers environment
function isCloudflareWorker(): boolean {
	// @ts-ignore - WebSocketPair is a Cloudflare-specific global
	return typeof globalThis.WebSocketPair !== 'undefined';
}

/**
 * Get or create the database connection
 * @param env - Platform environment (for Cloudflare Workers) or undefined (for Node.js)
 * 
 * When running on Cloudflare Workers/Pages (edge runtime):
 * - Uses Neon serverless driver with HTTP-based connections (no TCP)
 * - Creates a new Pool per request (Neon handles connection pooling server-side)
 * - Neon's serverless driver is optimized for edge functions with sub-50ms cold starts
 * 
 * When running locally (Node.js/Bun):
 * - Uses postgres-js with traditional TCP connections
 * - Connection pooling is handled by postgres-js automatically
 */
export function getDb(env?: { DATABASE_URL?: string }) {
	// For Cloudflare Workers, env will be provided via platform.env
	// For local development, use process.env fallback
	const connectionString = 
		env?.DATABASE_URL || 
		(typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined) ||
		'postgresql://postgres:postgres@localhost:5432/sveltekit_db';

	// Use Neon serverless driver for Cloudflare Workers (HTTP-based)
	// Use postgres-js for local development (TCP-based)
	if (isCloudflareWorker()) {
		// Neon serverless driver for edge runtime
		// Disable WebSocket support as it's not available in Cloudflare Workers
		// This is the recommended way per Neon documentation for edge environments
		if (typeof neonConfig.webSocketConstructor !== 'undefined') {
			neonConfig.webSocketConstructor = undefined as any;
		}
		
		// Create a new Pool per request - Neon handles connection pooling server-side
		// This is the recommended pattern for serverless/edge environments
		const client = new Pool({ connectionString });
		return drizzleNeon(client, { schema });
	} else {
		// Traditional postgres-js for local development
		// Connection pooling is handled by postgres-js automatically
		const client = postgres(connectionString);
		return drizzlePostgres(client, { schema });
	}
}

// Export the db connection for backward compatibility
// Note: This will be null in Cloudflare Workers - always use getDb(env) instead
export const db = null;
