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
