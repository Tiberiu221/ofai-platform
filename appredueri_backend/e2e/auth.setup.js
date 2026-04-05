/**
 * Auth Setup — runs ONCE before all test suites
 *
 * What happens:
 * 1. Opens /login in Chrome
 * 2. Fills in email + password
 * 3. Clicks the submit button (which does a JS fetch with CSRF internally)
 * 4. Waits for redirect to homepage
 * 5. Saves all cookies to playwright/.auth/user.json
 * 6. All "chromium-auth" tests reuse these cookies
 */
const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Step 1: Go to login page
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Step 2: Fill the login form
  await page.locator('input[name="email"], input[type="email"]').first().fill('owner@example.com');
  await page.locator('input[name="password"], input[type="password"]').first().fill(process.env.TEST_PASSWORD || 'parola123');

  // Step 3: Listen for network response before clicking
  const responsePromise = page.waitForResponse(resp =>
    resp.url().includes('/login') && resp.request().method() === 'POST',
    { timeout: 15000 }
  ).catch(() => null);

  // Click submit — the form's JS handles CSRF internally
  await page.locator('button[type="submit"], .auth-submit-btn').first().click();

  // Step 4: Wait for the POST response
  const loginResponse = await responsePromise;
  if (loginResponse) {
    const status = loginResponse.status();
    const text = await loginResponse.text().catch(() => '');
    console.log('[Auth Setup] POST /login status:', status, 'body:', text.substring(0, 200));

    if (status === 200) {
      try {
        const data = JSON.parse(text);
        if (data.success && data.redirect) {
          await page.goto(data.redirect);
          await page.waitForLoadState('domcontentloaded');
        }
      } catch {}
    }
  }

  // Wait a bit for any JS redirect
  await page.waitForTimeout(2000);

  // Verify we're logged in (user menu visible OR not on login page)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    // Still on login page — check for error
    const errorText = await page.locator('.auth-error, .error-message, [role="alert"]').textContent().catch(() => 'Unknown error');
    throw new Error('Login failed: ' + errorText);
  }

  // Step 5: Save cookies + storage state
  await page.context().storageState({ path: authFile });
  console.log('[Auth Setup] Logged in and cookies saved');
});
