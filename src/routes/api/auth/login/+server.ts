import type { RequestHandler } from './$types';
import { getUserByUsername, verifyPassword, createSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { username, password } = await request.json();

		if (!username || !password) {
			return json({ error: 'Username and password are required' }, { status: 400 });
		}

		const user = await getUserByUsername(username);

		if (!user) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const valid = await verifyPassword(password, user.password);

		if (!valid) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const sessionId = await createSession(user.id);

		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({ success: true });
	} catch (error) {
		console.error('Login error:', error);
		return json({ error: 'Login failed' }, { status: 500 });
	}
};
