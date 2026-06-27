import { pingDatabase } from "@/server/db";

/**
 * System service (infrastructure, not a domain feature).
 *
 * Demonstrates the canonical flow — service orchestrates a use-case and calls the
 * hospital-scoped data-access layer; it never touches Prisma itself (09 §4). Domain
 * services (patients, encounters, billing, …) follow this shape from Step 3+, adding
 * authorization + hospital scoping + audit before they touch data.
 */
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  serverTime: Date | null;
}> {
  try {
    const { ok, now } = await pingDatabase();
    return { connected: ok, serverTime: now };
  } catch {
    return { connected: false, serverTime: null };
  }
}
