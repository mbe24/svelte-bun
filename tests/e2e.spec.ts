import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
	const testUsername = `testuser_${Date.now()}`;
	const testPassword = 'testpass123';

	test('should register a new user and access counter', async ({ page }) => {
		// Visit home page
		await page.goto('http://localhost:5173');
		await expect(page.locator('h1')).toContainText('Welcome to SvelteKit');

		// Click register link
		await page.click('a[href="/register"]');
		await expect(page.locator('h1')).toContainText('Register');

		// Fill registration form
		await page.fill('#username', testUsername);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);

		// Submit registration
		await page.click('button[type="submit"]');

		// Should redirect to counter page
		await page.waitForURL('**/counter');
		await expect(page.locator('h1')).toContainText('Counter App');

		// Counter should be initialized to 0
		await expect(page.locator('.counter-display')).toContainText('0');
	});

	test('should increment and decrement counter', async ({ page }) => {
		// Register and login first
		await page.goto('http://localhost:5173/register');
		const username = `testuser_${Date.now()}`;
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		await page.click('button[type="submit"]');

		await page.waitForURL('**/counter');

		// Increment counter
		await page.click('.counter-button.increment');
		await expect(page.locator('.counter-display')).toContainText('1');

		// Increment again
		await page.click('.counter-button.increment');
		await expect(page.locator('.counter-display')).toContainText('2');

		// Decrement counter
		await page.click('.counter-button.decrement');
		await expect(page.locator('.counter-display')).toContainText('1');
	});

	test('should login existing user', async ({ page }) => {
		// First register a user
		await page.goto('http://localhost:5173/register');
		const username = `testuser_${Date.now()}`;
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/counter');

		// Wait for logout button to be visible (counter page loads first)
		await page.waitForSelector('.logout-button', { state: 'visible' });

		// Logout
		await page.click('.logout-button');
		await page.waitForURL('http://localhost:5173/');

		// Login
		await page.click('a[href="/login"]');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.click('button[type="submit"]');

		await page.waitForURL('**/counter');
		await expect(page.locator('h1')).toContainText('Counter App');
	});

	test('should show error for invalid login', async ({ page }) => {
		await page.goto('http://localhost:5173/login');

		await page.fill('#username', 'nonexistent');
		await page.fill('#password', 'wrongpass');
		await page.click('button[type="submit"]');

		// Wait for error message to appear (async login request)
		await page.waitForSelector('.error', { state: 'visible' });
		await expect(page.locator('.error')).toContainText('Invalid credentials');
	});

	test('should show error for duplicate username', async ({ page }) => {
		// Register first user
		const username = `testuser_${Date.now()}`;
		await page.goto('http://localhost:5173/register');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/counter');

		// Wait for logout button to be visible before clicking
		await page.waitForSelector('.logout-button', { state: 'visible' });

		// Logout
		await page.click('.logout-button');
		await page.waitForURL('http://localhost:5173/');

		// Try to register with same username
		await page.goto('http://localhost:5173/register');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		await page.click('button[type="submit"]');

		// Wait for error message to appear (async registration request)
		await page.waitForSelector('.error', { state: 'visible' });
		await expect(page.locator('.error')).toContainText('Username already exists');
	});
});
