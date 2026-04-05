// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright E2E Test Configuration — OFAI
 *
 * How it works:
 * 1. webServer starts Express automatically (node src/index.js)
 * 2. Playwright waits until /health returns 200
 * 3. 'setup' project runs first — logs in and saves cookies
 * 4. Other projects run tests using those saved cookies
 *
 * Run: npm run test:e2e
 * Debug: npm run test:e2e:headed (opens visible browser)
 * UI: npm run test:e2e:ui (interactive Playwright UI)
 */
module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,         // Sequential — single DB, avoid conflicts
  forbidOnly: !!process.env.CI, // Fail CI if test.only left in
  retries: process.env.CI ? 2 : 0,
  workers: 1,                   // One worker — single DB
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30000,               // 30s per test

  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',       // Save timeline on failure (for debugging)
    screenshot: 'only-on-failure', // Screenshot when test fails
    actionTimeout: 10000,          // 10s for clicks/fills
  },

  // Playwright starts Express before tests, stops it after
  webServer: {
    command: 'node src/index.js',
    url: 'http://localhost:4000/health',
    timeout: 30000,
    reuseExistingServer: !process.env.CI, // Reuse if already running locally
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    // Step 1: Login once, save cookies to playwright/.auth/user.json
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },

    // Step 2: Public pages — no auth needed
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/protected\.spec/, /mobile\.spec/, /auth\.setup/],
    },

    // Step 3: Protected pages — uses saved cookies from setup
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        // This is the magic: loads cookies saved by auth.setup.js
        storageState: 'playwright/.auth/user.json',
      },
      testMatch: /protected\.spec/,
      dependencies: ['setup'],
    },

    // Step 4: Mobile viewport — Chrome with small viewport (no WebKit needed)
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: /mobile\.spec/,
    },
  ],
});
