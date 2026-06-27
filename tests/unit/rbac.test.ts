import { describe, expect, it } from "vitest";

import { type Capability, ROLE_CAPABILITIES, can } from "@/lib/rbac";

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

  it("administrateur has every capability", () => {
    const allCaps = Object.values(ROLE_CAPABILITIES).flat();
    const unique = [...new Set(allCaps)] as Capability[];
    for (const cap of unique) {
      expect(can(["administrateur"], cap)).toBe(true);
    }
    expect(can(["administrateur"], "admin.manage")).toBe(true);
  });

  it("no roles grants nothing; multiple roles union their capabilities", () => {
    expect(can([], "patient.read")).toBe(false);
    expect(can(["agent_accueil", "caissier"], "payment.record")).toBe(true);
    expect(can(["unknown_role"], "patient.read")).toBe(false);
  });
});
