/**
 * Search & Filter Tests — Search box, category/city filters, sort, pagination
 */
const { test, expect } = require('@playwright/test');

test.describe('Search and Filters', () => {

  test('/oferte — search updates results', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    // Search input has name="q" and class="search-bar"
    const searchInput = page.locator('input[name="q"]').first();
    await searchInput.fill('test');
    await searchInput.press('Enter');

    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('q=test');
  });

  test('/oferte — category filter updates URL', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    const categoryFilter = page.locator('a[href*="category="]').first();
    if (await categoryFilter.count() > 0) {
      await categoryFilter.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('category=');
    }
  });

  test('/oferte — sort changes results', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    const discountSort = page.locator('a[href*="sort=discount"]').first();
    if (await discountSort.count() > 0) {
      await discountSort.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('sort=discount');
    }
  });

  test('/business-uri — search works', async ({ page }) => {
    await page.goto('/business-uri');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[name="q"]').first();
    await searchInput.fill('test');
    await searchInput.press('Enter');

    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('q=test');
  });

  test('/oferte — pagination works', async ({ page }) => {
    await page.goto('/oferte');
    await page.waitForLoadState('domcontentloaded');

    const page2Link = page.locator('a[href*="page=2"]').first();
    if (await page2Link.count() > 0) {
      await page2Link.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('page=2');
    }
  });
});
