import "dotenv/config";

import { getDatabaseStatus } from "@/server/services";

/**
 * Foundations connectivity check (not a demo feature). Exercises the wired flow
 * service → hospital-scoped data-access → Prisma against the live local PostgreSQL,
 * proving the dependency direction and the DB connection in one command.
 */
async function main() {
  const status = await getDatabaseStatus();
  if (status.connected) {
    console.log(
      `✓ PostgreSQL OK — server time: ${status.serverTime?.toISOString() ?? "?"}`,
    );
    process.exit(0);
  }
  console.error(
    "✗ Cannot reach PostgreSQL. Is it running? Check DATABASE_URL in .env (see README).",
  );
  process.exit(1);
}

void main();
