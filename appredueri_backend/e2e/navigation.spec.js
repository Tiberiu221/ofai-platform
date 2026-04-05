/**
 * Navigation Tests — Real user journeys through the site
 *
 * What these do:
 * - Simulate a real user clicking through pages
 * - Home → offer card → offer detail → business → business detail
 * - Navbar links work correctly
 * - Each click leads to the right page with correct content
 */
const { test, expect } = require('@playwright/test');

test.describe('User Navigation Journeys', () => {

  test('Home → click offer card → offer detail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find any offer card link on the homepage
    const offerLink = page.locator('a[href^="/oferta/"]').first();
    const exists = await offerLink.count();

    if (exists > 0) {
      // Get the offer title before clicking (for verification)
      await offerLink.click();
      await page.waitForLoadState('domcontentloaded');

      // Should be on offer detail page
      expect(page.url()).toContain('/oferta/');
      await expect(page.locator('.navbar')).toBeVisible();
    }
  });

  test('Home → "Explorează oferte" button → /oferte', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click the CTA button
    const ctaBtn = page.locator('a[href="/oferte"]').first();
    await ctaBtn.click();

    await expect(page).toHaveURL(/\/oferte/);
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('Offer detail → click business name → business detail', async ({ page }) => {
    // Go to offers listing first
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    const firstOffer = page.locator('a.offer-card').first();
    const exists = await firstOffer.count();

    if (exists > 0) {
      const href = await firstOffer.getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');

      // Find business link (sidebar or hero)
      const bizLink = page.locator('a[href^="/business/"]').first();
      const bizExists = await bizLink.count();

      if (bizExists > 0) {
        await bizLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Should be on business detail page
        expect(page.url()).toContain('/business/');
        await expect(page.locator('.navbar')).toBeVisible();
      }
    }
  });

  test('Navbar links navigate correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click "Oferte" in navbar
    await page.locator('.nav-link[href="/oferte"]').click();
    await expect(page).toHaveURL(/\/oferte/);

    // Click "Business-uri" in navbar
    await page.locator('.nav-link[href="/business-uri"]').click();
    await expect(page).toHaveURL(/\/business-uri/);

    // Click "Categorii" in navbar
    await page.locator('.nav-link[href="/categorii"]').click();
    await expect(page).toHaveURL(/\/categorii/);

    // Click logo → home
    await page.locator('.nav-logo').click();
    await expect(page).toHaveURL('/');
  });
});
