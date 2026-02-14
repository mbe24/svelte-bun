import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getDb } from '$lib/db';

// The SQL migration content
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "counters" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"value" integer DEFAULT 0 NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "counters_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
"id" text PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"expires_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
"id" serial PRIMARY KEY NOT NULL,
"username" text NOT NULL,
"password" text NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "users_username_unique" UNIQUE("username")
);

DO $$ 
BEGIN
IF NOT EXISTS (
SELECT 1 FROM pg_constraint WHERE conname = 'counters_user_id_users_id_fk'
) THEN
ALTER TABLE "counters" ADD CONSTRAINT "counters_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
END IF;
END $$;

DO $$ 
BEGIN
IF NOT EXISTS (
SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk'
) THEN
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
END IF;
END $$;
`;

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		// Simple authentication check - require a secret token
		const authHeader = request.headers.get('authorization');
		const env = platform?.env as { DATABASE_URL?: string; MIGRATION_SECRET?: string } | undefined;
		
		// Check for migration secret (optional, but recommended)
		const migrationSecret = env?.MIGRATION_SECRET;
		if (migrationSecret) {
			if (!authHeader || authHeader !== `Bearer ${migrationSecret}`) {
				return json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		const db = getDb(env);
		
		// Execute the migration SQL as a single statement
		await db.execute(MIGRATION_SQL as any);

		return json({ 
			success: true, 
			message: 'Database migration completed successfully'
		});
	} catch (error: any) {
		console.error('Migration error:', {
			message: error?.message || String(error),
			code: error?.code,
			name: error?.name,
			stack: error?.stack
		});
		return json({ 
			error: 'Migration failed', 
			details: error?.message 
		}, { status: 500 });
	}
};

// GET endpoint to check migration status
export const GET: RequestHandler = async ({ platform }) => {
	try {
		const env = platform?.env as { DATABASE_URL?: string } | undefined;
		const db = getDb(env);
		
		// Check if tables exist
		const result = await db.execute(`
			SELECT table_name 
			FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name IN ('users', 'sessions', 'counters')
			ORDER BY table_name
		` as any);
		
		const tables = (result as any)?.rows || [];
		const tableNames = tables.map((row: any) => row.table_name);
		
		const allTablesExist = tableNames.length === 3 && 
			tableNames.includes('users') && 
			tableNames.includes('sessions') && 
			tableNames.includes('counters');

		return json({ 
			migrated: allTablesExist,
			tables: tableNames,
			message: allTablesExist 
				? 'All required tables exist' 
				: 'Some tables are missing. Run POST /api/admin/migrate to create them.'
		});
	} catch (error: any) {
		console.error('Migration check error:', {
			message: error?.message || String(error),
			code: error?.code
		});
		return json({ 
			error: 'Failed to check migration status',
			details: error?.message
		}, { status: 500 });
	}
};
