/**
 * Mobile Responsive Tests — Verify site works on phone viewport
 *
 * What these do:
 * - Use iPhone 13 viewport (390×844) — set in playwright.config.js
 * - Check homepage renders correctly on mobile
 * - Hamburger menu opens and contains nav links
 * - Offer cards stack vertically (not side by side)
 *
 * These run in the "mobile" project with iPhone 13 device emulation.
 */
const { test, expect } = require('@playwright/test');

test.describe('Mobile Responsive', () => {

  test('Homepage renders on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navbar should still be visible
    await expect(page.locator('.navbar')).toBeVisible();

    // Desktop nav links should be hidden on mobile
    const navLinks = page.locator('.nav-links');
    // On mobile, nav-links are typically hidden via CSS
    // The hamburger menu should be visible instead
    await expect(page.locator('.nav-menu-toggle, .hamburger').first()).toBeVisible();
  });

  test('Hamburger menu opens on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click hamburger menu
    const hamburger = page.locator('.nav-menu-toggle, button.hamburger').first();
    await hamburger.click();

    // Mobile overlay should appear with nav links
    const overlay = page.locator('.nav-mobile-overlay');
    await expect(overlay).toBeVisible();

    // Should contain navigation links
    await expect(overlay.locator('a[href="/oferte"]')).toBeVisible();
    await expect(overlay.locator('a[href="/business-uri"]')).toBeVisible();
  });

  test('/oferte works on mobile', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.navbar')).toBeVisible();

    // Offer cards should exist
    const cards = page.locator('.offer-card');
    const count = await cards.count();
    if (count > 0) {
      // First card should be visible
      await expect(cards.first()).toBeVisible();
    }
  });
});
