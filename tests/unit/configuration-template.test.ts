import { describe, expect, it } from "vitest";

import {
  validateTemplateContent,
  planTemplateApply,
  summarizeTemplateContent,
  isPerInstanceSettingKey,
  asTemplateContent,
} from "@/lib/configuration-template";

/**
 * Phase 3A — configuration-template pure helpers. Validation (structure, dedupe, identity-key
 * rejection, department references) and apply planning (create vs update) are unit-tested here;
 * the guarded DB apply is covered by the integration suite.
 */

const valid = {
  departments: [
    { code: "MED-GEN", name: "Médecine générale" },
    { code: "CAISSE", name: "Caisse" },
  ],
  services: [
    { code: "SRV-MED", nameFr: "Médecine", nameEn: "Medicine", type: "OUTPATIENT", departmentCode: "MED-GEN", acceptsConsultation: true },
    { code: "SRV-CAISSE", nameFr: "Caisse", type: "CASHIER", departmentCode: "CAISSE", supportsBilling: true },
  ],
  settings: [{ key: "payment.modes", value: "especes" }],
  documentTemplates: [{ type: "receipt", name: "Reçu", header: "H", body: "B" }],
};

describe("validateTemplateContent", () => {
  it("accepts a well-formed payload and normalises flags", () => {
    const r = validateTemplateContent(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.departments).toHaveLength(2);
    expect(r.content.services[0].acceptsConsultation).toBe(true);
    expect(r.content.services[0].supportsBilling ?? false).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateTemplateContent(null).ok).toBe(false);
    expect(validateTemplateContent(42).ok).toBe(false);
  });

  it("rejects a service missing code/nameFr/type", () => {
    const r = validateTemplateContent({ ...valid, services: [{ nameFr: "x", type: "OUTPATIENT" }] });
    expect(r.ok).toBe(false);
  });

  it("rejects a duplicate department code", () => {
    const r = validateTemplateContent({
      ...valid,
      departments: [
        { code: "DUP", name: "A" },
        { code: "DUP", name: "B" },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a service referencing a department absent from the template", () => {
    const r = validateTemplateContent({
      ...valid,
      services: [{ code: "S1", nameFr: "S", type: "OUTPATIENT", departmentCode: "GHOST" }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an identity setting key in a shared template", () => {
    expect(isPerInstanceSettingKey("hospital.name")).toBe(true);
    const r = validateTemplateContent({ ...valid, settings: [{ key: "hospital.name", value: "X" }] });
    expect(r.ok).toBe(false);
  });

  it("asTemplateContent returns typed content for valid input and empty for invalid", () => {
    expect(asTemplateContent(valid).services).toHaveLength(2);
    expect(asTemplateContent("garbage").services).toHaveLength(0);
  });
});

describe("summarizeTemplateContent", () => {
  it("counts each category", () => {
    const r = validateTemplateContent(valid);
    if (!r.ok) throw new Error("invalid fixture");
    expect(summarizeTemplateContent(r.content)).toEqual({
      departments: 2,
      services: 2,
      settings: 1,
      documentTemplates: 1,
    });
  });
});

describe("planTemplateApply", () => {
  it("classifies every row as create against an empty instance", () => {
    const r = validateTemplateContent(valid);
    if (!r.ok) throw new Error("invalid fixture");
    const plan = planTemplateApply(r.content, {
      departmentCodes: [],
      serviceCodes: [],
      settingKeys: [],
      documentKeys: [],
    });
    expect(plan.created).toBe(2 + 2 + 1 + 1);
    expect(plan.updated).toBe(0);
  });

  it("classifies existing rows as update", () => {
    const r = validateTemplateContent(valid);
    if (!r.ok) throw new Error("invalid fixture");
    const plan = planTemplateApply(r.content, {
      departmentCodes: ["MED-GEN"],
      serviceCodes: ["SRV-MED"],
      settingKeys: ["payment.modes"],
      documentKeys: ["receipt::Reçu"],
    });
    expect(plan.updated).toBe(4);
    expect(plan.created).toBe(2); // CAISSE department + SRV-CAISSE service
  });
});
