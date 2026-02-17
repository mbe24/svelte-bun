import { test, expect } from '@playwright/test';

// Timeout constants for async operations
const API_RESPONSE_TIMEOUT = 35000; // 35s for slow API calls (telemetry, database)
const ERROR_VISIBILITY_TIMEOUT = 5000; // 5s for error message to appear
const PAGE_LOAD_TIMEOUT = 10000; // 10s for page content to load

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

		// Submit registration and wait for navigation
		const responsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /register/i }).click();
		const response = await responsePromise;
		
		// Should get success response
		expect(response.status()).toBe(200);

		// Wait for counter page element (more reliable than URL)
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: PAGE_LOAD_TIMEOUT });
		await expect(page.locator('.counter-display')).toBeVisible();
		
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
		
		const responsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /register/i }).click();
		await responsePromise;

		// Wait for counter page
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: PAGE_LOAD_TIMEOUT });

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
		
		const registerResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /register/i }).click();
		await registerResponsePromise;

		// Wait for counter page and logout button
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: PAGE_LOAD_TIMEOUT });
		await expect(page.locator('.logout-button')).toBeVisible();

		// Logout
		await page.click('.logout-button');
		await expect(page.locator('h1')).toContainText('Welcome to SvelteKit', { timeout: PAGE_LOAD_TIMEOUT });

		// Login
		await page.click('a[href="/login"]');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		
		const loginResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /^login$/i }).click();
		const loginResponse = await loginResponsePromise;
		
		// Should get success response
		expect(loginResponse.status()).toBe(200);
		
		// Wait for counter page
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: PAGE_LOAD_TIMEOUT });
	});

	test('should show error for invalid login', async ({ page }) => {
		await page.goto('http://localhost:5173/login');

		await page.fill('#username', 'nonexistent');
		await page.fill('#password', 'wrongpass');
		
		// Wait for the API response
		const responsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /^login$/i }).click();
		const response = await responsePromise;
		
		// Should get error response
		expect(response.status()).toBe(401);

		// Assert error UI appears (not success UI)
		await expect(page.getByTestId('login-error')).toBeVisible({ timeout: ERROR_VISIBILITY_TIMEOUT });
		await expect(page.getByTestId('login-error')).toContainText('Invalid credentials');
		
		// Should stay on login page
		expect(page.url()).toContain('/login');
	});

	test('should show error for duplicate username', async ({ page }) => {
		// Register first user
		const username = `testuser_${Date.now()}`;
		await page.goto('http://localhost:5173/register');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		
		const firstRegisterPromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /register/i }).click();
		await firstRegisterPromise;

		// Wait for counter page and logout
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: PAGE_LOAD_TIMEOUT });
		await expect(page.locator('.logout-button')).toBeVisible();
		await page.click('.logout-button');
		await expect(page.locator('h1')).toContainText('Welcome to SvelteKit', { timeout: PAGE_LOAD_TIMEOUT });

		// Try to register with same username
		await page.goto('http://localhost:5173/register');
		await page.fill('#username', username);
		await page.fill('#password', testPassword);
		await page.fill('#confirm-password', testPassword);
		
		// Wait for the API response
		const responsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);
		await page.getByRole('button', { name: /register/i }).click();
		const response = await responsePromise;
		
		// Should get conflict response
		expect(response.status()).toBe(409);

		// Assert error UI appears (not success UI)
		await expect(page.getByTestId('register-error')).toBeVisible({ timeout: ERROR_VISIBILITY_TIMEOUT });
		await expect(page.getByTestId('register-error')).toContainText('Username already exists');
		
		// Should stay on register page
		expect(page.url()).toContain('/register');
	});
});
