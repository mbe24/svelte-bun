import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	// Only allow this test endpoint in development
	if (process.env.NODE_ENV === 'production') {
		throw error(404, 'Not found');
	}
	
	// This endpoint is used to test Sentry error tracking
	throw error(500, 'Test error for Sentry - this is an intentional error to verify error tracking is working correctly');
};
