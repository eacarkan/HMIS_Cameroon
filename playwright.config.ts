import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration (Step 14). The e2e suite runs the real app against the
 * dedicated TEST database (never dev/prod). The web server is started by Playwright
 * with DATABASE_URL pinned to TEST_DATABASE_URL; `tests/e2e/global-setup.ts` resets +
 * seeds it once. Tests run serially (workers: 1) because they build the golden path.
 */
const PORT = 3100;
const TEST_DB =
  process.env.TEST_DATABASE_URL ??
  "postgresql://hmis:hmis_dev_password@localhost:5432/hmis_cameroon_test?schema=public";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  // Dev-mode Next.js compiles routes on first hit; as the app grew (Phase 2 — many routes + a large
  // server-services barrel) the first render of a fresh route can take several seconds. Generous
  // timeouts absorb that cold-compile latency (the long multi-role journeys cross many new routes).
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB,
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? "e2e-test-secret-not-for-production-32+",
      AUTH_TRUST_HOST: "true",
    },
  },
});
