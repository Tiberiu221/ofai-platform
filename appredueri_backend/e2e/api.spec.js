/**
 * API Endpoint Tests — Smoke test key endpoints
 *
 * What these do:
 * - Use Playwright's request API (no browser needed — faster)
 * - Hit key endpoints and verify they return correct status + format
 * - Check static assets are served correctly
 *
 * These are "smoke tests" — they verify endpoints don't crash,
 * not that they return perfect data.
 */
const { test, expect } = require('@playwright/test');

test.describe('API Endpoints', () => {

  test('GET /health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/web/search/suggest returns JSON', async ({ request }) => {
    const response = await request.get('/api/web/search/suggest?q=test');
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Should return an array (even if empty)
    expect(Array.isArray(body)).toBe(true);
  });

  test('Static CSS loads correctly', async ({ request }) => {
    const response = await request.get('/css/main.css');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('css');
  });

  test('Static JS loads correctly', async ({ request }) => {
    const response = await request.get('/js/main.js');
    expect(response.status()).toBe(200);
  });

  test('404 page returns proper status', async ({ request }) => {
    const response = await request.get('/this-page-does-not-exist-xyz');
    expect(response.status()).toBe(404);
  });
});
