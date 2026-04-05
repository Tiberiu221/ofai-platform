/**
 * Navigation Tests — Real user journeys through the site
 */
const { test, expect } = require('@playwright/test');

test.describe('User Navigation Journeys', () => {

  test('Home → click offer card → offer detail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const offerLink = page.locator('a[href^="/oferta/"]').first();
    if (await offerLink.count() > 0) {
      await offerLink.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/oferta/');
    }
  });

  test('Home → "Explorează oferte" → /oferte', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const ctaBtn = page.locator('a[href="/oferte"]').first();
    if (await ctaBtn.count() > 0) {
      await ctaBtn.click();
      await expect(page).toHaveURL(/\/oferte/);
    }
  });

  test('Offer detail → click business → business detail', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    const firstOffer = page.locator('a.offer-card').first();
    if (await firstOffer.count() > 0) {
      const href = await firstOffer.getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');

      const bizLink = page.locator('a[href^="/business/"]').first();
      if (await bizLink.count() > 0) {
        await bizLink.click();
        await page.waitForLoadState('domcontentloaded');
        expect(page.url()).toContain('/business/');
      }
    }
  });

  test('Navbar links navigate correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click "Oferte" in navbar
    await page.locator('nav.navbar a[href="/oferte"]').click();
    await expect(page).toHaveURL(/\/oferte/);

    // Click "Business-uri"
    await page.locator('nav.navbar a[href="/business-uri"]').click();
    await expect(page).toHaveURL(/\/business-uri/);

    // Click "Categorii"
    await page.locator('nav.navbar a[href="/categorii"]').click();
    await expect(page).toHaveURL(/\/categorii/);

    // Click logo → home (scoped to navbar, not footer)
    await page.locator('nav.navbar a.nav-logo').click();
    await expect(page).toHaveURL(/\/$/);
  });
});
