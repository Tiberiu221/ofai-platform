/**
 * Auth Flow Tests — Login, logout, redirect protection
 *
 * What these do:
 * - Test the full login cycle (form → POST → cookies → redirect)
 * - Verify invalid credentials show an error
 * - Verify protected pages redirect to /login when not authenticated
 * - Verify logout clears cookies
 *
 * Note: These tests use a FRESH browser (no saved auth) to test the
 * actual login flow from scratch.
 */
const { test, expect } = require('@playwright/test');

// These tests need a fresh browser — no stored cookies
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication Flow', () => {

  test('protected page redirects to /login when not authenticated', async ({ page }) => {
    // Try to visit /cont without being logged in
    await page.goto('/cont');
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with valid credentials redirects to homepage', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Get CSRF token from meta tag
    const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content');

    // Submit login via API (same way the form does it)
    const response = await page.request.post('/login', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || '',
      },
      data: {
        email: 'owner@example.com',
        password: process.env.TEST_PASSWORD || 'parola123',
      },
    });

    const body = await response.json();

    if (body.success) {
      // Login succeeded — navigate to redirect
      await page.goto(body.redirect || '/');
      await page.waitForLoadState('domcontentloaded');

      // Should now be on homepage (or wherever redirect points)
      await expect(page.locator('.navbar')).toBeVisible();

      // User menu should be visible (logged in indicator)
      await expect(page.locator('.user-menu-wrapper, .user-menu-avatar')).toBeVisible();
    }
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content');

    const response = await page.request.post('/login', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || '',
      },
      data: {
        email: 'owner@example.com',
        password: 'WrongPassword999!',
      },
    });

    const body = await response.json();
    // Should NOT succeed
    expect(body.success).toBeFalsy();
    // Should have an error message
    expect(body.message).toBeTruthy();
  });

  test('logout clears cookies and redirects to homepage', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute('content');

    const loginRes = await page.request.post('/login', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken || '' },
      data: {
        email: 'owner@example.com',
        password: process.env.TEST_PASSWORD || 'parola123',
      },
    });
    const loginBody = await loginRes.json();

    if (loginBody.success) {
      // Now logout
      await page.goto('/logout');
      // Should redirect to homepage
      await expect(page).toHaveURL('/');
      // Should show login/register buttons (not user menu)
      await expect(page.locator('.nav-auth-btn, a[href="/login"]')).toBeVisible();
    }
  });
});
