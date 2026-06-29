import type { ServiceType } from "@prisma/client";

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

// --- Phase 1 (Gate 3) scoped lookups + mutations. Service layer enforces RBAC/audit. ---

export type CreateDepartmentData = {
  hospitalId: string;
  code: string;
  name: string;
};
export function createDepartment(data: CreateDepartmentData) {
  return prisma.department.create({ data });
}
export function findDepartmentById(hospitalId: string, id: string) {
  return prisma.department.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updateDepartment(
  id: string,
  data: { name?: string; isActive?: boolean },
) {
  return prisma.department.update({ where: { id }, data });
}

/** Phase 2A — additive service-catalogue fields (bilingual labels, type, ordering, flags). */
export type ServiceCatalogueFields = {
  nameFr?: string | null;
  nameEn?: string | null;
  type?: ServiceType;
  displayOrder?: number;
  acceptsQueue?: boolean;
  acceptsConsultation?: boolean;
  supportsBilling?: boolean;
  supportsPharmacy?: boolean;
  supportsLab?: boolean;
  supportsImaging?: boolean;
  isInpatientWard?: boolean;
  isEmergency?: boolean;
};

export type CreateServiceUnitData = {
  hospitalId: string;
  departmentId?: string | null;
  code: string;
  name: string;
  kind?: string | null;
} & ServiceCatalogueFields;
export function createServiceUnit(data: CreateServiceUnitData) {
  return prisma.serviceUnit.create({ data });
}
export function findServiceUnitById(hospitalId: string, id: string) {
  return prisma.serviceUnit.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updateServiceUnit(
  id: string,
  data: {
    name?: string;
    kind?: string | null;
    departmentId?: string | null;
    isActive?: boolean;
  } & ServiceCatalogueFields,
) {
  return prisma.serviceUnit.update({ where: { id }, data });
}

/** Catalogue view (Phase 2A): all non-deleted services, ordered for display (incl. inactive). */
export function listServiceUnitsOrdered(hospitalId: string) {
  return prisma.serviceUnit.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}

/** Active-only services for downstream pickers (Phase 2A), ordered for display. */
export function listActiveServiceUnits(hospitalId: string) {
  return prisma.serviceUnit.findMany({
    where: { hospitalId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}

/** Atomically set displayOrder for a set of services in ONE hospital (reorder use-case). */
export function reorderServiceUnits(
  hospitalId: string,
  ordered: { id: string; displayOrder: number }[],
) {
  return prisma.$transaction(
    ordered.map((o) =>
      prisma.serviceUnit.updateMany({
        where: { id: o.id, hospitalId },
        data: { displayOrder: o.displayOrder },
      }),
    ),
  );
}

/** Upsert a hospital-scoped setting (create or update its value). */
export function upsertSetting(hospitalId: string, key: string, value: string) {
  return prisma.setting.upsert({
    where: { hospitalId_key: { hospitalId, key } },
    create: { hospitalId, key, value },
    update: { value },
  });
}

export type CreateDocumentTemplateData = {
  hospitalId: string;
  type: string;
  name: string;
  header?: string | null;
  body?: string | null;
};
export function createDocumentTemplate(data: CreateDocumentTemplateData) {
  return prisma.documentTemplate.create({ data });
}
export function findDocumentTemplateById(hospitalId: string, id: string) {
  return prisma.documentTemplate.findFirst({
    where: { id, hospitalId, deletedAt: null },
  });
}
export function updateDocumentTemplate(
  id: string,
  data: {
    name?: string;
    header?: string | null;
    body?: string | null;
    isActive?: boolean;
  },
) {
  return prisma.documentTemplate.update({ where: { id }, data });
}
