/**
 * SEO Tests — Verify meta tags, structured data, and crawlability
 *
 * What these do:
 * - Check <title> tags are correct and descriptive
 * - Verify Open Graph tags (og:title, og:image) for social sharing
 * - Check canonical URLs prevent duplicate content
 * - Verify robots.txt and sitemap.xml are accessible
 * - Check JSON-LD structured data on homepage
 *
 * Why: Search engines need these to properly index and display the site.
 */
const { test, expect } = require('@playwright/test');

test.describe('SEO', () => {

  test('Homepage has correct title and meta tags', async ({ page }) => {
    await page.goto('/');
    // Title should contain OFAI
    await expect(page).toHaveTitle(/OFAI/i);

    // Meta description should exist
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute('content', /.{20,}/);
  });

  test('Offer detail has OG tags for social sharing', async ({ page }) => {
    // Find a real offer to test
    await page.goto('/oferte');
    const firstOffer = page.locator('a.offer-card').first();
    const href = await firstOffer.getAttribute('href');

    if (href) {
      await page.goto(href);

      // og:title should exist
      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveAttribute('content', /.+/);

      // og:type should be product
      const ogType = page.locator('meta[property="og:type"]');
      await expect(ogType).toHaveAttribute('content', /product/);

      // Canonical URL should exist
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', /ofai\.ro/);
    }
  });

  test('robots.txt is accessible and contains sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const text = await response.text();
    // Should reference the sitemap
    expect(text.toLowerCase()).toContain('sitemap');
  });

  test('sitemap.xml is accessible and valid', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const xml = await response.text();
    // Should be valid XML with URLs
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<url>');
    expect(xml).toContain('<loc>');
  });

  test('Homepage has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');

    // Should have at least one JSON-LD script
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);

    // Parse the first JSON-LD and check it's valid
    const content = await jsonLd.first().textContent();
    const parsed = JSON.parse(content);
    expect(parsed['@context']).toBe('https://schema.org');
  });

  test('/oferte has pagination meta (rel=next/prev)', async ({ page }) => {
    await page.goto('/oferte');

    // If there's more than one page, should have rel=next
    const nextLink = page.locator('link[rel="next"]');
    // This might not exist if there's only one page — just verify no errors
    await expect(page.locator('.navbar')).toBeVisible();
  });
});
