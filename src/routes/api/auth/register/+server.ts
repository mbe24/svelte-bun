import type { RequestHandler } from './$types';
import { createUser, createSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	try {
		const { username, password } = await request.json();

		if (!username || !password) {
			return json({ error: 'Username and password are required' }, { status: 400 });
		}

		if (username.length < 3) {
			return json({ error: 'Username must be at least 3 characters' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
		}

		const env = platform?.env as { DATABASE_URL?: string } | undefined;
		const userId = await createUser(username, password, env);
		const sessionId = await createSession(userId, env);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({ success: true });
	} catch (error: any) {
		if (error?.code === '23505') {
			return json({ error: 'Username already exists' }, { status: 409 });
		}
		// Log error details for debugging
		console.error('Registration error:', {
			message: error?.message || String(error),
			code: error?.code,
			name: error?.name,
			stack: error?.stack
		});
		
		// Provide helpful error message for missing DATABASE_URL
		if (error?.message?.includes('DATABASE_URL')) {
			return json({ 
				error: 'Database configuration error. Please contact the administrator.' 
			}, { status: 500 });
		}
		
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};
