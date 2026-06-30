import type { Prisma, Sex } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Patient data-access — hospital-scoped (D-011, 09 §5). Every function takes a
 * `hospitalId` and filters by it; soft-deleted patients are excluded.
 */

export type CreatePatientData = {
  hospitalId: string;
  patientNumber: string;
  familyName: string;
  givenName: string;
  sex: Sex;
  dateOfBirth: Date;
  phone: string | null;
  residence: string | null;
  createdById: string;
  // Phase 2B — identity enhancements (additive).
  guardianPhone?: string | null;
  estimatedAge?: number | null;
  isEstimatedAge?: boolean;
  isTemporaryIdentity?: boolean;
  temporaryIdentifier?: string | null;
};

export function createPatient(data: CreatePatientData) {
  return prisma.patient.create({ data });
}

/** Update a patient's editable identity fields (Phase 2B identity correction). Hospital
 *  scoping is enforced at the DB layer (`where: { id, hospitalId }`) — a defense-in-depth
 *  guard beyond the service's prior `findPatientById` check. Returns the updated patient. */
export async function updatePatient(
  hospitalId: string,
  id: string,
  data: {
    familyName?: string;
    givenName?: string;
    sex?: Sex;
    dateOfBirth?: Date;
    phone?: string | null;
    guardianPhone?: string | null;
    residence?: string | null;
    estimatedAge?: number | null;
    isEstimatedAge?: boolean;
    isTemporaryIdentity?: boolean;
    updatedById?: string;
  },
) {
  await prisma.patient.updateMany({ where: { id, hospitalId }, data });
  return prisma.patient.findFirst({ where: { id, hospitalId } });
}

/** Count temporary patients already created for a hospital + day (by `Inconnu_YYMMDD_` prefix). */
export function countTemporaryPatientsForDay(hospitalId: string, dayPrefix: string) {
  return prisma.patient.count({
    where: { hospitalId, temporaryIdentifier: { startsWith: dayPrefix } },
  });
}

/** Temporary identifiers already issued for a hospital + day — for MAX(suffix)+1 numbering (3F-5). */
export async function listTemporaryIdentifiersForDay(
  hospitalId: string,
  dayPrefix: string,
): Promise<string[]> {
  const rows = await prisma.patient.findMany({
    where: { hospitalId, temporaryIdentifier: { startsWith: dayPrefix } },
    select: { temporaryIdentifier: true },
  });
  return rows.map((r) => r.temporaryIdentifier).filter((v): v is string => v !== null);
}

/** Structured patient search filters (Phase 1A Batch 1A). All optional; all hospital-scoped. */
export type PatientSearchFilters = {
  /** Free text: family name, given name, or patient number. */
  query?: string;
  /** Phone substring (matched against the stored phone). */
  phone?: string;
  /** Identifier value substring (matched against the patient's administrative identifiers). */
  identifier?: string;
  /** Exact sex filter. */
  sex?: Sex;
};

/**
 * Search patients within a hospital. Each provided filter narrows the result (AND); the
 * free-text `query` matches name OR patient number. Identifier search joins the patient's
 * (hospital-scoped, non-deleted) administrative identifiers. Soft-deleted patients excluded.
 */
export function searchPatientsAdvanced(hospitalId: string, filters: PatientSearchFilters) {
  const and: Prisma.PatientWhereInput[] = [];

  const q = filters.query?.trim();
  if (q) {
    and.push({
      OR: [
        { familyName: { contains: q, mode: "insensitive" } },
        { givenName: { contains: q, mode: "insensitive" } },
        { patientNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const phone = filters.phone?.trim();
  if (phone) and.push({ phone: { contains: phone, mode: "insensitive" } });

  const identifier = filters.identifier?.trim();
  if (identifier) {
    and.push({
      identifiers: {
        some: { hospitalId, deletedAt: null, value: { contains: identifier, mode: "insensitive" } },
      },
    });
  }

  if (filters.sex) and.push({ sex: filters.sex });

  const where: Prisma.PatientWhereInput = {
    hospitalId,
    deletedAt: null,
    ...(and.length ? { AND: and } : {}),
  };
  return prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

/** Search patients within a hospital by name or patient number (free-text convenience). */
export function searchPatients(hospitalId: string, query: string) {
  return searchPatientsAdvanced(hospitalId, { query });
}

/**
 * Coarse, hospital-scoped query for likely duplicates of new registration input
 * (Phase 1A Batch 1A): exact family+given name + date of birth, OR an exact phone match.
 * WARNING/REVIEW ONLY — callers classify precisely and never merge or block. Soft-deleted
 * patients are excluded.
 */
export function findPotentialDuplicatePatients(
  hospitalId: string,
  input: { familyName: string; givenName: string; dateOfBirth: Date; phone: string | null },
) {
  const or: Prisma.PatientWhereInput[] = [
    {
      familyName: { equals: input.familyName.trim(), mode: "insensitive" },
      givenName: { equals: input.givenName.trim(), mode: "insensitive" },
      dateOfBirth: input.dateOfBirth,
    },
  ];
  const phone = (input.phone ?? "").trim();
  if (phone) or.push({ phone });

  return prisma.patient.findMany({
    where: { hospitalId, deletedAt: null, OR: or },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

/** A single patient within a hospital, with encounters (most recent first). */
/** Phase 2F — resolve a patient by their hospital patient number (hospital-scoped). */
export function findPatientByNumber(hospitalId: string, patientNumber: string) {
  return prisma.patient.findFirst({
    where: { hospitalId, patientNumber, deletedAt: null },
    select: { id: true, patientNumber: true, familyName: true, givenName: true },
  });
}

export function findPatientById(hospitalId: string, id: string) {
  return prisma.patient.findFirst({
    where: { id, hospitalId, deletedAt: null },
    include: {
      encounters: {
        where: { deletedAt: null },
        orderBy: { openedAt: "desc" },
        include: {
          invoices: {
            where: { deletedAt: null },
            include: { payments: true },
          },
        },
      },
    },
  });
}
