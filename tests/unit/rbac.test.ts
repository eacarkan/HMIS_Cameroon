import { describe, expect, it } from "vitest";

import { can } from "@/lib/rbac";

describe("lib/rbac — role capabilities (09 §6, 07 §4)", () => {
  it("agent d'accueil can create/read patients but cannot record payment", () => {
    expect(can(["agent_accueil"], "patient.read")).toBe(true);
    expect(can(["agent_accueil"], "patient.create")).toBe(true);
    expect(can(["agent_accueil"], "encounter.create")).toBe(true);
    expect(can(["agent_accueil"], "payment.record")).toBe(false);
    expect(can(["agent_accueil"], "consultation.create")).toBe(false);
    expect(can(["agent_accueil"], "audit.read")).toBe(false);
  });

  it("médecin can record consultations but not payments", () => {
    expect(can(["medecin"], "consultation.create")).toBe(true);
    expect(can(["medecin"], "patient.read")).toBe(true);
    expect(can(["medecin"], "payment.record")).toBe(false);
    expect(can(["medecin"], "patient.create")).toBe(false);
  });

  it("caissier can create invoices / record payments / print receipts", () => {
    expect(can(["caissier"], "invoice.create")).toBe(true);
    expect(can(["caissier"], "payment.record")).toBe(true);
    expect(can(["caissier"], "receipt.print")).toBe(true);
    expect(can(["caissier"], "consultation.create")).toBe(false);
    expect(can(["caissier"], "patient.create")).toBe(false);
  });

  it("directeur (read-only) can read dashboard/audit but not modify", () => {
    expect(can(["directeur"], "dashboard.read")).toBe(true);
    expect(can(["directeur"], "audit.read")).toBe(true);
    expect(can(["directeur"], "patient.read")).toBe(true);
    expect(can(["directeur"], "patient.create")).toBe(false);
    expect(can(["directeur"], "encounter.create")).toBe(false);
    expect(can(["directeur"], "consultation.create")).toBe(false);
    expect(can(["directeur"], "invoice.create")).toBe(false);
    expect(can(["directeur"], "payment.record")).toBe(false);
  });

  it("administrateur manages config/tariff/user/service but is de-scoped from data entry (Phase 2A)", () => {
    expect(can(["administrateur"], "admin.manage")).toBe(true);
    expect(can(["administrateur"], "config.manage")).toBe(true);
    expect(can(["administrateur"], "tariff.manage")).toBe(true);
    expect(can(["administrateur"], "user.manage")).toBe(true);
    expect(can(["administrateur"], "service.config.manage")).toBe(true);
    // Oversight reads retained.
    expect(can(["administrateur"], "patient.read")).toBe(true);
    expect(can(["administrateur"], "audit.read")).toBe(true);
    // Clinical/billing DATA ENTRY removed — capability-based RBAC (not a clinical superuser).
    expect(can(["administrateur"], "patient.create")).toBe(false);
    expect(can(["administrateur"], "encounter.create")).toBe(false);
    expect(can(["administrateur"], "consultation.create")).toBe(false);
    expect(can(["administrateur"], "invoice.create")).toBe(false);
    expect(can(["administrateur"], "payment.record")).toBe(false);
    expect(can(["administrateur"], "receipt.print")).toBe(false);
  });

  it("administrateur is NOT a routine clinical/identity superuser (23 §6)", () => {
    expect(can(["administrateur"], "patient.identity.manage")).toBe(false);
    expect(can(["administrateur"], "clinical.structure.manage")).toBe(false);
    expect(can(["administrateur"], "patient.duplicate.manage")).toBe(false);
    expect(can(["administrateur"], "tariff.use")).toBe(false);
  });

  it("Gate 3 capabilities are scoped to the right roles", () => {
    // Reception manages patient administrative identity/contact, not clinical/tariff.
    expect(can(["agent_accueil"], "patient.identity.manage")).toBe(true);
    expect(can(["agent_accueil"], "patient.duplicate.manage")).toBe(true);
    expect(can(["agent_accueil"], "clinical.structure.manage")).toBe(false);
    expect(can(["agent_accueil"], "tariff.manage")).toBe(false);

    // Doctor manages clinical structure, not tariffs.
    expect(can(["medecin"], "clinical.structure.manage")).toBe(true);
    expect(can(["medecin"], "patient.identity.read")).toBe(true);
    expect(can(["medecin"], "patient.identity.manage")).toBe(false);
    expect(can(["medecin"], "tariff.manage")).toBe(false);
    expect(can(["medecin"], "tariff.use")).toBe(false);

    // Cashier reads + uses tariffs for billing, cannot mutate them or touch clinical data.
    expect(can(["caissier"], "tariff.read")).toBe(true);
    expect(can(["caissier"], "tariff.use")).toBe(true);
    expect(can(["caissier"], "tariff.manage")).toBe(false);
    expect(can(["caissier"], "clinical.structure.read")).toBe(false);
    expect(can(["caissier"], "patient.identity.manage")).toBe(false);

    // Director reads config but does not manage anything new.
    expect(can(["directeur"], "config.read")).toBe(true);
    expect(can(["directeur"], "config.manage")).toBe(false);
    expect(can(["directeur"], "clinical.structure.read")).toBe(false);
  });

  it("no roles grants nothing; multiple roles union their capabilities", () => {
    expect(can([], "patient.read")).toBe(false);
    expect(can(["agent_accueil", "caissier"], "payment.record")).toBe(true);
    expect(can(["unknown_role"], "patient.read")).toBe(false);
  });
});
