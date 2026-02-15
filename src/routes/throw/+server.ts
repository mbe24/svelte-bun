import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// This endpoint throws an uncaught exception to test Sentry error tracking
	// Unlike /error which uses SvelteKit's error(), this throws a raw JavaScript error
	throw new Error('Test uncaught exception for Sentry - this is an intentional error to verify error tracking is working correctly');
};
