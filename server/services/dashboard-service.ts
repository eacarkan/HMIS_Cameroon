import { PAYMENT_METHOD_FR } from "@/lib/constants";
import {
  dailyBillingBreakdown,
  visibleDashboardSections,
  type DashboardSections,
} from "@/lib/dashboard-metrics";
import { bucketByDay } from "@/lib/dashboard-series";
import { startOfToday } from "@/lib/dates";
import { can } from "@/lib/rbac";
import {
  countConsultationsSince,
  countDiagnosticOrdersSince,
  countEncountersClosedSince,
  countEncountersOpenedSince,
  countExpiringStockLots,
  countInvoicesSince,
  countInvoicesToCollect,
  countOpenEncounters,
  countPatientsRegisteredSince,
  countPendingDiagnosticOrders,
  countPrescriptionsToDispense,
  countWaitingQueueTickets,
  findPatientRegistrationDatesSince,
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

// --- Phase 6.3 S4 — executive-dashboard extras (read-only, capability-gated per block). ---

/** How far back the registrations-per-day sparkline looks. */
const TREND_DAYS = 30;
/** A lot expiring within this window counts as a pharmacy expiry alert (2D-8 wording). */
const EXPIRY_ALERT_DAYS = 90;

export type DashboardExtras = {
  /** Patients registered per day, oldest → today (TREND_DAYS buckets). */
  registrationsByDay: number[];
  /** Expiring-lot alerts — null when the role may not read stock. */
  stockAlerts: number | null;
  /** Today's lab / radiology requests — null when the role may not read diagnostics. */
  labRequestsToday: number | null;
  radiologyRequestsToday: number | null;
  /** Diagnostic orders still in the pipeline — null when not readable. */
  pendingDiagnostics: number | null;
  // --- S4.2 operational command-strip counts (each null when the role may not read it). ---
  /** Patients waiting in today's consultation queue. */
  queueWaiting: number | null;
  /** Invoices issued / partially paid, awaiting collection. */
  invoicesToCollect: number | null;
  /** Prescriptions the pharmacy still has to dispense. */
  prescriptionsToDispense: number | null;
};

/**
 * Extra executive indicators for the Phase 6.3 dashboard. Same rules as the summary:
 * read-only, hospital-scoped, current synthetic data only. Each optional block is
 * gated on the SAME capability that gates its module (stock.read / diagnostic.read),
 * so a role sees no number it could not see in the module itself.
 */
export async function getDashboardExtras(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<DashboardExtras> {
  await requireCapability(actor, ctx, "dashboard.read");
  const roles = actor.rolesByHospital[ctx.hospitalId] ?? [];

  const today = startOfToday();
  const trendSince = new Date(today);
  trendSince.setDate(trendSince.getDate() - (TREND_DAYS - 1));
  const expiryBefore = new Date(today);
  expiryBefore.setDate(expiryBefore.getDate() + EXPIRY_ALERT_DAYS);

  const canStock = can(roles, "stock.read");
  const canDiagnostics = can(roles, "diagnostic.read");
  const canQueue = can(roles, "queue.read");
  const canInvoices = can(roles, "invoice.read");
  const canPrescriptions = can(roles, "prescription.read");

  const [registrations, stockAlerts, labToday, radioToday, pending, queue, toCollect, toDispense] =
    await Promise.all([
      findPatientRegistrationDatesSince(ctx.hospitalId, trendSince),
      canStock ? countExpiringStockLots(ctx.hospitalId, expiryBefore) : Promise.resolve(null),
      canDiagnostics
        ? countDiagnosticOrdersSince(ctx.hospitalId, today, "lab")
        : Promise.resolve(null),
      canDiagnostics
        ? countDiagnosticOrdersSince(ctx.hospitalId, today, "radiology")
        : Promise.resolve(null),
      canDiagnostics ? countPendingDiagnosticOrders(ctx.hospitalId) : Promise.resolve(null),
      canQueue ? countWaitingQueueTickets(ctx.hospitalId, today) : Promise.resolve(null),
      canInvoices ? countInvoicesToCollect(ctx.hospitalId) : Promise.resolve(null),
      canPrescriptions ? countPrescriptionsToDispense(ctx.hospitalId) : Promise.resolve(null),
    ]);

  return {
    registrationsByDay: bucketByDay(
      registrations.map((r) => r.createdAt),
      TREND_DAYS,
      today,
    ),
    stockAlerts,
    labRequestsToday: labToday,
    radiologyRequestsToday: radioToday,
    pendingDiagnostics: pending,
    queueWaiting: queue,
    invoicesToCollect: toCollect,
    prescriptionsToDispense: toDispense,
  };
}
