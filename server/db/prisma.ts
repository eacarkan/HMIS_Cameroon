import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton (D-003).
 *
 * This is the ONLY module that instantiates Prisma. Per the architecture rules
 * (09 §4, §13) the UI / pages / components never import this directly — access
 * always flows through hospital-scoped data-access functions in `server/db`,
 * which are themselves called only from `server/services`. That boundary is
 * enforced by ESLint `no-restricted-imports` (see eslint.config.mjs) rather than
 * `server-only`, so that out-of-Next scripts (seed/reset) can still use Prisma.
 *
 * Prisma 7 uses a driver adapter for the database connection (here: node-postgres
 * via `@prisma/adapter-pg`). The connection string comes from `DATABASE_URL`
 * (local PostgreSQL — fake/dev data only, A-001/D-008).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env (a local PostgreSQL is a prerequisite — see README).",
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Avoid exhausting connections via hot-reload in development.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
