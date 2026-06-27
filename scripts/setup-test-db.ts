import "dotenv/config";

import { execSync } from "node:child_process";

/**
 * One-time setup of the dedicated TEST database: create it (if missing) and push the
 * Prisma schema. Safe — refuses any DB whose name doesn't contain "test".
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const parsed = new URL(url);
const dbName = parsed.pathname.slice(1).split("?")[0];
if (!/test/i.test(dbName)) {
  console.error(
    `Refusing: "${dbName}" is not a test database (name must contain "test").`,
  );
  process.exit(1);
}

try {
  execSync(
    `createdb -h ${parsed.hostname} -p ${parsed.port || 5432} -U ${parsed.username} ${dbName}`,
    { env: { ...process.env, PGPASSWORD: parsed.password }, stdio: "ignore" },
  );
  console.log(`✓ created database ${dbName}`);
} catch {
  console.log(`• database ${dbName} already exists (ok)`);
}

execSync("npx prisma db push", {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit",
});
console.log("✓ test database schema is in sync");
