import { startOfToday } from "@/lib/dates";
import {
  countOpenEncounters,
  countPatientsRegisteredSince,
  recentAuditEntries,
  sumCollectionsSince,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";

/** Dashboard service (06 §11): a few meaningful KPIs from real actions, scoped to the
 * active hospital and the current day. Read-only. */

export type DashboardSummary = {
  patientsToday: number;
  openEncounters: number;
  collectionsToday: number;
  recent: {
    id: string;
    action: string;
    summary: string;
    actorName: string | null;
    createdAt: Date;
  }[];
};

export async function getDashboardSummary(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<DashboardSummary> {
  await requireCapability(actor, ctx, "dashboard.read");

  const since = startOfToday();
  const [patientsToday, openEncounters, collectionsToday, recent] =
    await Promise.all([
      countPatientsRegisteredSince(ctx.hospitalId, since),
      countOpenEncounters(ctx.hospitalId),
      sumCollectionsSince(ctx.hospitalId, since),
      recentAuditEntries(ctx.hospitalId, 8),
    ]);

  return {
    patientsToday,
    openEncounters,
    collectionsToday,
    recent: recent.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      actorName: entry.actor?.displayName ?? null,
      createdAt: entry.createdAt,
    })),
  };
}
