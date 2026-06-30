import { PAYMENT_METHOD_FR } from "@/lib/constants";
import {
  dailyBillingBreakdown,
  visibleDashboardSections,
  type DashboardSections,
} from "@/lib/dashboard-metrics";
import { startOfToday } from "@/lib/dates";
import {
  countConsultationsSince,
  countEncountersClosedSince,
  countEncountersOpenedSince,
  countInvoicesSince,
  countOpenEncounters,
  countPatientsRegisteredSince,
  findPaymentsSince,
  recentAuditEntries,
  sumCollectionsSince,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";

/**
 * Dashboard service (06 §11; Phase 1A Batch 5): role-specific, read-only daily aggregations
 * over existing models, scoped to the active hospital and the current day. NO BI / data
 * warehouse, NO cross-hospital analytics.
 */
export type DashboardSummary = {
  sections: DashboardSections;
  patientsToday: number;
  openEncounters: number;
  encountersOpenedToday: number;
  encountersClosedToday: number;
  consultationsToday: number;
  invoicesToday: number;
  collectionsToday: number;
  byMethod: { method: string; methodLabel: string; total: number; count: number }[];
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
  const [
    patientsToday,
    openEncounters,
    encountersOpenedToday,
    encountersClosedToday,
    consultationsToday,
    invoicesToday,
    collectionsToday,
    payments,
    recent,
  ] = await Promise.all([
    countPatientsRegisteredSince(ctx.hospitalId, since),
    countOpenEncounters(ctx.hospitalId),
    countEncountersOpenedSince(ctx.hospitalId, since),
    countEncountersClosedSince(ctx.hospitalId, since),
    countConsultationsSince(ctx.hospitalId, since),
    countInvoicesSince(ctx.hospitalId, since),
    sumCollectionsSince(ctx.hospitalId, since),
    findPaymentsSince(ctx.hospitalId, since),
    recentAuditEntries(ctx.hospitalId, 8),
  ]);

  const breakdown = dailyBillingBreakdown(payments);

  return {
    // Phase 3B — section visibility uses the roles held AT the active hospital (consistent with the
    // per-hospital nav), not the cross-hospital union.
    sections: visibleDashboardSections(actor.rolesByHospital[ctx.hospitalId] ?? []),
    patientsToday,
    openEncounters,
    encountersOpenedToday,
    encountersClosedToday,
    consultationsToday,
    invoicesToday,
    collectionsToday,
    byMethod: breakdown.byMethod.map((m) => ({
      method: m.method,
      methodLabel: PAYMENT_METHOD_FR[m.method] ?? m.method,
      total: m.total,
      count: m.count,
    })),
    recent: recent.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      actorName: entry.actor?.displayName ?? null,
      createdAt: entry.createdAt,
    })),
  };
}
