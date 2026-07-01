/**
 * Service / department catalogue (pure, client-safe) — Phase 2A.
 *
 * The configuration foundation every later Phase 2 module routes through. This module holds
 * the neutral service-type codes and the conservative, deterministic validation used by the
 * config service and unit-tested here. No data access, no side effects (09 §6 layering: pure
 * lib — must not import `@/server`). The `ServiceTypeCode` union MIRRORS the Prisma
 * `ServiceType` enum; keep the two in sync.
 */

/** Service-type codes (mirror of the Prisma `ServiceType` enum). */
export const SERVICE_TYPES = [
  "OUTPATIENT",
  "INPATIENT_WARD",
  "SUPPORT",
  "CASHIER",
  "PHARMACY",
  "LABORATORY",
  "IMAGING",
  "EMERGENCY",
  "ADMINISTRATION",
] as const;

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number];

export function isServiceType(value: string): value is ServiceTypeCode {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

/** The eight eligibility flags that route downstream modules to a service. */
export type ServiceEligibility = {
  acceptsQueue: boolean;
  acceptsConsultation: boolean;
  supportsBilling: boolean;
  supportsPharmacy: boolean;
  supportsLab: boolean;
  supportsImaging: boolean;
  isInpatientWard: boolean;
  isEmergency: boolean;
};

export const ELIGIBILITY_FLAGS = [
  "acceptsQueue",
  "acceptsConsultation",
  "supportsBilling",
  "supportsPharmacy",
  "supportsLab",
  "supportsImaging",
  "isInpatientWard",
  "isEmergency",
] as const satisfies readonly (keyof ServiceEligibility)[];

export type ServiceCatalogueInput = {
  code: string;
  nameFr: string;
  nameEn?: string | null;
  type: string;
  displayOrder?: number;
} & Partial<ServiceEligibility>;

/**
 * Validate a service-catalogue entry. Conservative + deterministic (unit-tested):
 * required code (restricted charset) + French name, a valid type, a non-negative integer
 * order, and eligibility-flag↔type consistency (spec §6: `isInpatientWard ⇒ INPATIENT_WARD`;
 * `isEmergency ⇒ EMERGENCY`). French messages (the official-document default).
 */
export function validateServiceCatalogueInput(input: ServiceCatalogueInput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const code = input.code?.trim() ?? "";
  if (!code) errors.push("Le code du service est obligatoire.");
  else if (!/^[A-Za-z0-9_-]+$/.test(code))
    errors.push("Le code ne doit contenir que des lettres, chiffres, tirets ou underscores.");

  if (!input.nameFr?.trim()) errors.push("Le nom (français) est obligatoire.");

  if (!isServiceType(input.type)) errors.push("Type de service invalide.");

  if (
    input.displayOrder !== undefined &&
    (!Number.isInteger(input.displayOrder) || input.displayOrder < 0)
  ) {
    errors.push("L'ordre d'affichage doit être un entier positif ou nul.");
  }

  if (input.isInpatientWard && input.type !== "INPATIENT_WARD") {
    errors.push("Un service marqué « hospitalisation » doit être de type INPATIENT_WARD.");
  }
  if (input.isEmergency && input.type !== "EMERGENCY") {
    errors.push("Un service marqué « urgences » doit être de type EMERGENCY.");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Normalize a requested ordering into sequential 0-based `displayOrder` values, preserving
 * the given id order. Pure helper for the reorder use-case (deterministic + testable).
 */
export function normalizeDisplayOrder(
  orderedIds: readonly string[],
): { id: string; displayOrder: number }[] {
  return orderedIds.map((id, index) => ({ id, displayOrder: index }));
}

/**
 * Phase 2 QA — eligibility rule for the OUTPATIENT VISIT service picker: a service may host
 * an outpatient consultation only when it is active, typed `OUTPATIENT`, and explicitly
 * `acceptsConsultation`. Support/cashier/pharmacy/lab/imaging/inpatient services are excluded.
 * Pure + unit-tested; the DB read path (`listActiveOutpatientConsultationServices`) mirrors it.
 */
export function isOutpatientConsultationService(service: {
  type: string;
  isActive: boolean;
  acceptsConsultation: boolean;
}): boolean {
  return service.isActive && service.type === "OUTPATIENT" && service.acceptsConsultation;
}

/**
 * Phase 2G — eligibility rule for the hospitalization WARD picker: a service may host an admission
 * only when it is active, typed `INPATIENT_WARD`, and explicitly flagged `isInpatientWard`. Mirrors
 * `isOutpatientConsultationService`; the DB read path (`listActiveInpatientWardServices`) mirrors it.
 * Pure + unit-tested.
 */
export function isInpatientWardService(service: {
  type: string;
  isActive: boolean;
  isInpatientWard: boolean;
}): boolean {
  return service.isActive && service.type === "INPATIENT_WARD" && service.isInpatientWard;
}
