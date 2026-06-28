import { prisma } from "./prisma";

/**
 * Configuration / master-data access — hospital-scoped (Phase 1, Gate 2). Departments,
 * service units, settings and document templates. Every read filters by `hospitalId`
 * (settings/templates may also be global where `hospitalId` is null). Consumers are
 * `server/services` / seed / tests — never the UI (ESLint-enforced). Minimal by design;
 * full admin services/UI are Gate 3/4.
 */

export function listDepartments(hospitalId: string) {
  return prisma.department.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { code: "asc" },
  });
}

export function listServiceUnits(hospitalId: string) {
  return prisma.serviceUnit.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { code: "asc" },
  });
}

/** Settings for a hospital, plus any global (hospitalId null) settings. */
export function listSettings(hospitalId: string) {
  return prisma.setting.findMany({
    where: { deletedAt: null, OR: [{ hospitalId }, { hospitalId: null }] },
    orderBy: { key: "asc" },
  });
}

export function getSetting(hospitalId: string, key: string) {
  return prisma.setting.findFirst({
    where: { key, deletedAt: null, OR: [{ hospitalId }, { hospitalId: null }] },
  });
}

export function listDocumentTemplates(hospitalId: string) {
  return prisma.documentTemplate.findMany({
    where: { deletedAt: null, OR: [{ hospitalId }, { hospitalId: null }] },
    orderBy: { type: "asc" },
  });
}
