import { execSync } from "node:child_process";

/**
 * E2E global setup (Step 14): reset + seed the TEST database to the known starting
 * state before the browser suite runs. Uses `npm run db:reset` (tsx) with DATABASE_URL
 * pinned to the test DB. Safety: refuses any DB whose name doesn't contain "test".
 */
export default function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://hmis:hmis_dev_password@localhost:5432/hmis_cameroon_test?schema=public";

  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (!/test/i.test(dbName)) {
    throw new Error(
      `E2E refuses to run: database "${dbName}" is not a test database (name must contain "test").`,
    );
  }

  execSync("npm run db:reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
