import { prisma } from "./prisma";

/**
 * Diagnosis-code reference data-access — Phase 2B. The ICD-10 subset is GLOBAL standard
 * data (not hospital-scoped); the per-consultation `Diagnosis` rows pick a code + label here.
 */

export function listActiveDiagnosisCodes() {
  return prisma.diagnosisCode.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}

export function findDiagnosisCodeByCode(code: string) {
  return prisma.diagnosisCode.findUnique({ where: { code } });
}
