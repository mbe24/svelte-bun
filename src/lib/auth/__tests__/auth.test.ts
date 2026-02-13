import { describe, test, expect } from 'bun:test';
import { hashPassword, verifyPassword, generateSessionId } from '../index';

describe('Authentication utilities', () => {
	describe('Password hashing', () => {
		test('should hash password', async () => {
			const password = 'mySecurePassword123';
			const hash = await hashPassword(password);
			
			expect(hash).toBeDefined();
			expect(hash).not.toBe(password);
			expect(hash.length).toBeGreaterThan(0);
		});

		test('should verify correct password', async () => {
			const password = 'mySecurePassword123';
			const hash = await hashPassword(password);
			
			const isValid = await verifyPassword(password, hash);
			expect(isValid).toBe(true);
		});

		test('should reject incorrect password', async () => {
			const password = 'mySecurePassword123';
			const wrongPassword = 'wrongPassword';
			const hash = await hashPassword(password);
			
			const isValid = await verifyPassword(wrongPassword, hash);
			expect(isValid).toBe(false);
		});

		test('should generate different hashes for same password', async () => {
			const password = 'mySecurePassword123';
			const hash1 = await hashPassword(password);
			const hash2 = await hashPassword(password);
			
			expect(hash1).not.toBe(hash2);
		});
	});

	describe('Session ID generation', () => {
		test('should generate session ID', () => {
			const sessionId = generateSessionId();
			
			expect(sessionId).toBeDefined();
			expect(sessionId.length).toBe(64); // 32 bytes = 64 hex characters
		});

		test('should generate unique session IDs', () => {
			const sessionId1 = generateSessionId();
			const sessionId2 = generateSessionId();
			
			expect(sessionId1).not.toBe(sessionId2);
		});

		test('should generate hex string', () => {
			const sessionId = generateSessionId();
			
			expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
		});
	});
});
