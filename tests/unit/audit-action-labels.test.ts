import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_LABELS_EN,
  auditActionLabel,
} from "@/lib/constants";

/**
 * Phase 6.2B — the dashboard recent-activity feed shows a localized audit action label
 * (not the stored French summary). These tests keep the English overlay complete and
 * correct so the admin dashboard reads in the selected language and never regresses.
 */
describe("audit action labels — bilingual (Phase 6.2B)", () => {
  it("the English map covers exactly the same action codes as the French map", () => {
    const fr = Object.keys(AUDIT_ACTION_LABELS).sort();
    const en = Object.keys(AUDIT_ACTION_LABELS_EN).sort();
    expect(en).toEqual(fr);
  });

  it("no English label is empty", () => {
    for (const [code, label] of Object.entries(AUDIT_ACTION_LABELS_EN)) {
      expect(label.trim().length, `empty English label for ${code}`).toBeGreaterThan(0);
    }
  });

  it("auditActionLabel returns the English label when the locale is English", () => {
    expect(auditActionLabel("auth.login", "en")).toBe("Sign-in");
    expect(auditActionLabel("payment.record", "en")).toBe("Payment");
    expect(auditActionLabel("invoice.create", "en")).toBe("Invoice created");
  });

  it("auditActionLabel returns the French label when the locale is French", () => {
    expect(auditActionLabel("auth.login", "fr")).toBe("Connexion");
    expect(auditActionLabel("invoice.create", "fr")).toBe("Création de facture");
  });

  it("common action labels actually differ between English and French (are translated)", () => {
    for (const code of [
      "auth.login",
      "invoice.create",
      "payment.record",
      "prescription.created",
      "receipt.print",
    ]) {
      expect(AUDIT_ACTION_LABELS_EN[code]).not.toBe(AUDIT_ACTION_LABELS[code]);
    }
  });

  it("falls back to the raw action code when the code is unknown", () => {
    expect(auditActionLabel("does.not.exist", "en")).toBe("does.not.exist");
    expect(auditActionLabel("does.not.exist", "fr")).toBe("does.not.exist");
  });
});
