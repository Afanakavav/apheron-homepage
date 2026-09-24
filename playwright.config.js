// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * E2E tests for Italian Lessons Dublin (and optionally other static sites).
 * Run from apheron-homepage root: npm run test:e2e
 * First time: npx playwright install
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx serve public/italian-lessons-dublin -l 5000",
      url: "http://localhost:5000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      // Wheel of Facts needs the whole public/ folder (it loads /fonts/ from the hub).
      command: "npx serve public -l 5001",
      url: "http://localhost:5001/fun-friday/",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
