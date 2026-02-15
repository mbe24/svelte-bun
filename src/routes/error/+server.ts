import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// This endpoint is used to test Sentry error tracking
	throw error(500, 'Test error for Sentry - this is an intentional error to verify error tracking is working correctly');
};
