import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { counters } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const db = getDb(platform?.env);

	const [counter] = await db
		.select()
		.from(counters)
		.where(eq(counters.userId, locals.userId))
		.limit(1);

	if (!counter) {
		// Initialize counter for new user
		const [newCounter] = await db
			.insert(counters)
			.values({ userId: locals.userId, value: 0 })
			.returning();
		return json({ value: newCounter.value });
	}

	return json({ value: counter.value });
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const db = getDb(platform?.env);

	const { action } = await request.json();

	if (action !== 'increment' && action !== 'decrement') {
		return json({ error: 'Invalid action' }, { status: 400 });
	}

	// Get or create counter
	let [counter] = await db
		.select()
		.from(counters)
		.where(eq(counters.userId, locals.userId))
		.limit(1);

	if (!counter) {
		[counter] = await db
			.insert(counters)
			.values({ userId: locals.userId, value: 0 })
			.returning();
	}

	const newValue = action === 'increment' ? counter.value + 1 : counter.value - 1;

	const [updated] = await db
		.update(counters)
		.set({ value: newValue, updatedAt: new Date() })
		.where(eq(counters.userId, locals.userId))
		.returning();

	return json({ value: updated.value });
};
