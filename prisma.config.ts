import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration (D-003).
 *
 * Prisma 7 no longer reads the connection URL from `schema.prisma`. The CLI
 * (migrate / db push / introspect) reads it here; the runtime PrismaClient
 * receives a Postgres driver adapter (see server/db/prisma.ts).
 *
 * Fake/local data only — the URL points at a local PostgreSQL (A-001/D-008).
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    // Re-seed the deterministic demo data after `prisma migrate reset` (Step 3).
    seed: "tsx scripts/seed.ts",
  },
});
