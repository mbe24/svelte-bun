import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { db } from '$lib/db';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<string> {
	const sessionId = generateSessionId();
	const expiresAt = new Date(Date.now() + SESSION_DURATION);

	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt
	});

	return sessionId;
}

export async function validateSession(sessionId: string): Promise<number | null> {
	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (!session || session.expiresAt < new Date()) {
		if (session) {
			await db.delete(sessions).where(eq(sessions.id, sessionId));
		}
		return null;
	}

	return session.userId;
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function createUser(username: string, password: string): Promise<number> {
	const hashedPassword = await hashPassword(password);
	
	const [user] = await db
		.insert(users)
		.values({
			username,
			password: hashedPassword
		})
		.returning({ id: users.id });

	return user.id;
}

export async function getUserByUsername(username: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.username, username))
		.limit(1);

	return user;
}
