import { test, expect } from '@playwright/test';

// Timeout constants for async operations
const API_RESPONSE_TIMEOUT = 35000;

test.describe('Tracing', () => {
	test('should include X-Trace-Id header in API responses', async ({ page }) => {
		// Register a new user
		const username = `tracetest_${Date.now()}`;
		const password = 'testpass123';

		await page.goto('/register');
		await page.fill('#username', username);
		await page.fill('#password', password);
		await page.fill('#confirm-password', password);

		// Intercept the API response
		const responsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);

		await expect(page.getByTestId('register-submit')).toBeEnabled();
		await page.getByTestId('register-submit').click();

		const response = await responsePromise;

		// Check for X-Trace-Id header
		const traceId = response.headers()['x-trace-id'];
		expect(traceId).toBeDefined();
		expect(traceId).not.toBe('');
		expect(typeof traceId).toBe('string');
		
		console.log('Trace ID received:', traceId);
	});

	test('should include X-Trace-Id header for login endpoint', async ({ page }) => {
		// First register a user
		const username = `tracetest_${Date.now()}`;
		const password = 'testpass123';

		await page.goto('/register');
		await page.fill('#username', username);
		await page.fill('#password', password);
		await page.fill('#confirm-password', password);

		const registerResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register'),
			{ timeout: API_RESPONSE_TIMEOUT }
		);

		await expect(page.getByTestId('register-submit')).toBeEnabled();
		await page.getByTestId('register-submit').click();
		await registerResponsePromise;

		// Wait for navigation and logout
		await page.waitForTimeout(1000);
		if (await page.locator('.logout-button').isVisible()) {
			await page.click('.logout-button');
			await page.waitForTimeout(500);
		}

		// Now try to login
		await page.goto('/login');
		await page.fill('#username', username);
		await page.fill('#password', password);

		const loginResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
			{ timeout: API_RESPONSE_TIMEOUT }
		);

		await expect(page.getByTestId('login-submit')).toBeEnabled();
		await page.getByTestId('login-submit').click();

		const loginResponse = await loginResponsePromise;

		// Check for X-Trace-Id header
		const traceId = loginResponse.headers()['x-trace-id'];
		expect(traceId).toBeDefined();
		expect(traceId).not.toBe('');
		expect(typeof traceId).toBe('string');
		
		console.log('Login Trace ID received:', traceId);
	});

	test('should include X-Trace-Id header for counter endpoint', async ({ page }) => {
		// Register and login
		const username = `tracetest_${Date.now()}`;
		const password = 'testpass123';

		await page.goto('/register');
		await page.fill('#username', username);
		await page.fill('#password', password);
		await page.fill('#confirm-password', password);

		const registerResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/auth/register'),
			{ timeout: API_RESPONSE_TIMEOUT }
		);

		await expect(page.getByTestId('register-submit')).toBeEnabled();
		await page.getByTestId('register-submit').click();
		await registerResponsePromise;

		// Wait for counter page to load
		await expect(page.locator('h1')).toContainText('Counter App', { timeout: 10000 });

		// Make an API call to counter endpoint
		const counterResponsePromise = page.waitForResponse(
			response => response.url().includes('/api/counter') && response.request().method() === 'GET',
			{ timeout: API_RESPONSE_TIMEOUT }
		);

		// Trigger counter GET by reloading
		await page.reload();
		const counterResponse = await counterResponsePromise;

		// Check for X-Trace-Id header
		const traceId = counterResponse.headers()['x-trace-id'];
		expect(traceId).toBeDefined();
		expect(traceId).not.toBe('');
		expect(typeof traceId).toBe('string');
		
		console.log('Counter GET Trace ID received:', traceId);
	});
});
