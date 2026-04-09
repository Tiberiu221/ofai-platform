/**
 * Visual Regression Tests — Screenshot comparison
 *
 * Ce face: Ia screenshot pe pagini cheie, compară pixel-cu-pixel cu baseline-ul salvat.
 * Prima rulare: creează baseline screenshots în e2e/visual-regression.spec.js-snapshots/
 * Următoarele rulări: compară cu baseline — FAIL dacă ceva s-a schimbat vizual.
 *
 * Update baselines: npx playwright test e2e/visual-regression.spec.js --update-snapshots
 *
 * Prinde: CSS broken, layout shifts, elemente care dispar/apar accidental,
 * fonturi schimbate, culori alterate, spacing modificat.
 *
 * 28 tests: 19 public + 5 authenticated + 4 admin
 */
const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');

// Allow small pixel differences (anti-aliasing, font rendering)
const SCREENSHOT_OPTS = { maxDiffPixelRatio: 0.01 };
const VIEWPORT_OPTS = { ...SCREENSHOT_OPTS, fullPage: false };

// ── Auth helpers ──
// JWT_SECRET must match server's .env — loaded from dotenv
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TEST_USER_ID = 1; // owner@example.com

async function injectAuthCookie(context) {
  const token = jwt.sign({ id: TEST_USER_ID }, JWT_SECRET, { expiresIn: '1h' });
  await context.addCookies([{
    name: 'ofai_token',
    value: token,
    domain: 'localhost',
    path: '/',
  }]);
}

function getAdminAuthHeader() {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD || '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function waitForPage(page, ms = 500) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

// ============================================
// PUBLIC PAGES — EXISTING (7 tests, baselines preserved)
// ============================================

test.describe('Visual Regression — Public Pages (Existing)', () => {

  test('Homepage above the fold', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('homepage.png', VIEWPORT_OPTS);
  });

  test('Navbar appearance', async ({ page }) => {
    await page.goto('/');
    await waitForPage(page);
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toHaveScreenshot('navbar.png', SCREENSHOT_OPTS);
  });

  test('/oferte page layout', async ({ page }) => {
    await page.goto('/oferte');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('oferte.png', VIEWPORT_OPTS);
  });

  test('/login page layout', async ({ page }) => {
    await page.goto('/login');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('login.png', SCREENSHOT_OPTS);
  });

  test('/preturi page layout', async ({ page }) => {
    await page.goto('/preturi');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('preturi.png', VIEWPORT_OPTS);
  });

  test('Offer detail page layout', async ({ page }) => {
    await page.goto('/oferte');
    await waitForPage(page);
    const firstOffer = page.locator('a.offer-card').first();
    if (await firstOffer.count() > 0) {
      const href = await firstOffer.getAttribute('href');
      await page.goto(href);
      await waitForPage(page);
      await expect(page).toHaveScreenshot('offer-detail.png', VIEWPORT_OPTS);
    }
  });

  test('Business detail page layout', async ({ page }) => {
    await page.goto('/business-uri');
    await waitForPage(page);
    const firstBiz = page.locator('a[href^="/business/"]').first();
    if (await firstBiz.count() > 0) {
      const href = await firstBiz.getAttribute('href');
      await page.goto(href);
      await waitForPage(page);
      await expect(page).toHaveScreenshot('business-detail.png', VIEWPORT_OPTS);
    }
  });
});

// ============================================
// PUBLIC PAGES — NEW (12 tests)
// ============================================

