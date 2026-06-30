import {
  findHospitalById,
  findHospitalsForUser,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Hospital context service (09 §5). The active hospital is established server-side
 * from the authenticated session/selection and passed into every data-access call —
 * never trusted from a raw client parameter alone.
 */

function toContext(h: {
  id: string;
  code: string;
  name: string;
  region: string;
}): HospitalContext {
  return { hospitalId: h.id, code: h.code, name: h.name, region: h.region };
}

/** Hospitals the actor may select. */
export function getAccessibleHospitals(actor: AuthenticatedActor) {
  return findHospitalsForUser(actor.id);
}

/**
 * Validate that the actor has access to `hospitalId` and return its context — without
 * auditing. Used to resolve the active-hospital cookie on each request.
 */
export async function resolveHospitalContext(
  actor: AuthenticatedActor,
  hospitalId: string,
): Promise<HospitalContext | null> {
  if (!actor.hospitalIds.includes(hospitalId)) return null;
  const hospital = await findHospitalById(hospitalId);
  return hospital ? toContext(hospital) : null;
}

/**
 * Select the active hospital: verify access, write the `hospital.select` audit entry,
 * and return the context. The cookie is set by the calling server action.
 */
export async function selectHospital(
  actor: AuthenticatedActor,
  hospitalId: string,
): Promise<HospitalContext> {
  const context = await resolveHospitalContext(actor, hospitalId);
  if (!context) {
    // Phase 3B — record the refused cross-hospital selection (the actor is not a member of this
    // hospital). Append-only; the hospital row exists so the audit FK is satisfied.
    await recordAudit({
      hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.securityCrossHospitalDenied,
      entityType: "Hospital",
      entityId: hospitalId,
      summary: `Sélection d'hôpital refusée — accès non autorisé (${hospitalId})`,
    });
    throw new Error("Accès à cet hôpital refusé.");
  }

  await recordAudit({
    hospitalId: context.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.hospitalSelect,
    entityType: "Hospital",
    entityId: context.hospitalId,
    summary: `Sélection de l'hôpital ${context.code}`,
  });

  return context;
}
