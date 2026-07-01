"use server";

import { getDatabaseStatus } from "@/server/services";

/**
 * `server/actions` — the thin transport boundary (09 §2, §4).
 *
 * Server Actions are transport ONLY: they validate input (zod, at this edge) and
 * delegate to a service. No business logic, no Prisma, no authorization decisions
 * live here — those belong to `server/services` / `server/authz`.
 *
 * This infrastructure action carries no domain meaning; it simply exposes the
 * system health use-case to the UI to demonstrate the wired flow.
 */
export async function checkDatabaseAction() {
  return getDatabaseStatus();
}
