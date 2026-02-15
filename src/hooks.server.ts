import type { Handle } from '@sveltejs/kit';
import { validateSession } from '$lib/auth';
import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: "https://73abdd8a2b51bce475eb529f11fae4c3@o4510888874147840.ingest.de.sentry.io/4510888888238160",
});

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		// Pass platform.env for Cloudflare Workers compatibility
		const env = event.platform?.env as { DATABASE_URL?: string } | undefined;
		const userId = await validateSession(sessionId, env);
		if (userId) {
			event.locals.userId = userId;
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};
