import type { RequestHandler } from './$types';
import { createUser, createSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
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

		const userId = await createUser(username, password);
		const sessionId = await createSession(userId);

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
		console.error('Registration error:', error);
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};
