/**
 * Medication catalogue rules (pure, client-safe) — Phase 2D-1.
 *
 * A hospital-scoped catalogue of medications: bilingual names, galenic form, dispensing unit,
 * optional strength. No quantities or prices here (stock = 2D-3, prescriptions = 2D-2). Validation
 * and display-order normalization only; no data access.
 */

export type MedicationInput = {
  code: string;
  nameFr: string;
  nameEn: string;
  form: string;
  unit: string;
  strength?: string | null;
};

/** A small suggested list of galenic forms for the catalogue UI (not enforced). */
export const MEDICATION_FORMS = [
  "Comprimé",
  "Gélule",
  "Sirop",
  "Suspension",
  "Injectable",
  "Pommade",
  "Collyre",
  "Suppositoire",
] as const;

export function validateMedicationInput(input: MedicationInput): { ok: boolean; error?: string } {
  if (!input.code?.trim()) return { ok: false, error: "Le code est obligatoire." };
  if (!input.nameFr?.trim()) return { ok: false, error: "Le nom (français) est obligatoire." };
  if (!input.nameEn?.trim()) return { ok: false, error: "Le nom (anglais) est obligatoire." };
  if (!input.form?.trim()) return { ok: false, error: "La forme galénique est obligatoire." };
  if (!input.unit?.trim()) return { ok: false, error: "L'unité de délivrance est obligatoire." };
  return { ok: true };
}

/** Clamp a display order to a non-negative integer (default 0). */
export function normalizeMedicationDisplayOrder(order: number | undefined): number {
  if (order === undefined || !Number.isInteger(order) || order < 0) return 0;
  return order;
}
