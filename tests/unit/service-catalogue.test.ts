import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";
import {
  SERVICE_TYPES,
  isOutpatientConsultationService,
  isServiceType,
  normalizeDisplayOrder,
  validateServiceCatalogueInput,
} from "@/lib/service-catalogue";

describe("unit: service-catalogue validation", () => {
  const base = { code: "SRV-X", nameFr: "Service X", type: "OUTPATIENT", displayOrder: 0 };

  it("accepts a valid entry", () => {
    expect(validateServiceCatalogueInput(base).ok).toBe(true);
  });

  it("requires a code and a French name", () => {
    expect(validateServiceCatalogueInput({ ...base, code: "" }).ok).toBe(false);
    expect(validateServiceCatalogueInput({ ...base, nameFr: "  " }).ok).toBe(false);
  });

  it("rejects an invalid code charset", () => {
    expect(validateServiceCatalogueInput({ ...base, code: "bad code!" }).ok).toBe(false);
  });

  it("rejects an unknown service type", () => {
    expect(validateServiceCatalogueInput({ ...base, type: "NOPE" }).ok).toBe(false);
  });

  it("rejects a negative or non-integer displayOrder", () => {
    expect(validateServiceCatalogueInput({ ...base, displayOrder: -1 }).ok).toBe(false);
    expect(validateServiceCatalogueInput({ ...base, displayOrder: 1.5 }).ok).toBe(false);
  });

  it("enforces flag↔type consistency (isInpatientWard ⇒ INPATIENT_WARD)", () => {
    expect(
      validateServiceCatalogueInput({ ...base, type: "OUTPATIENT", isInpatientWard: true }).ok,
    ).toBe(false);
    expect(
      validateServiceCatalogueInput({ ...base, type: "INPATIENT_WARD", isInpatientWard: true }).ok,
    ).toBe(true);
  });

  it("enforces isEmergency ⇒ EMERGENCY", () => {
    expect(validateServiceCatalogueInput({ ...base, isEmergency: true }).ok).toBe(false);
    expect(
      validateServiceCatalogueInput({ ...base, type: "EMERGENCY", isEmergency: true }).ok,
    ).toBe(true);
  });

  it("isServiceType + SERVICE_TYPES cover the enum", () => {
    expect(isServiceType("PHARMACY")).toBe(true);
    expect(isServiceType("xxx")).toBe(false);
    expect(SERVICE_TYPES).toContain("CASHIER");
    expect(SERVICE_TYPES).toHaveLength(9);
  });

  it("normalizeDisplayOrder assigns sequential 0-based order", () => {
    expect(normalizeDisplayOrder(["a", "b", "c"])).toEqual([
      { id: "a", displayOrder: 0 },
      { id: "b", displayOrder: 1 },
      { id: "c", displayOrder: 2 },
    ]);
  });
});

describe("unit: RBAC — Phase 2A capability re-scope (admin is not a clinical superuser)", () => {
  it("admin gains the service-config capabilities", () => {
    expect(can(["administrateur"], "service.config.manage")).toBe(true);
    expect(can(["administrateur"], "service.config.view")).toBe(true);
  });

  it("admin is de-scoped from clinical/billing data entry", () => {
    for (const cap of [
      "patient.create",
      "encounter.create",
      "consultation.create",
      "invoice.create",
      "payment.record",
      "receipt.print",
    ] as const) {
      expect(can(["administrateur"], cap)).toBe(false);
    }
  });

  it("admin keeps oversight reads + management capabilities", () => {
    expect(can(["administrateur"], "config.manage")).toBe(true);
    expect(can(["administrateur"], "user.manage")).toBe(true);
    expect(can(["administrateur"], "patient.read")).toBe(true);
    expect(can(["administrateur"], "audit.read")).toBe(true);
  });

  it("operational roles may VIEW the catalogue but not MANAGE it", () => {
    for (const role of ["agent_accueil", "medecin", "caissier", "directeur"] as const) {
      expect(can([role], "service.config.view")).toBe(true);
      expect(can([role], "service.config.manage")).toBe(false);
    }
  });

  it("reception keeps patient entry; cashier keeps payment (unchanged)", () => {
    expect(can(["agent_accueil"], "patient.create")).toBe(true);
    expect(can(["caissier"], "payment.record")).toBe(true);
  });
});

describe("unit: isOutpatientConsultationService (Phase 2 QA — visit picker eligibility)", () => {
  const svc = (over: Partial<{ type: string; isActive: boolean; acceptsConsultation: boolean }>) => ({
    type: "OUTPATIENT",
    isActive: true,
    acceptsConsultation: true,
    ...over,
  });

  it("accepts an active OUTPATIENT service that accepts consultation", () => {
    expect(isOutpatientConsultationService(svc({}))).toBe(true);
  });

  it("excludes non-outpatient/support/inpatient types", () => {
    for (const type of [
      "SUPPORT",
      "CASHIER",
      "PHARMACY",
      "LABORATORY",
      "IMAGING",
      "INPATIENT_WARD",
      "ADMINISTRATION",
      "EMERGENCY",
    ]) {
      expect(isOutpatientConsultationService(svc({ type }))).toBe(false);
    }
  });

  it("excludes inactive services and those that do not accept consultation", () => {
    expect(isOutpatientConsultationService(svc({ isActive: false }))).toBe(false);
    expect(isOutpatientConsultationService(svc({ acceptsConsultation: false }))).toBe(false);
  });
});
