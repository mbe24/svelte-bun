import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { counters } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { wrapDatabaseQuery } from '$lib/telemetry';
import { checkRateLimit } from '$lib/rate-limit';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// TypeScript narrowing: userId is guaranteed to be defined after the check
	const userId = locals.userId;
	const db = getDb(platform?.env);

	// Wrap database query with telemetry logging
	const [counter] = await wrapDatabaseQuery(
		() => db
			.select()
			.from(counters)
			.where(eq(counters.userId, userId))
			.limit(1),
		'counters',
		'SELECT',
		{
			userId,
			sessionId: locals.telemetryContext?.sessionId,
			distinctId: locals.telemetryContext?.distinctId
		},
		platform?.env
	);

	if (!counter) {
		// Initialize counter for new user
		const [newCounter] = await wrapDatabaseQuery(
			() => db
				.insert(counters)
				.values({ userId, value: 0 })
				.returning(),
			'counters',
			'INSERT',
			{
				userId,
				sessionId: locals.telemetryContext?.sessionId,
				distinctId: locals.telemetryContext?.distinctId
			},
			platform?.env
		);
		return json({ value: newCounter.value });
	}

	return json({ value: counter.value });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// TypeScript narrowing: userId is guaranteed to be defined after the check
	const userId = locals.userId;

	// Check rate limit before processing the request
	const rateLimitResult = await checkRateLimit(userId, platform?.env);
	if (!rateLimitResult.success) {
		return json(
			{
				error: 'Rate limit exceeded',
				message: 'Too many actions. Please wait before trying again.',
				reset: rateLimitResult.reset,
				remaining: rateLimitResult.remaining
			},
			{ status: 429 }
		);
	}

	const db = getDb(platform?.env);

	const { action } = await request.json();

	if (action !== 'increment' && action !== 'decrement') {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	const telemetryContext = {
		userId,
		sessionId: locals.telemetryContext?.sessionId,
		distinctId: locals.telemetryContext?.distinctId
	};

	// Get or create counter with telemetry
	let [counter] = await wrapDatabaseQuery(
		() => db
			.select()
			.from(counters)
			.where(eq(counters.userId, userId))
			.limit(1),
		'counters',
		'SELECT',
		telemetryContext,
		platform?.env
	);

	if (!counter) {
		[counter] = await wrapDatabaseQuery(
			() => db
				.insert(counters)
				.values({ userId, value: 0 })
				.returning(),
			'counters',
			'INSERT',
			telemetryContext,
			platform?.env
		);
	}

	const newValue = action === 'increment' ? counter.value + 1 : counter.value - 1;

	const [updated] = await wrapDatabaseQuery(
		() => db
			.update(counters)
			.set({ value: newValue, updatedAt: new Date() })
			.where(eq(counters.userId, userId))
			.returning(),
		'counters',
		'UPDATE',
		telemetryContext,
		platform?.env
	);

	return json({ value: updated.value });
};
