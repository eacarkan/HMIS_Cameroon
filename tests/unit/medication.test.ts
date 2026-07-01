import { describe, expect, it } from "vitest";

import {
  MEDICATION_FORMS,
  normalizeMedicationDisplayOrder,
  validateMedicationInput,
} from "@/lib/medication";

const base = {
  code: "MED-X",
  nameFr: "Médicament X",
  nameEn: "Medication X",
  form: "Comprimé",
  unit: "comprimé",
  strength: "500 mg",
};

describe("medication catalogue rules (Phase 2D-1)", () => {
  it("accepts a complete medication input", () => {
    expect(validateMedicationInput(base).ok).toBe(true);
  });

  it("requires code, both names, form and unit", () => {
    expect(validateMedicationInput({ ...base, code: " " }).ok).toBe(false);
    expect(validateMedicationInput({ ...base, nameFr: "" }).ok).toBe(false);
    expect(validateMedicationInput({ ...base, nameEn: "" }).ok).toBe(false);
    expect(validateMedicationInput({ ...base, form: "" }).ok).toBe(false);
    expect(validateMedicationInput({ ...base, unit: "" }).ok).toBe(false);
  });

  it("strength is optional", () => {
    expect(validateMedicationInput({ ...base, strength: null }).ok).toBe(true);
  });

  it("normalizes display order to a non-negative integer", () => {
    expect(normalizeMedicationDisplayOrder(5)).toBe(5);
    expect(normalizeMedicationDisplayOrder(undefined)).toBe(0);
    expect(normalizeMedicationDisplayOrder(-2)).toBe(0);
    expect(normalizeMedicationDisplayOrder(1.5)).toBe(0);
  });

  it("offers a non-empty list of galenic forms", () => {
    expect(MEDICATION_FORMS.length).toBeGreaterThan(0);
    expect(MEDICATION_FORMS).toContain("Comprimé");
  });
});
