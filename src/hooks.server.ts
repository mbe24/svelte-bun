import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const userId = await validateSession(sessionId);
		if (userId) {
			event.locals.userId = userId;
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};