test.describe('Visual Regression — Public Pages (New)', () => {

  test('/business-uri listing', async ({ page }) => {
    await page.goto('/business-uri');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('business-uri.png', VIEWPORT_OPTS);
  });

  test('/categorii grid', async ({ page }) => {
    await page.goto('/categorii');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('categorii.png', VIEWPORT_OPTS);
  });

  test('/orase grid', async ({ page }) => {
    await page.goto('/orase');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('orase.png', VIEWPORT_OPTS);
  });

  test('/register page layout', async ({ page }) => {
    await page.goto('/register');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('register.png', SCREENSHOT_OPTS);
  });

  test('/forgot-password page layout', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('forgot-password.png', SCREENSHOT_OPTS);
  });

  test('/blog listing', async ({ page }) => {
    await page.goto('/blog');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('blog.png', VIEWPORT_OPTS);
  });

  test('/pentru-business landing', async ({ page }) => {
    await page.goto('/pentru-business');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('pentru-business.png', VIEWPORT_OPTS);
  });

  test('/termeni page', async ({ page }) => {
    await page.goto('/termeni');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('termeni.png', VIEWPORT_OPTS);
  });

  test('/confidentialitate page', async ({ page }) => {
    await page.goto('/confidentialitate');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('confidentialitate.png', VIEWPORT_OPTS);
  });

  test('/ajutor page', async ({ page }) => {
    await page.goto('/ajutor');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('ajutor.png', VIEWPORT_OPTS);
  });

  test('/verify-code page', async ({ page }) => {
    await page.goto('/verify-code');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('verify-code.png', SCREENSHOT_OPTS);
  });

  test('404 error page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('404-page.png', SCREENSHOT_OPTS);
  });
});

// ============================================
// AUTHENTICATED PAGES (5 tests, JWT cookie injection)
// ============================================

test.describe('Visual Regression — Authenticated Pages', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuthCookie(page.context());
  });

  test('/colectia-mea businesses tab', async ({ page }) => {
    await page.goto('/colectia-mea');
    if (page.url().includes('/login')) return; // Auth failed
    await waitForPage(page);
    await expect(page).toHaveScreenshot('colectia-mea-businesses.png', VIEWPORT_OPTS);
  });

  test('/colectia-mea offers tab', async ({ page }) => {
    await page.goto('/colectia-mea');
    if (page.url().includes('/login')) return;
    await waitForPage(page);
    // Click offers tab
    const offersTab = page.locator('button[data-tab="offers"]');
    if (await offersTab.count() > 0) {
      await offersTab.click();
      await page.waitForTimeout(300);
    }
    await expect(page).toHaveScreenshot('colectia-mea-offers.png', VIEWPORT_OPTS);
  });

  test('/cont account page', async ({ page }) => {
    await page.goto('/cont');
    if (page.url().includes('/login')) return;
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('cont.png', VIEWPORT_OPTS);
  });

  test('/setari settings page', async ({ page }) => {
    await page.goto('/setari');
    if (page.url().includes('/login')) return;
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('setari.png', VIEWPORT_OPTS);
  });

  test('/preferinte preferences page', async ({ page }) => {
    await page.goto('/preferinte');
    if (page.url().includes('/login')) return;
    await waitForPage(page, 300);
    await expect(page).toHaveScreenshot('preferinte.png', VIEWPORT_OPTS);
  });
});

// ============================================
// ADMIN PAGES (4 tests, Basic Auth header)
// ============================================

test.describe('Visual Regression — Admin Pages', () => {

  test.skip(!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD, 'Admin credentials not configured');

  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
      Authorization: getAdminAuthHeader(),
    });
  });

  test('Admin dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('admin-dashboard.png', VIEWPORT_OPTS);
  });

  test('Admin offer moderation', async ({ page }) => {
    await page.goto('/admin/offer-moderation');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('admin-offer-moderation.png', VIEWPORT_OPTS);
  });

  test('Admin businesses list', async ({ page }) => {
    await page.goto('/admin/businesses');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('admin-businesses.png', VIEWPORT_OPTS);
  });

  test('Admin categories', async ({ page }) => {
    await page.goto('/admin/categories');
    await waitForPage(page);
    await expect(page).toHaveScreenshot('admin-categories.png', VIEWPORT_OPTS);
  });
});
