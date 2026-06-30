import { describe, expect, it } from "vitest";

import {
  type HospitalConfigSummary,
  CONFIG_CATEGORIES,
  computeCompleteness,
  compareCompleteness,
} from "@/lib/configuration-completeness";

/**
 * Phase 3A — configuration-completeness pure calculator. A hospital is "more complete" only
 * because more of its own configuration exists (data, not code). These tests pin the category
 * predicates, the overall percentage, and the category-by-category comparison.
 */

const SETTING_KEYS = [
  "payment.modes",
  "cashier.shift.rules",
  "locale.default",
  "reporting.calendar",
  "dhis2.export",
  "backup.schedule",
  "local_server.status",
];

/** A fully-configured hospital (all 22 categories satisfied). */
const full: HospitalConfigSummary = {
  identity: { hasName: true, hasCity: true, hasRegion: true, hasCode: true },
  departmentCount: 3,
  activeServiceCount: 14,
  outpatientConsultCount: 5,
  wardCount: 4,
  cashierServiceCount: 1,
  pharmacyServiceCount: 1,
  labServiceCount: 1,
  imagingServiceCount: 1,
  diagnosticCatalogueCount: 6,
  tariffCount: 9,
  medicationCount: 6,
  stockBatchCount: 4,
  documentTemplateCount: 1,
  sequenceCount: 4,
  userCount: 9,
  adminUserCount: 1,
  roleCount: 9,
  settingKeys: SETTING_KEYS,
};

/** A barely-started site (identity + numbering + an admin only). */
const baseline: HospitalConfigSummary = {
  identity: { hasName: true, hasCity: true, hasRegion: true, hasCode: true },
  departmentCount: 0,
  activeServiceCount: 0,
  outpatientConsultCount: 0,
  wardCount: 0,
  cashierServiceCount: 0,
  pharmacyServiceCount: 0,
  labServiceCount: 0,
  imagingServiceCount: 0,
  diagnosticCatalogueCount: 0,
  tariffCount: 0,
  medicationCount: 0,
  stockBatchCount: 0,
  documentTemplateCount: 0,
  sequenceCount: 4,
  userCount: 1,
  adminUserCount: 1,
  roleCount: 1,
  settingKeys: ["locale.default"],
};

describe("computeCompleteness", () => {
  it("scores a fully-configured hospital at 100%", () => {
    const r = computeCompleteness(full);
    expect(r.total).toBe(CONFIG_CATEGORIES.length);
    expect(r.configuredCount).toBe(r.total);
    expect(r.percent).toBe(100);
    expect(r.ready).toBe(true);
  });

  it("scores a baseline site low and flags the missing categories", () => {
    const r = computeCompleteness(baseline);
    expect(r.percent).toBeLessThan(40);
    expect(r.ready).toBe(false);
    const missing = r.categories.filter((c) => !c.configured).map((c) => c.key);
    expect(missing).toContain("departments_services");
    expect(missing).toContain("tariffs");
    // The categories it DOES have at baseline:
    const ok = r.categories.filter((c) => c.configured).map((c) => c.key);
    expect(ok).toContain("hospital_identity");
    expect(ok).toContain("document_numbering");
    expect(ok).toContain("super_users");
    expect(ok).toContain("language_preference");
  });

  it("lab_radiology is satisfied by either a service OR a catalogue item", () => {
    const viaCatalogue = computeCompleteness({ ...baseline, diagnosticCatalogueCount: 3 });
    expect(viaCatalogue.categories.find((c) => c.key === "lab_radiology")?.configured).toBe(true);
    const viaService = computeCompleteness({ ...baseline, labServiceCount: 1 });
    expect(viaService.categories.find((c) => c.key === "lab_radiology")?.configured).toBe(true);
  });
});

describe("compareCompleteness", () => {
  it("marks categories that differ between two hospitals", () => {
    const rows = compareCompleteness(computeCompleteness(full), computeCompleteness(baseline));
    const dept = rows.find((r) => r.key === "departments_services");
    expect(dept).toMatchObject({ a: true, b: false, differ: true });
    const identity = rows.find((r) => r.key === "hospital_identity");
    expect(identity).toMatchObject({ a: true, b: true, differ: false });
  });
});
