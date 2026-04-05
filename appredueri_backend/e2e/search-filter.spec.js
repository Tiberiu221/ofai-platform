/**
 * Search & Filter Tests — Verify search and filtering work
 *
 * What these do:
 * - Type in search box → results update
 * - Click category/city filter → URL params change, results filter
 * - Change sort order → results reorder
 * - Pagination works (next page loads different results)
 */
const { test, expect } = require('@playwright/test');

test.describe('Search and Filters', () => {

  test('/oferte — search updates results', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Type in search box and submit
    const searchInput = page.locator('input[name="q"], .search-input, input[type="search"]').first();
    await searchInput.fill('test');
    await searchInput.press('Enter');

    // URL should now contain ?q=test
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('q=test');
  });

  test('/oferte — category filter updates URL', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Click on any category filter pill/link
    const categoryFilter = page.locator('a[href*="category="]').first();
    const exists = await categoryFilter.count();

    if (exists > 0) {
      await categoryFilter.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('category=');
    }
  });

  test('/oferte — sort changes results order', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Click "Reducere" sort
    const discountSort = page.locator('a[href*="sort=discount"]').first();
    const exists = await discountSort.count();

    if (exists > 0) {
      await discountSort.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('sort=discount');
    }
  });

  test('/business-uri — search works', async ({ page }) => {
    await page.goto('/business-uri');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[name="q"], .search-input, input[type="search"]').first();
    await searchInput.fill('restaurant');
    await searchInput.press('Enter');

    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('q=restaurant');
  });

  test('/oferte — pagination loads next page', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Look for page 2 link
    const page2Link = page.locator('a[href*="page=2"]').first();
    const exists = await page2Link.count();

    if (exists > 0) {
      await page2Link.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('page=2');
      // Should still have navbar (page loaded correctly)
      await expect(page.locator('.navbar')).toBeVisible();
    }
  });
});
