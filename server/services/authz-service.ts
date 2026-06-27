import { type Capability, can, AuthorizationError } from "@/server/authz";
import type { HospitalContext } from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Authorization enforcement (09 §6). Every protected use-case calls this before
 * acting. On denial it writes an `authz.denied` audit entry (actor, hospital,
 * attempted action + entity) and throws — even if the action was attempted directly,
 * not via a disabled control.
 */
export async function requireCapability(
  actor: AuthenticatedActor,
  hospital: HospitalContext,
  capability: Capability,
  entity?: { type: string; id?: string },
): Promise<void> {
  if (can(actor.roles, capability)) return;

  await recordAudit({
    hospitalId: hospital.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.authzDenied,
    entityType: entity?.type ?? capability,
    entityId: entity?.id ?? null,
    summary: `Action refusée (${capability}) — rôle non autorisé`,
  });

  throw new AuthorizationError(capability);
}
