import type { AuthenticatedActor } from "@/server/services";
import { auth } from "./config";

/**
 * `server/auth` — authentication + current actor (09 §3). Re-exports the Auth.js
 * primitives and exposes `getCurrentActor()` for server components / the service
 * layer. Secrets and provider internals never reach the UI.
 */
export { handlers, auth, signIn, signOut } from "./config";

/** Resolve the authenticated actor for the current request, or null. */
export async function getCurrentActor(): Promise<AuthenticatedActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    displayName: session.user.name ?? "",
    email: session.user.email ?? "",
    roles: session.user.roles ?? [],
    hospitalIds: session.user.hospitalIds ?? [],
    hospitalId: session.user.hospitalId ?? null,
    hospitalCode: session.user.hospitalCode ?? null,
    hospitalName: session.user.hospitalName ?? null,
  };
}

export { getActiveHospitalContext } from "./active-hospital";
