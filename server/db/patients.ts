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
};

export function createPatient(data: CreatePatientData) {
  return prisma.patient.create({ data });
}

/** Search patients within a hospital by name or patient number. */
export function searchPatients(hospitalId: string, query: string) {
  const q = query.trim();
  const where: Prisma.PatientWhereInput = {
    hospitalId,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { familyName: { contains: q, mode: "insensitive" } },
            { givenName: { contains: q, mode: "insensitive" } },
            { patientNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

/** A single patient within a hospital, with encounters (most recent first). */
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
