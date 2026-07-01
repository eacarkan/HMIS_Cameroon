import { prisma } from "./prisma";

/**
 * Phase 4B — DHIS2 mapping-set data-access (hospital-scoped). Mapping SETS + per-local-element
 * mappings to DHIS2 PLACEHOLDERS (non-secret, non-final). No patient data; aggregate-export config only.
 */

export function listDhis2MappingSets(hospitalId: string) {
  return prisma.dhis2MappingSet.findMany({
    where: { hospitalId },
    orderBy: { code: "asc" },
    include: { mappings: { orderBy: { localElement: "asc" } } },
  });
}

export function findDhis2MappingSetById(hospitalId: string, id: string) {
  return prisma.dhis2MappingSet.findFirst({
    where: { id, hospitalId },
    include: { mappings: { orderBy: { localElement: "asc" } } },
  });
}

export function findDhis2MappingSetByCode(hospitalId: string, code: string) {
  return prisma.dhis2MappingSet.findFirst({ where: { hospitalId, code } });
}

export function createDhis2MappingSet(data: {
  hospitalId: string;
  code: string;
  name: string;
  orgUnitPlaceholder?: string;
  createdById?: string | null;
}) {
  return prisma.dhis2MappingSet.create({ data });
}

export function updateDhis2MappingSet(
  hospitalId: string,
  id: string,
  data: { name?: string; orgUnitPlaceholder?: string; isActive?: boolean },
) {
  return prisma.dhis2MappingSet.updateMany({ where: { id, hospitalId }, data });
}

export function upsertDhis2Mapping(params: {
  hospitalId: string;
  mappingSetId: string;
  localElement: string;
  dataElementPlaceholder: string;
  categoryOptionComboPlaceholder?: string | null;
}) {
  const { hospitalId, mappingSetId, localElement, dataElementPlaceholder, categoryOptionComboPlaceholder } = params;
  return prisma.dhis2Mapping.upsert({
    where: { mappingSetId_localElement: { mappingSetId, localElement } },
    create: {
      hospitalId,
      mappingSetId,
      localElement,
      dataElementPlaceholder,
      categoryOptionComboPlaceholder: categoryOptionComboPlaceholder ?? null,
    },
    update: { dataElementPlaceholder, categoryOptionComboPlaceholder: categoryOptionComboPlaceholder ?? null },
  });
}
