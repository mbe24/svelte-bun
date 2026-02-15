import type { RequestHandler } from './$types';
import { getUserByUsername, verifyPassword, createSession } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { logServerException } from '$lib/posthog-otlp';
import { logAuthEvent } from '$lib/telemetry';

export const POST: RequestHandler = async ({ request, cookies, platform, getClientAddress, locals }) => {
	const startTime = Date.now();
	let username: string | undefined;
	
	try {
		const body = await request.json();
		username = body.username;
		const password = body.password;

		if (!username || !password) {
			// Log failed login attempt due to missing credentials
			await logAuthEvent('login_failure', {
				distinctId: locals.telemetryContext?.distinctId,
				ipAddress: getClientAddress(),
				userAgent: request.headers.get('user-agent') || undefined,
				success: false,
				errorMessage: 'Missing credentials',
				metadata: { username: username || 'not_provided' }
			}, platform?.env);
			
			return json({ error: 'Username and password are required' }, { status: 400 });
		}

		const env = platform?.env as { DATABASE_URL?: string } | undefined;
		const user = await getUserByUsername(username, env);

		if (!user) {
			// Log failed login attempt due to invalid username
			await logAuthEvent('login_failure', {
				distinctId: locals.telemetryContext?.distinctId,
				ipAddress: getClientAddress(),
				userAgent: request.headers.get('user-agent') || undefined,
				success: false,
				errorMessage: 'Invalid username',
				metadata: { username }
			}, platform?.env);
			
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const valid = await verifyPassword(password, user.password);

		if (!valid) {
			// Log failed login attempt due to invalid password
			await logAuthEvent('login_failure', {
				userId: user.id,
				distinctId: `user_${user.id}`,
				ipAddress: getClientAddress(),
				userAgent: request.headers.get('user-agent') || undefined,
				success: false,
				errorMessage: 'Invalid password',
				metadata: { username }
			}, platform?.env);
			
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const sessionId = await createSession(user.id, env);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		// Log successful login
		await logAuthEvent('login', {
			userId: user.id,
			sessionId,
			distinctId: `user_${user.id}`,
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent') || undefined,
			success: true,
			metadata: { 
				username,
				login_duration_ms: String(Date.now() - startTime)
			}
		}, platform?.env);

		return json({ success: true });
	} catch (error: any) {
		// Log error to PostHog using OTLP
		await logServerException(
			error instanceof Error ? error : new Error(String(error)),
			{
				endpoint: '/api/auth/login',
				method: 'POST',
				error_code: error?.code || 'UNKNOWN',
			},
			platform?.env
		);

		// Log failed login due to system error
		await logAuthEvent('login_failure', {
			distinctId: locals.telemetryContext?.distinctId,
			ipAddress: getClientAddress(),
			userAgent: request.headers.get('user-agent') || undefined,
			success: false,
			errorMessage: error?.message || String(error),
			metadata: { username: username || 'unknown', error_type: 'system_error' }
		}, platform?.env);

		// Log error details for debugging
		console.error('Login error:', {
			message: error?.message || String(error),
			code: error?.code,
			name: error?.name,
			stack: error?.stack
		});
		return json({ error: 'Login failed' }, { status: 500 });
	}
};
