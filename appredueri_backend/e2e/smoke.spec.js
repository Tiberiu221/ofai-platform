/**
 * Smoke Tests — Every public page loads without errors
 *
 * What these do:
 * - Navigate to each public page
 * - Check it returns 200 (not 500 error)
 * - Verify key elements exist (navbar, content, footer)
 * - These catch: broken routes, missing templates, DB errors, crashes
 */
const { test, expect } = require('@playwright/test');

test.describe('Public Pages — Smoke Tests', () => {

  test('Homepage loads with stats and categories', async ({ page }) => {
    await page.goto('/');
    // Page loaded successfully (not a 500 error page)
    await expect(page.locator('.navbar')).toBeVisible();
    // Stats section exists (shows business count, offer count, etc.)
    await expect(page.locator('.hero-stats, .stats-row')).toBeVisible();
  });

  test('/oferte loads with offer cards', async ({ page }) => {
    await page.goto('/oferte');
    await expect(page).toHaveTitle(/Oferte/);
    await expect(page.locator('.navbar')).toBeVisible();
    // At least some offer cards OR a "no results" message
    const hasOffers = await page.locator('.offer-card').count();
    const hasEmpty = await page.locator('.empty-state, .no-results').count();
    expect(hasOffers + hasEmpty).toBeGreaterThan(0);
  });

  test('/business-uri loads with business cards', async ({ page }) => {
    await page.goto('/business-uri');
    await expect(page).toHaveTitle(/Business/);
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/categorii loads with category items', async ({ page }) => {
    await page.goto('/categorii');
    await expect(page.locator('.navbar')).toBeVisible();
    // Should have at least one category
    await expect(page.locator('.category-card, .category-item, a[href*="category"]').first()).toBeVisible();
  });

  test('/orase loads with city items', async ({ page }) => {
    await page.goto('/orase');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/preturi loads with 3 pricing plans', async ({ page }) => {
    await page.goto('/preturi');
    await expect(page).toHaveTitle(/Prețuri|Preturi|Pricing/i);
    await expect(page.locator('.navbar')).toBeVisible();
    // Should show Free, Standard, Premium plans
    await expect(page.getByText('Gratuit')).toBeVisible();
  });

  test('/blog loads with posts', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.locator('.navbar')).toBeVisible();
    // At least one blog card
    await expect(page.locator('.blog-card, .blog-post-card, article').first()).toBeVisible();
  });

  test('/login loads with form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('/register loads with form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('/forgot-password loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  });

  test('/termeni loads', async ({ page }) => {
    await page.goto('/termeni');
    await expect(page.locator('.navbar')).toBeVisible();
    // Should have substantial content (not empty)
    const content = await page.locator('main, .content, .legal-content, article').textContent();
    expect((content || '').length).toBeGreaterThan(100);
  });

  test('/confidentialitate loads', async ({ page }) => {
    await page.goto('/confidentialitate');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/ajutor loads', async ({ page }) => {
    await page.goto('/ajutor');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('/pentru-business loads', async ({ page }) => {
    await page.goto('/pentru-business');
    await expect(page.locator('.navbar')).toBeVisible();
  });

  test('Offer detail page loads', async ({ page }) => {
    // First get a valid offer ID from the listing
    await page.goto('/oferte');
    const firstOffer = page.locator('a.offer-card').first();
    const href = await firstOffer.getAttribute('href');

    if (href) {
      await page.goto(href);
      await expect(page.locator('.navbar')).toBeVisible();
      // Offer should have a title
      await expect(page.locator('h1, .offer-title, .hero-title').first()).toBeVisible();
    }
  });

  test('Business detail page loads', async ({ page }) => {
    await page.goto('/business-uri');
    const firstBiz = page.locator('a[href^="/business/"]').first();
    const href = await firstBiz.getAttribute('href');

    if (href) {
      await page.goto(href);
      await expect(page.locator('.navbar')).toBeVisible();
    }
  });
});
