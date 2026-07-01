/**
 * `server/authz` — authorization boundary (09 §6).
 *
 * Auth.js answers "who is this?"; this layer answers "may this actor do this, here?".
 * The pure capability matrix lives in `lib/rbac` (shared with the UI for nav
 * filtering); enforcement that also writes the `authz.denied` audit lives in
 * `server/services/authz-service`. A refused action fails server-side with a clear,
 * non-leaking error — hiding a button is never the control (09 §4, §13).
 */
export { type Role, type Capability, ROLE_CAPABILITIES, can, canAtHospital } from "@/lib/rbac";

/** Thrown when an actor lacks a capability. Mapped to a clean French error in the UI. */
export class AuthorizationError extends Error {
  constructor(public readonly capability: string) {
    super(`Action non autorisée: ${capability}`);
    this.name = "AuthorizationError";
  }
}
