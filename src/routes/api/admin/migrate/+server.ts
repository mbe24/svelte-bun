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

// GET endpoint to check migration status or show UI
export const GET: RequestHandler = async ({ request, platform }) => {
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

		// Check if request wants JSON (API call) or HTML (browser)
		const acceptHeader = request.headers.get('accept') || '';
		const wantsJson = acceptHeader.includes('application/json');

		if (wantsJson) {
			// Return JSON for API calls
			return json({ 
				migrated: allTablesExist,
				tables: tableNames,
				message: allTablesExist 
					? 'All required tables exist' 
					: 'Some tables are missing. Run POST /api/admin/migrate to create them.'
			});
		} else {
			// Return HTML for browser access
			const migrationSecret = (platform?.env as any)?.MIGRATION_SECRET;
			const requiresAuth = !!migrationSecret;
			
			const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Database Migration Tool</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
			max-width: 600px;
			width: 100%;
			padding: 40px;
		}
		h1 {
			color: #2d3748;
			margin-bottom: 10px;
			font-size: 28px;
		}
		.subtitle {
			color: #718096;
			margin-bottom: 30px;
			font-size: 14px;
		}
		.status {
			padding: 20px;
			border-radius: 8px;
			margin-bottom: 30px;
			border: 2px solid;
		}
		.status.success {
			background: #f0fdf4;
			border-color: #22c55e;
			color: #166534;
		}
		.status.warning {
			background: #fef3c7;
			border-color: #f59e0b;
			color: #92400e;
		}
		.status h2 {
			font-size: 18px;
			margin-bottom: 10px;
		}
		.status p {
			font-size: 14px;
			line-height: 1.6;
		}
		.tables-list {
			margin-top: 10px;
			padding: 10px;
			background: rgba(0,0,0,0.05);
			border-radius: 4px;
			font-family: 'Courier New', monono;
			font-size: 13px;
		}
		button {
			width: 100%;
			padding: 16px;
			font-size: 16px;
			font-weight: 600;
			color: white;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			border: none;
			border-radius: 8px;
			cursor: pointer;
			transition: transform 0.2s, box-shadow 0.2s;
			margin-bottom: 15px;
		}
		button:hover {
			transform: translateY(-2px);
			box-shadow: 0 10px 20px rgba(0,0,0,0.2);
		}
		button:disabled {
			opacity: 0.6;
			cursor: not-allowed;
			transform: none;
		}
		button.secondary {
			background: #e5e7eb;
			color: #374151;
		}
		.auth-input {
			width: 100%;
			padding: 12px;
			border: 2px solid #e5e7eb;
			border-radius: 8px;
			font-size: 14px;
			margin-bottom: 15px;
			display: ${requiresAuth ? 'block' : 'none'};
		}
		.auth-input:focus {
			outline: none;
			border-color: #667eea;
		}
		#result {
			margin-top: 20px;
			padding: 15px;
			border-radius: 8px;
			display: none;
		}
		#result.success {
			background: #f0fdf4;
			border: 2px solid #22c55e;
			color: #166534;
		}
		#result.error {
			background: #fef2f2;
			border: 2px solid #ef4444;
			color: #991b1b;
		}
		.loading {
			display: inline-block;
			width: 16px;
			height: 16px;
			border: 2px solid #ffffff;
			border-top-color: transparent;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
			margin-right: 8px;
			vertical-align: middle;
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		.footer {
			margin-top: 30px;
			padding-top: 20px;
			border-top: 1px solid #e5e7eb;
			font-size: 12px;
			color: #9ca3af;
			text-align: center;
		}
		a {
			color: #667eea;
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🗄️ Database Migration Tool</h1>
		<p class="subtitle">svelte-bun · Cloudflare Pages</p>
		
		<div class="status ${allTablesExist ? 'success' : 'warning'}">
			<h2>${allTablesExist ? '✅ Database Ready' : '⚠️ Migration Required'}</h2>
			<p>${allTablesExist 
				? 'All required database tables exist. Your application is ready to use!' 
				: 'Database tables are missing. Click the button below to create them.'
			}</p>
			${tableNames.length > 0 ? `
				<div class="tables-list">
					<strong>Existing tables:</strong> ${tableNames.join(', ')}
				</div>
			` : '<p style="margin-top: 10px; font-size: 13px;">No tables found in database.</p>'}
		</div>

		${requiresAuth ? '<input type="password" id="authToken" class="auth-input" placeholder="Enter MIGRATION_SECRET">' : ''}
		
		<button id="migrateBtn" onclick="runMigration()" ${allTablesExist ? 'disabled' : ''}>
			${allTablesExist ? '✓ Migration Complete' : '▶ Run Database Migration'}
		</button>
		
		<button class="secondary" onclick="checkStatus()">
			🔄 Refresh Status
		</button>
		
		<div id="result"></div>
		
		<div class="footer">
			Need help? Check the <a href="https://github.com/mbe24/svelte-bun/blob/main/docs/DEPLOY.md" target="_blank">deployment guide</a>
		</div>
	</div>

	<script>
		async function runMigration() {
			const btn = document.getElementById('migrateBtn');
			const result = document.getElementById('result');
			const authToken = document.getElementById('authToken');
			
			btn.disabled = true;
			btn.innerHTML = '<span class="loading"></span>Running migration...';
			result.style.display = 'none';
			
			try {
				const headers = {
					'Content-Type': 'application/json'
				};
				
				if (authToken && authToken.value) {
					headers['Authorization'] = 'Bearer ' + authToken.value;
				}
				
				const response = await fetch('/api/admin/migrate', {
					method: 'POST',
					headers: headers
				});
				
				const data = await response.json();
				
				if (response.ok) {
					result.className = 'success';
					result.innerHTML = '<strong>✅ Success!</strong><br>' + data.message;
					result.style.display = 'block';
					
					// Refresh page after 2 seconds
					setTimeout(() => {
						window.location.reload();
					}, 2000);
				} else {
					throw new Error(data.error || data.details || 'Migration failed');
				}
			} catch (error) {
				result.className = 'error';
				result.innerHTML = '<strong>❌ Error:</strong><br>' + error.message;
				result.style.display = 'block';
				btn.disabled = false;
				btn.innerHTML = '▶ Run Database Migration';
			}
		}
		
		function checkStatus() {
			window.location.reload();
		}
	</script>
</body>
</html>
			`;
			
			return new Response(html, {
				headers: {
					'content-type': 'text/html; charset=utf-8'
				}
			});
		}
	} catch (error: any) {
		console.error('Migration check error:', {
			message: error?.message || String(error),
			code: error?.code
		});
		
		// Check if request wants JSON
		const acceptHeader = request.headers.get('accept') || '';
		const wantsJson = acceptHeader.includes('application/json');
		
		if (wantsJson) {
			return json({ 
				error: 'Failed to check migration status',
				details: error?.message
			}, { status: 500 });
		} else {
			// Return error HTML
			const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Migration Tool - Error</title>
	<style>
		body {
			font-family: system-ui, sans-serif;
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			background: #fef2f2;
			padding: 20px;
		}
		.error-box {
			background: white;
			padding: 40px;
			border-radius: 12px;
			max-width: 500px;
			border: 2px solid #ef4444;
		}
		h1 { color: #991b1b; margin-bottom: 15px; }
		p { color: #7f1d1d; line-height: 1.6; }
	</style>
</head>
<body>
	<div class="error-box">
		<h1>❌ Database Error</h1>
		<p><strong>Error:</strong> ${error?.message || 'Unknown error'}</p>
		<p style="margin-top: 15px;">Make sure DATABASE_URL is configured in Cloudflare Pages environment variables.</p>
	</div>
</body>
</html>
			`;
			
			return new Response(html, {
				status: 500,
				headers: {
					'content-type': 'text/html; charset=utf-8'
				}
			});
		}
	}
};
