import type { UserStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * User data-access (the only place Prisma is called for users, 09 §4).
 *
 * Identity is global; access is contextual via UserRole/hospital (05 §7). These
 * reads include the user's role assignments so the service layer can derive the
 * actor's roles and hospital context.
 */

/** Find a user by email, including role + hospital assignments. */
export function findUserByEmailWithRoles(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: { include: { role: true, hospital: true } },
    },
  });
}

/** Find a user by id, including role + hospital assignments. */
export function findUserByIdWithRoles(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: { include: { role: true, hospital: true } },
    },
  });
}

// --- Phase 1 (Gate 5B) user lifecycle (hospital-scoped via UserRole). Service enforces RBAC/audit. ---

/** Users who have at least one role assignment in the given hospital, with those roles. */
export function listUsersForHospital(hospitalId: string) {
  return prisma.user.findMany({
    where: { userRoles: { some: { hospitalId } } },
    include: { userRoles: { where: { hospitalId }, include: { role: true } } },
    orderBy: { displayName: "asc" },
  });
}

export type CreateUserRecordData = {
  id: string;
  displayName: string;
  email: string;
  passwordHash: string;
};
export function createUserRecord(data: CreateUserRecordData) {
  return prisma.user.create({ data });
}

export function setUserStatus(id: string, status: UserStatus) {
  return prisma.user.update({ where: { id }, data: { status } });
}

/** Update a user's password hash (Phase 1A Batch 4 — change / admin reset). */
export function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export function findRoleByCode(code: string) {
  return prisma.role.findUnique({ where: { code } });
}

/** Is this user assigned to this hospital? (scoping guard for lifecycle actions.) */
export function findUserRoleInHospital(userId: string, hospitalId: string) {
  return prisma.userRole.findFirst({ where: { userId, hospitalId } });
}

export function assignUserRole(userId: string, roleId: string, hospitalId: string) {
  return prisma.userRole.upsert({
    where: { userId_roleId_hospitalId: { userId, roleId, hospitalId } },
    create: { userId, roleId, hospitalId },
    update: {},
  });
}

export function removeUserRole(userId: string, roleId: string, hospitalId: string) {
  return prisma.userRole.deleteMany({ where: { userId, roleId, hospitalId } });
}

// --- Admin-lockout safeguards (Gate 5B QA). Read-only counts the service uses to
//     guarantee at least one active administrator always remains per hospital. ---

/** Does this user hold the role (by code) in this hospital? */
export async function userHasRoleInHospital(
  userId: string,
  roleCode: string,
  hospitalId: string,
): Promise<boolean> {
  const match = await prisma.userRole.findFirst({
    where: { userId, hospitalId, role: { code: roleCode } },
    select: { id: true },
  });
  return match !== null;
}

/** Count ACTIVE users holding the role (by code) in this hospital, optionally excluding one. */
export function countActiveUsersWithRoleInHospital(
  roleCode: string,
  hospitalId: string,
  excludeUserId?: string,
): Promise<number> {
  return prisma.user.count({
    where: {
      status: "active",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      userRoles: { some: { hospitalId, role: { code: roleCode } } },
    },
  });
}

/** Count assignments of the role (by code) in this hospital, regardless of user status. */
export function countRoleAssignmentsInHospital(
  roleCode: string,
  hospitalId: string,
): Promise<number> {
  return prisma.userRole.count({
    where: { hospitalId, role: { code: roleCode } },
  });
}
