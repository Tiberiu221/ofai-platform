/**
 * API Endpoint Tests — Smoke test key endpoints
 */
const { test, expect } = require('@playwright/test');

test.describe('API Endpoints', () => {

  test('GET /health returns 200', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/web/search/suggest returns JSON object', async ({ request }) => {
    // Response is { offers: [...], businesses: [...] }, NOT a flat array
    const response = await request.get('/api/web/search/suggest?q=test');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('offers');
    expect(body).toHaveProperty('businesses');
    expect(Array.isArray(body.offers)).toBe(true);
    expect(Array.isArray(body.businesses)).toBe(true);
  });

  test('Static CSS loads', async ({ request }) => {
    const response = await request.get('/css/main.css');
    expect(response.status()).toBe(200);
  });

  test('Static JS loads', async ({ request }) => {
    const response = await request.get('/js/main.js');
    expect(response.status()).toBe(200);
  });

  test('404 returns proper status', async ({ request }) => {
    const response = await request.get('/this-page-does-not-exist-xyz');
    expect(response.status()).toBe(404);
  });
});
