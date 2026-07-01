import { prisma } from "./prisma";

/**
 * Hospital data-access. Hospitals are the tenant root (not themselves hospital-scoped),
 * but access is contextual: a user only sees hospitals where they hold a role.
 */

/** Hospitals the user has a role in (their accessible hospitals). */
export function findHospitalsForUser(userId: string) {
  return prisma.hospital.findMany({
    where: { userRoles: { some: { userId } } },
    orderBy: { name: "asc" },
  });
}

export function findHospitalById(id: string) {
  return prisma.hospital.findUnique({ where: { id } });
}
