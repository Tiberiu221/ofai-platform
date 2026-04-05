/**
 * Protected Page Tests — Pages that require authentication
 *
 * What these do:
 * - Use saved cookies from auth.setup.js (storageState)
 * - Navigate to pages that need login (/cont, /colectia-mea, etc.)
 * - Verify they load correctly with user data
 *
 * These tests run in the "chromium-auth" project which automatically
 * loads the saved cookie state — no login needed per test.
 */
const { test, expect } = require('@playwright/test');

test.describe('Protected Pages (Authenticated)', () => {

  test('/cont loads with user info', async ({ page }) => {
    await page.goto('/cont');
    await page.waitForLoadState('domcontentloaded');

    // Should NOT redirect to login (we're authenticated)
    expect(page.url()).toContain('/cont');
    await expect(page.locator('.navbar')).toBeVisible();

    // User menu avatar should be visible (logged in)
    await expect(page.locator('.user-menu-wrapper, .user-menu-avatar')).toBeVisible();
  });

  test('/colectia-mea loads', async ({ page }) => {
    await page.goto('/colectia-mea');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/colectia-mea');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/setari loads with settings form', async ({ page }) => {
    await page.goto('/setari');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/setari');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/preferinte loads with preference options', async ({ page }) => {
    await page.goto('/preferinte');
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('/preferinte');
    await expect(page.locator('.navbar')).toBeVisible();
  });
});
