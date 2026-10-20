import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the demo path (issue #141).
 *
 * Local:  pnpm e2e
 * Live:   E2E_BASE_URL=https://vyanahealth.app E2E_PASSWORD_PATIENT=... E2E_PASSWORD_DOCTOR=... pnpm e2e
 *
 * Credentials come only from the environment (CI: repository secrets).
 * The tests never create data that stays.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // GitHub runners reach the Mumbai server slowly: 5 seconds is too short for a page change.
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
