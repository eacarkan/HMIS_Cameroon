import { findUserByEmailWithRoles } from "@/server/db";

import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Demo service (Phase 6C / corrected in 6.1). Records a `demo.session_requested` audit for
 * a flag-gated one-click demo login REQUEST, resolving the synthetic seeded account
 * server-side.
 *
 * SEMANTICS (6.1C): this is written AFTER the one-click pre-checks pass but BEFORE the
 * sign-in resolves, so it accurately means "a one-click demo login was requested and passed
 * pre-checks" — NOT that a session actually started. The confirmed successful session is
 * recorded separately by `auth.login` (from `authenticateCredentials`). This does not
 * authenticate and does not bypass the F-02 account lockout. If the (synthetic) account is
 * unknown, this is a no-op — it never records for an unknown email.
 */
export async function recordDemoSessionRequest(email: string): Promise<void> {
  const user = await findUserByEmailWithRoles(email);
  if (!user) return;
  const hospitalId = user.userRoles[0]?.hospitalId ?? null;
  await recordAudit({
    hospitalId,
    actorId: user.id,
    action: AUDIT_ACTIONS.demoSessionRequested,
    entityType: "User",
    entityId: user.id,
    summary: `Session de démonstration (un clic) demandée — ${user.displayName}`,
  });
}
