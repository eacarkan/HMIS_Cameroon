import { prisma } from "./prisma";

/**
 * Infrastructure-only data-access helper (NOT a business feature).
 *
 * It exists so the foundation can prove the full dependency chain end-to-end —
 * UI → action → service → data-access → Prisma — against a live PostgreSQL, while
 * every *domain* data-access function remains unwritten until Step 3+.
 *
 * As a data-access function it is the only layer permitted to touch Prisma (09 §4).
 */
export async function pingDatabase(): Promise<{
  ok: boolean;
  now: Date | null;
}> {
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return { ok: rows.length === 1, now: rows[0]?.now ?? null };
}
