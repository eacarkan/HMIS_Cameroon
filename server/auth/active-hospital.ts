import { cookies } from "next/headers";

import type { HospitalContext } from "@/server/db";
import {
  resolveHospitalContext,
  type AuthenticatedActor,
} from "@/server/services";

/** Cookie holding the actor's selected active hospital id (httpOnly, set server-side). */
export const ACTIVE_HOSPITAL_COOKIE = "active_hospital";

/**
 * Resolve the active hospital context for the current request from the cookie,
 * validating that the actor still has access (09 §5). Returns null when unset or
 * invalid — callers redirect to the hospital selector.
 */
export async function getActiveHospitalContext(
  actor: AuthenticatedActor,
): Promise<HospitalContext | null> {
  const store = await cookies();
  const id = store.get(ACTIVE_HOSPITAL_COOKIE)?.value;
  if (!id) return null;
  return resolveHospitalContext(actor, id);
}
