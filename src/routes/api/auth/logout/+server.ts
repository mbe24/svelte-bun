import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/auth';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies, platform }) => {
	try {
		const sessionId = cookies.get('session');

		if (sessionId) {
			const env = platform?.env as { DATABASE_URL?: string } | undefined;
			await deleteSession(sessionId, env);
		}

		cookies.delete('session', { path: '/' });

		return json({ success: true });
	} catch (error: any) {
		// Log error details for debugging
		console.error('Logout error:', {
			message: error?.message || String(error),
			code: error?.code,
			name: error?.name
		});
		// Still delete the cookie and return success even if DB deletion fails
		cookies.delete('session', { path: '/' });
		return json({ success: true });
	}
};
