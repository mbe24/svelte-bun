import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies, platform }) => {
	const sessionId = cookies.get('session');

	if (sessionId) {
		const env = platform?.env as { DATABASE_URL?: string } | undefined;
		await deleteSession(sessionId, env);
	}

	cookies.delete('session', { path: '/' });

	return json({ success: true });
};
