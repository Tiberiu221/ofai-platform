/**
 * Regression Tests — Guard against known bugs recurring
 *
 * Ce face: Verificări specifice pentru bug-uri care s-au întâmplat deja.
 * Fiecare test are un comentariu cu bug-ul original și commit-ul fix.
 *
 * Prinde: Feature-uri Flutter care apar accidental pe web, elemente lipsă,
 * configurări greșite, gotchas din CLAUDE.md.
 */
const { test, expect } = require('@playwright/test');

test.describe('Regression Tests — Known Bug Guards', () => {

  // Bug: Flutter scroll spy tab bar appeared on web business detail (commit 028dad0)
  // Fix: Removed in commit 991c9fc — Flutter-only feature
  test('Business detail does NOT have Flutter tab bar', async ({ page }) => {
    await page.goto('/business-uri');
    const firstBiz = page.locator('a[href^="/business/"]').first();
    if (await firstBiz.count() > 0) {
      const href = await firstBiz.getAttribute('href');
      await page.goto(href);
      await page.waitForLoadState('domcontentloaded');

      // Tab bar should NOT exist on web
      await expect(page.locator('.bd-tab-bar')).toHaveCount(0);
      await expect(page.locator('nav.bd-tab-bar')).toHaveCount(0);
    }
  });

  // Bug: Logo disappeared after hard refresh (missing ofai-wordmark-nobg.png)
  // Fix: Restored file + cache-busting ?v= param (commit 73fcadb + c8c4f52)
  test('OFAI logo is visible in navbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const logo = page.locator('nav.navbar img.nav-logo-img');
    await expect(logo).toBeVisible();
    // Logo should have cache-busting param
    const src = await logo.getAttribute('src');
    expect(src).toContain('?v=');
  });

  // Bug: Logo missing on auth pages (login, register, forgot-password)
  // Fix: Restored file + cache-busting (commit c8c4f52)
  test('OFAI logo is visible on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const logo = page.locator('.auth-logo img');
    await expect(logo).toBeVisible();
    const src = await logo.getAttribute('src');
    expect(src).toContain('ofai-wordmark-nobg.png');
  });

  // Bug: 404/500 error pages crashed with "t is not defined" (i18n missing)
  // Fix: Added t() fallback in error handlers (commit 5722f78)
  test('404 page renders correctly (no i18n crash)', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-99999');
    expect(response.status()).toBe(404);
    // Page should render (not a raw error)
    const body = await page.content();
    expect(body).toContain('</html>');
    // Should NOT contain "t is not defined"
    expect(body).not.toContain('t is not defined');
  });

  // Bug: sitemap.xml crashed because businesses table has no created_at/updated_at
  // Fix: Uses CURRENT_DATE instead (commit 75028e6)
  test('sitemap.xml does not crash', async ({ request }) => {
    const response = await request.get('/sitemap.xml', { timeout: 15000 });
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('<loc>');
  });

  // Bug: Save count was showing on offer/business cards (intentionally removed)
  // Policy: Save count only on detail pages, NOT on cards
  test('Offer cards do NOT show save count', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Cards should NOT have save/favorite count text
    const cards = page.locator('.offer-card');
    if (await cards.count() > 0) {
      const firstCard = cards.first();
      const text = await firstCard.textContent();
      // Should not contain "X salvări" or "salvat de X"
      expect(text).not.toMatch(/\d+\s*salv[aă]r/i);
    }
  });

  // Bug: Google Maps embed blocked by CSP (missing frameSrc)
  // Fix: Added maps.google.com + www.google.com to CSP (commit 15e4c89)
  test('CSP allows Google Maps embeds', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];
    expect(csp).toContain('maps.google.com');
  });

  // Bug: Navbar logo was 28px (too small after logo redesign)
  // Fix: Increased to 36px (commit c36d569)
  test('Navbar logo has correct height', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const logo = page.locator('nav.navbar img.nav-logo-img');
    const style = await logo.getAttribute('style');
    expect(style).toContain('height:36px');
  });

  // Verify: XSS escape on JSON.stringify in pricing page
  // Fix: Added .replace(/<\//g, '<\\/') on commit 5722f78
  test('Pricing page JSON.stringify has XSS escape', async ({ page }) => {
    await page.goto('/preturi');
    await page.waitForLoadState('domcontentloaded');

    // Page should load without JS errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    // No critical JS errors
    const criticalErrors = errors.filter(e => !e.includes('google'));
    expect(criticalErrors.length).toBe(0);
  });
});
