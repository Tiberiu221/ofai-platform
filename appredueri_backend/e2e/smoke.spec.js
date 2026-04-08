/**
 * Smoke Tests — Every public page loads without errors
 */
const { test, expect } = require('@playwright/test');

test.describe('Public Pages — Smoke Tests', () => {

  test('Homepage loads with stats', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OFAI/);
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/oferte loads with offer cards', async ({ page }) => {
    await page.goto('/oferte');
    await expect(page).toHaveTitle(/OFAI/);
    await expect(page.locator('nav.navbar')).toBeVisible();
    const hasOffers = await page.locator('.offer-card').count();
    const hasEmpty = await page.locator('.empty-state, .no-results').count();
    expect(hasOffers + hasEmpty).toBeGreaterThan(0);
  });

  test('/business-uri loads', async ({ page }) => {
    await page.goto('/business-uri');
    await expect(page).toHaveTitle(/OFAI/);
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/categorii loads', async ({ page }) => {
    await page.goto('/categorii');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/orase loads', async ({ page }) => {
    await page.goto('/orase');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/preturi loads with plan cards', async ({ page }) => {
    await page.goto('/preturi');
    await expect(page).toHaveTitle(/OFAI/);
    await expect(page.locator('nav.navbar')).toBeVisible();
    // i18n: "Gratuit" (RO) or "Free" (EN) depending on browser locale
    await expect(page.getByText('Free').or(page.getByText('Gratuit')).first()).toBeVisible();
  });

  test('/blog loads', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.blog-card').first()).toBeVisible();
  });

  test('/login loads with form', async ({ page }) => {
    await page.goto('/login');
    // Login page is standalone (no navbar)
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('/register loads with form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('/forgot-password loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('/termeni loads with content', async ({ page }) => {
    await page.goto('/termeni');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/confidentialitate loads', async ({ page }) => {
    await page.goto('/confidentialitate');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/ajutor loads', async ({ page }) => {
    await page.goto('/ajutor');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('/pentru-business loads', async ({ page }) => {
    await page.goto('/pentru-business');
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('Offer detail page loads', async ({ page }) => {
    await page.goto('/oferte');
    const firstOffer = page.locator('a.offer-card').first();
    const href = await firstOffer.getAttribute('href');
    if (href) {
      await page.goto(href);
      await expect(page.locator('nav.navbar')).toBeVisible();
    }
  });

  test('Business detail page loads', async ({ page }) => {
    await page.goto('/business-uri');
    const firstBiz = page.locator('a[href^="/business/"]').first();
    const href = await firstBiz.getAttribute('href');
    if (href) {
      await page.goto(href);
      await expect(page.locator('nav.navbar')).toBeVisible();
    }
  });
});
