import { AuthorizationError, can } from "@/server/authz";
import {
  type CentralHospitalAggregate,
  gatherCentralAggregates,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Central oversight service (Phase 3B). Exposes the ONLY cross-hospital read in the system, and
 * it is strictly AGGREGATE + READ-ONLY. `central.aggregate.view` is a GLOBAL capability (not bound
 * to one hospital), so it is checked against the actor's full role set — the deliberate exception
 * to per-hospital authorization. Every access is audited (`central.aggregate.accessed`). There is
 * NO patient-level central path: the returned data is per-hospital counts + a payment total only.
 */

export type CentralAggregates = {
  hospitals: CentralHospitalAggregate[];
  totals: { patientCount: number; encounterCount: number; invoiceCount: number; paidTotalFcfa: number };
};

/** Aggregate-only oversight across all hospitals. Requires `central.aggregate.view`; audited. */
export async function getCentralAggregates(
  actor: AuthenticatedActor,
): Promise<CentralAggregates> {
  if (!can(actor.roles, "central.aggregate.view")) {
    // Denied attempts are audited too (no hospital scope — this is a national read).
    await recordAudit({
      hospitalId: null,
      actorId: actor.id,
      action: AUDIT_ACTIONS.authzDenied,
      entityType: "central.aggregate.view",
      entityId: null,
      summary: "Accès à l'agrégat central refusé — rôle non autorisé",
    });
    throw new AuthorizationError("central.aggregate.view");
  }

  const hospitals = await gatherCentralAggregates();
  const totals = hospitals.reduce(
    (acc, h) => ({
      patientCount: acc.patientCount + h.patientCount,
      encounterCount: acc.encounterCount + h.encounterCount,
      invoiceCount: acc.invoiceCount + h.invoiceCount,
      paidTotalFcfa: acc.paidTotalFcfa + h.paidTotalFcfa,
    }),
    { patientCount: 0, encounterCount: 0, invoiceCount: 0, paidTotalFcfa: 0 },
  );

  await recordAudit({
    hospitalId: null,
    actorId: actor.id,
    action: AUDIT_ACTIONS.centralAggregateAccessed,
    entityType: "CentralOversight",
    entityId: null,
    summary: `Consultation de l'agrégat central — ${hospitals.length} hôpitaux (agrégats uniquement, aucune donnée patient)`,
  });

  return { hospitals, totals };
}
