/**
 * Visual Regression Tests — Screenshot comparison
 *
 * Ce face: Ia screenshot pe pagini cheie, compară pixel-cu-pixel cu baseline-ul salvat.
 * Prima rulare: creează baseline screenshots în e2e/visual-regression.spec.js-snapshots/
 * Următoarele rulări: compară cu baseline — FAIL dacă ceva s-a schimbat vizual.
 *
 * Update baselines: npx playwright test --update-snapshots
 *
 * Prinde: CSS broken, layout shifts, elemente care dispar/apar accidental,
 * fonturi schimbate, culori alterate, spacing modificat.
 */
const { test, expect } = require('@playwright/test');

// Allow small pixel differences (anti-aliasing, font rendering)
const SCREENSHOT_OPTS = { maxDiffPixelRatio: 0.01 };

test.describe('Visual Regression', () => {

  test('Homepage above the fold', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500); // Wait for animations
    await expect(page).toHaveScreenshot('homepage.png', {
      ...SCREENSHOT_OPTS,
      fullPage: false, // Only viewport (above the fold)
    });
  });

  test('Navbar appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toHaveScreenshot('navbar.png', SCREENSHOT_OPTS);
  });

  test('/oferte page layout', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('oferte.png', {
      ...SCREENSHOT_OPTS,
      fullPage: false,
    });
  });

  test('/login page layout', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveScreenshot('login.png', SCREENSHOT_OPTS);
  });

  test('/preturi page layout', async ({ page }) => {
    await page.goto('/preturi');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('preturi.png', {
      ...SCREENSHOT_OPTS,
      fullPage: false,
    });
  });

  test('Offer detail page layout', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');
    const firstOffer = page.locator('a.offer-card').first();
    if (await firstOffer.count() > 0) {
      const href = await firstOffer.getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('offer-detail.png', {
        ...SCREENSHOT_OPTS,
        fullPage: false,
      });
    }
  });

  test('Business detail page layout', async ({ page }) => {
    await page.goto('/business-uri');
    await page.waitForLoadState('domcontentloaded');
    const firstBiz = page.locator('a[href^="/business/"]').first();
    if (await firstBiz.count() > 0) {
      const href = await firstBiz.getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('business-detail.png', {
        ...SCREENSHOT_OPTS,
        fullPage: false,
      });
    }
  });
});
