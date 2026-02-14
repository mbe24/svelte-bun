import type { RequestHandler } from './$types';
import { getUserByUsername, verifyPassword, createSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, platform }) => {
	try {
		const { username, password } = await request.json();

		if (!username || !password) {
			return json({ error: 'Username and password are required' }, { status: 400 });
		}

		const env = platform?.env as { DATABASE_URL?: string } | undefined;
		const user = await getUserByUsername(username, env);

		if (!user) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const valid = await verifyPassword(password, user.password);

		if (!valid) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const sessionId = await createSession(user.id, env);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({ success: true });
	} catch (error: any) {
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
