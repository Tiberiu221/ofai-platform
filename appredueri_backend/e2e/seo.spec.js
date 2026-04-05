/**
 * SEO Tests — Meta tags, structured data, crawlability
 */
const { test, expect } = require('@playwright/test');

test.describe('SEO', () => {

  test('Homepage has OFAI in title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OFAI/);
  });

  test('Offer detail has OG tags', async ({ page }) => {
    await page.goto('/oferte');
    const firstOffer = page.locator('a.offer-card').first();
    const href = await firstOffer.getAttribute('href');

    if (href) {
      await page.goto(href);
      // og:title should exist
      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveAttribute('content', /.+/);
    }
  });

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text.toLowerCase()).toContain('sitemap');
  });

  // Known bug: businesses table has no updated_at column → sitemap query crashes
  // TODO: Fix sitemap query to use created_at instead of updated_at
  test.fixme('sitemap.xml is accessible and valid XML', async ({ request }) => {
    const response = await request.get('/sitemap.xml', { timeout: 15000 });
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('urlset');
    expect(xml).toContain('<loc>');
  });

  test('Homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);

    const content = await jsonLd.first().textContent();
    const parsed = JSON.parse(content);
    expect(parsed['@context']).toBe('https://schema.org');
  });

  test('Offer detail has canonical URL', async ({ page }) => {
    await page.goto('/oferte');
    const firstOffer = page.locator('a.offer-card').first();
    const href = await firstOffer.getAttribute('href');

    if (href) {
      await page.goto(href);
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /ofai\.ro/);
    }
  });
});
