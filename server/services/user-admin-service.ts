import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import { canAssignRole } from "@/lib/account-security";
import { validatePassword } from "@/lib/password-policy";
import {
  type HospitalContext,
  listUsersForHospital,
  createUserRecord,
  setUserStatus,
  updateUserPassword,
  findRoleByCode,
  findUserRoleInHospital,
  assignUserRole,
  removeUserRole,
  userHasRoleInHospital,
  countActiveUsersWithRoleInHospital,
  countRoleAssignmentsInHospital,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Administrator-lockout safeguards (Gate 5B QA). The active hospital must always retain at
 * least one *active* administrator, and an actor must not lock themselves out. These are
 * enforced HERE, server-side — the UI hiding/disabling controls is convenience only. Errors
 * are plain `Error`s carrying a French, user-facing message (surfaced via the action `fail()`).
 */
const ADMIN_ROLE_CODE = "administrateur";
export const LAST_ADMIN_ERROR =
  "Action refusée : au moins un administrateur actif doit rester disponible pour cet hôpital.";
export const SELF_DEACTIVATE_ERROR =
  "Action refusée : vous ne pouvez pas désactiver votre propre compte.";
export const SELF_ADMIN_REMOVAL_ERROR =
  "Action refusée : vous ne pouvez pas retirer votre propre accès administrateur.";

/**
 * User / account lifecycle service (Gate 5B, 12 §5.3). Admin-only (SYS/ADM) management of
 * users and coarse role assignments, hospital-scoped via UserRole, audited. Conservative
 * password handling: a NEW user is created with a temporary (clearly non-production) demo
 * password, bcrypt-hashed like the seed. No self-service reset, email invite, MFA, SSO or
 * production account recovery.
 */
export async function listUsers(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "user.manage");
  return listUsersForHospital(ctx.hospitalId);
}

export async function createUserForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { displayName: string; email: string; password: string; roleCode: string },
) {
  await requireCapability(actor, ctx, "user.manage", { type: "User" });
  const policy = validatePassword(input.password);
  if (!policy.ok) throw new Error(policy.errors[0]);
  if (!canAssignRole(input.roleCode)) throw new Error("Rôle non assignable.");
  const role = await findRoleByCode(input.roleCode);
  if (!role) throw new Error("Rôle inconnu.");

  const user = await createUserRecord({
    id: `user-${randomUUID()}`,
    displayName: input.displayName,
    email: input.email,
    passwordHash: bcrypt.hashSync(input.password, 10), // temporary demo password (non-production)
  });
  await assignUserRole(user.id, role.id, ctx.hospitalId);

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.userCreate,
    entityType: "User",
    entityId: user.id,
    summary: `Création de l'utilisateur ${input.displayName} (${role.name}) — mot de passe temporaire`,
  });
  return user;
}

/** Activate/deactivate a user that belongs to the active hospital (via UserRole). */
export async function setUserActive(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  userId: string,
  active: boolean,
) {
  await requireCapability(actor, ctx, "user.manage", { type: "User", id: userId });
  const assigned = await findUserRoleInHospital(userId, ctx.hospitalId);
  if (!assigned) throw new Error("Utilisateur introuvable dans cet hôpital.");

  // Admin-lockout safeguards apply only when DEACTIVATING (activation is always safe).
  if (!active) {
    // (4) An actor can never deactivate their own account.
    if (userId === actor.id) throw new Error(SELF_DEACTIVATE_ERROR);
    // (1) Deactivating an administrator must leave another active administrator behind.
    const targetIsAdmin = await userHasRoleInHospital(userId, ADMIN_ROLE_CODE, ctx.hospitalId);
    if (targetIsAdmin) {
      const otherActiveAdmins = await countActiveUsersWithRoleInHospital(
        ADMIN_ROLE_CODE,
        ctx.hospitalId,
        userId,
      );
      if (otherActiveAdmins === 0) throw new Error(LAST_ADMIN_ERROR);
    }
  }

  const user = await setUserStatus(userId, active ? "active" : "disabled");
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: active ? AUDIT_ACTIONS.userActivate : AUDIT_ACTIONS.userDeactivate,
    entityType: "User",
    entityId: userId,
    summary: `${active ? "Activation" : "Désactivation"} de l'utilisateur ${user.displayName}`,
  });
  return user;
}

export async function assignRoleForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  userId: string,
  roleCode: string,
) {
  await requireCapability(actor, ctx, "user.manage", { type: "UserRole", id: userId });
  // Role-assignment safeguard (Batch 4): only known coarse roles may be granted (no unknown
  // / over-privileged codes); admin-only is already enforced by the capability check above.
  if (!canAssignRole(roleCode)) throw new Error("Rôle non assignable.");
  const role = await findRoleByCode(roleCode);
  if (!role) throw new Error("Rôle inconnu.");
  await assignUserRole(userId, role.id, ctx.hospitalId);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.roleAssign,
    entityType: "UserRole",
    entityId: userId,
    summary: `Attribution du rôle ${role.name}`,
  });
}

/**
 * Admin password reset (Phase 1A Batch 4): an administrator sets a new password for a user
 * in the active hospital (policy-checked, bcrypt-hashed, audited). No reset tokens / email
 * (prototype). Hospital-scoped via UserRole.
 */
export async function resetUserPassword(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  userId: string,
  newPassword: string,
) {
  await requireCapability(actor, ctx, "user.manage", { type: "User", id: userId });
  const assigned = await findUserRoleInHospital(userId, ctx.hospitalId);
  if (!assigned) throw new Error("Utilisateur introuvable dans cet hôpital.");
  const policy = validatePassword(newPassword);
  if (!policy.ok) throw new Error(policy.errors[0]);

  const user = await updateUserPassword(userId, bcrypt.hashSync(newPassword, 10));
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.authPasswordReset,
    entityType: "User",
    entityId: userId,
    summary: `Réinitialisation du mot de passe — ${user.displayName}`,
  });
  return user;
}

export async function removeRoleForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  userId: string,
  roleCode: string,
) {
  await requireCapability(actor, ctx, "user.manage", { type: "UserRole", id: userId });
  const assigned = await findUserRoleInHospital(userId, ctx.hospitalId);
  if (!assigned) throw new Error("Utilisateur introuvable dans cet hôpital.");
  const role = await findRoleByCode(roleCode);
  if (!role) throw new Error("Rôle inconnu.");

  // Admin-lockout safeguards apply only when removing the ADMINISTRATOR role from a holder.
  if (role.code === ADMIN_ROLE_CODE) {
    const targetIsAdmin = await userHasRoleInHospital(userId, ADMIN_ROLE_CODE, ctx.hospitalId);
    if (targetIsAdmin) {
      // (3) An actor can never strip their own administrator access.
      if (userId === actor.id) throw new Error(SELF_ADMIN_REMOVAL_ERROR);
      // (2) The hospital must keep at least one administrator assignment.
      const adminAssignments = await countRoleAssignmentsInHospital(
        ADMIN_ROLE_CODE,
        ctx.hospitalId,
      );
      if (adminAssignments <= 1) throw new Error(LAST_ADMIN_ERROR);
    }
  }

  await removeUserRole(userId, role.id, ctx.hospitalId);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.roleRemove,
    entityType: "UserRole",
    entityId: userId,
    summary: `Retrait du rôle ${role.name}`,
  });
}
