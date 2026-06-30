import { describe, expect, it } from "vitest";

import {
  READINESS_CATEGORIES,
  isSupplierDependent,
  summarizeReadiness,
  validateReadinessUpdate,
} from "@/lib/site-readiness";

/**
 * Phase 3C — site-readiness pure helpers. The core rule under test: a supplier-dependent item
 * (hardware / LAN / UPS / cybersecurity) cannot be self-claimed `ready` without a verifier + evidence.
 */

describe("validateReadinessUpdate — supplier-dependent READY gate", () => {
  it("blocks `ready` on a supplier-dependent item without verifier + evidence", () => {
    expect(isSupplierDependent("hardware")).toBe(true);
    expect(validateReadinessUpdate("hardware", { status: "ready" }).ok).toBe(false);
    expect(validateReadinessUpdate("hardware", { status: "ready", verifier: "Tech X" }).ok).toBe(false);
    expect(validateReadinessUpdate("hardware", { status: "ready", evidenceNote: "PV de réception" }).ok).toBe(false);
    // With BOTH verifier and evidence → allowed.
    expect(validateReadinessUpdate("hardware", { status: "ready", verifier: "Tech X", evidenceNote: "PV" }).ok).toBe(true);
    // `needs_validation` is always allowed on a supplier-dependent item.
    expect(validateReadinessUpdate("hardware", { status: "needs_validation" }).ok).toBe(true);
  });

  it("allows `ready` on a non-supplier item without a verifier", () => {
    expect(isSupplierDependent("training")).toBe(false);
    expect(validateReadinessUpdate("training", { status: "ready" }).ok).toBe(true);
  });

  it("rejects an unknown category or invalid status", () => {
    expect(validateReadinessUpdate("not_a_category", { status: "ready" }).ok).toBe(false);
    // @ts-expect-error invalid status string
    expect(validateReadinessUpdate("training", { status: "done" }).ok).toBe(false);
  });
});

describe("summarizeReadiness", () => {
  it("computes percentReady over applicable items and the site-ready flag", () => {
    const r = summarizeReadiness([
      { status: "ready" },
      { status: "ready" },
      { status: "blocked" },
      { status: "not_applicable" }, // excluded from applicable
    ]);
    expect(r.total).toBe(4);
    expect(r.applicable).toBe(3);
    expect(r.ready).toBe(2);
    expect(r.blocked).toBe(1);
    expect(r.percentReady).toBe(67); // 2/3
    expect(r.siteReady).toBe(false);
  });

  it("is site-ready only when every applicable item is ready", () => {
    expect(summarizeReadiness([{ status: "ready" }, { status: "not_applicable" }]).siteReady).toBe(true);
    expect(summarizeReadiness([]).siteReady).toBe(false);
  });
});

describe("READINESS_CATEGORIES", () => {
  it("covers the doc-34 §6 categories incl. the four supplier-dependent ones", () => {
    const keys = READINESS_CATEGORIES.map((c) => c.key);
    for (const k of ["local_server", "db_migration", "backup", "training", "uat", "cybersecurity", "gate7_evidence"]) {
      expect(keys).toContain(k);
    }
    const supplier = READINESS_CATEGORIES.filter((c) => c.supplierDependent).map((c) => c.key).sort();
    expect(supplier).toEqual(["cybersecurity", "hardware", "lan", "ups"].sort());
  });
});
