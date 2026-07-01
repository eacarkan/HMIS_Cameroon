import "dotenv/config";

/**
 * Integration-test setup (Step 14). Runs before each integration test file, BEFORE any
 * Prisma import, so the client connects to the dedicated TEST database.
 *
 * Safety: integration tests reset/seed fake demo data. They refuse to run unless
 * TEST_DATABASE_URL is set AND its database name looks like a test database — so they
 * can never wipe the dev (or any non-test) database. No real data, ever.
 */
const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    "Integration tests require TEST_DATABASE_URL (a dedicated test database). " +
      "See docs/implementation-notes/STEP_14_TESTING_AND_QA.md.",
  );
}

const dbName = url.split("/").pop()?.split("?")[0] ?? "";
if (!/test/i.test(dbName) && process.env.ALLOW_NONTEST_DB !== "true") {
  throw new Error(
    `Refusing to run integration tests: database "${dbName}" does not look like a ` +
      `test database (its name must contain "test"). Set ALLOW_NONTEST_DB=true to override.`,
  );
}

process.env.DATABASE_URL = url;

// Phase 6.1 — the product no longer commits a demo password. Inject a deterministic
// SYNTHETIC value for seeding + authentication in integration tests (never a real credential).
process.env.HMIS_DEMO_SHARED_PASSWORD ??= "synthetic-demo-shared-pw";
