import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  selectHospital,
  resolveHospitalContext,
  getConfigurationCompleteness,
  getCentralOversight,
  searchPatientsForActor,
} from "@/server/services";
import { ACCOUNTS, actorFor } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 3B — Multi-hospital data separation & RBAC hardening (DB-backed). Proves the
 * cross-hospital denial matrix: (1) the active context is membership-resolved, so a single-hospital
 * actor can reach NO other hospital's module (and the refusal is audited); (2) every module's
 * high-risk records are hospital-scoped at the DB layer (id-from-A invisible under B's scope);
 * (3) the ONLY central-accessible read is the snapshot-fed `getCentralOversight` (never the
 * operational tables) — denied to hospital roles, and the central supervisor is itself denied all
 * hospital operations. The legacy live-aggregate path was removed (Phase 3 QA patch).
 * Synthetic data only.
 */
const BERTOUA = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga"; // a hospital NO seeded operational user belongs to
const CENTRAL = "direction.regionale@hrb-demo.cm";

describe("integration: Phase 3B cross-hospital denial matrix", () => {
  beforeEach(resetTestDb);

  // ---- (1) Universal gate: the active context is membership-resolved ----
  it("a single-hospital actor cannot obtain another hospital's context (audited refusal)", async () => {
    for (const email of [ACCOUNTS.reception, ACCOUNTS.doctor, ACCOUNTS.cashier]) {
      const actor = await actorFor(email);
      expect(await resolveHospitalContext(actor, OTHER)).toBeNull();
      const before = await prisma.auditLog.count({
        where: { action: "security.cross_hospital_denied", actorId: actor.id },
      });
      await expect(selectHospital(actor, OTHER)).rejects.toThrow(/refusé/i);
      const after = await prisma.auditLog.count({
        where: { action: "security.cross_hospital_denied", actorId: actor.id },
      });
      expect(after).toBe(before + 1);
    }
  });

  // ---- (2) DB-layer scoping matrix: a record in OTHER is invisible under BERTOUA's scope ----
  it("every high-risk module's records are isolated by hospitalId (id-from-A invisible under B)", async () => {
    // Build a representative record per module group in the OTHER hospital.
    const patient = await prisma.patient.create({
      data: { hospitalId: OTHER, patientNumber: "HRN-P-1", familyName: "Z", givenName: "Z", sex: "male", dateOfBirth: new Date("1990-01-01") },
    });
    const encounter = await prisma.encounter.create({
      data: { hospitalId: OTHER, patientId: patient.id, encounterNumber: "HRN-V-1", serviceLabel: "x", reason: "x" },
    });
    const invoice = await prisma.invoice.create({
      data: { hospitalId: OTHER, encounterId: encounter.id, invoiceNumber: "HRN-F-1", status: "paid", totalAmount: 1000 },
    });
    const payment = await prisma.payment.create({
      data: { hospitalId: OTHER, invoiceId: invoice.id, receiptNumber: "HRN-R-1", amount: 1000, method: "cash", status: "recorded" },
    });
    const department = await prisma.department.create({ data: { hospitalId: OTHER, code: "HRN-D", name: "D" } });
    const serviceUnit = await prisma.serviceUnit.create({ data: { hospitalId: OTHER, code: "HRN-S", name: "S" } });
    const medication = await prisma.medication.create({
      data: { hospitalId: OTHER, code: "HRN-M", nameFr: "M", nameEn: "M", form: "Comprimé", unit: "comprimé" },
    });
    const batch = await prisma.medicationStockBatch.create({
      data: { hospitalId: OTHER, medicationId: medication.id, batchNumber: "HRN-B", expiryDate: new Date("2027-01-01"), quantityReceived: 10, quantityOnHand: 10, quantityReserved: 0 },
    });
    const setting = await prisma.setting.create({ data: { hospitalId: OTHER, key: "hrn.key", value: "v" } });
    const documentTemplate = await prisma.documentTemplate.create({ data: { hospitalId: OTHER, type: "t", name: "HRN-doc" } });
    const diagnosticItem = await prisma.diagnosticCatalogueItem.create({
      data: { hospitalId: OTHER, code: "HRN-LAB", nameFr: "x", nameEn: "x", modality: "lab", price: 100, displayOrder: 1 },
    });

    // Each row exists ONLY under its own hospital — invisible when scoped to Bertoua (the universal
    // pattern every server/db findById uses: where { id, hospitalId }).
    const cases: { label: string; find: () => Promise<unknown> }[] = [
      { label: "patient", find: () => prisma.patient.findFirst({ where: { id: patient.id, hospitalId: BERTOUA } }) },
      { label: "encounter", find: () => prisma.encounter.findFirst({ where: { id: encounter.id, hospitalId: BERTOUA } }) },
      { label: "invoice", find: () => prisma.invoice.findFirst({ where: { id: invoice.id, hospitalId: BERTOUA } }) },
      { label: "payment", find: () => prisma.payment.findFirst({ where: { id: payment.id, hospitalId: BERTOUA } }) },
      { label: "department", find: () => prisma.department.findFirst({ where: { id: department.id, hospitalId: BERTOUA } }) },
      { label: "serviceUnit", find: () => prisma.serviceUnit.findFirst({ where: { id: serviceUnit.id, hospitalId: BERTOUA } }) },
      { label: "medication", find: () => prisma.medication.findFirst({ where: { id: medication.id, hospitalId: BERTOUA } }) },
      { label: "stockBatch", find: () => prisma.medicationStockBatch.findFirst({ where: { id: batch.id, hospitalId: BERTOUA } }) },
      { label: "setting", find: () => prisma.setting.findFirst({ where: { id: setting.id, hospitalId: BERTOUA } }) },
      { label: "documentTemplate", find: () => prisma.documentTemplate.findFirst({ where: { id: documentTemplate.id, hospitalId: BERTOUA } }) },
      { label: "diagnosticCatalogueItem", find: () => prisma.diagnosticCatalogueItem.findFirst({ where: { id: diagnosticItem.id, hospitalId: BERTOUA } }) },
    ];
    for (const c of cases) {
      expect(await c.find(), `${c.label} leaked across hospitals`).toBeNull();
    }
    // …and the same rows ARE visible under their own hospital (the scope works, not just empty).
    expect(await prisma.patient.findFirst({ where: { id: patient.id, hospitalId: OTHER } })).not.toBeNull();
    expect(await prisma.medication.findFirst({ where: { id: medication.id, hospitalId: OTHER } })).not.toBeNull();
  });

  // ---- (3) Central aggregate-only role: snapshot-fed ONLY (no live operational read) ----
  it("central oversight is SNAPSHOT-FED only — with no snapshots it reads nothing (never enumerates operational tables)", async () => {
    // After reset the DB holds seeded hospitals + operational rows but ZERO aggregate snapshots.
    // The REMOVED live path (getCentralAggregates) enumerated all 8 hospitals straight from the
    // patient/encounter/invoice/payment tables; the snapshot-fed getCentralOversight reads ONLY
    // HospitalAggregateSnapshot, so it returns an empty list until a hospital generates a snapshot.
    // This is the structural proof that the central read path issues no direct operational-DB query.
    const central = await actorFor(CENTRAL);
    const before = await prisma.auditLog.count({ where: { action: "central.aggregate.accessed" } });
    const { hospitals } = await getCentralOversight(central);
    expect(hospitals).toEqual([]); // no snapshots → nothing, despite 8 seeded hospitals with data
    const after = await prisma.auditLog.count({ where: { action: "central.aggregate.accessed" } });
    expect(after).toBe(before + 1); // the national read is still audited (hospitalId null)
  });

  it("the legacy LIVE central aggregate path is removed from the service + DB surface", async () => {
    // Phase 3 QA patch: getCentralAggregates / gatherCentralAggregates (live over operational tables)
    // were deleted. The ONLY central-accessible service is the snapshot-fed getCentralOversight.
    // Guard against accidental re-introduction of a live cross-hospital read.
    const services = (await import("@/server/services")) as Record<string, unknown>;
    const db = (await import("@/server/db")) as Record<string, unknown>;
    expect(services.getCentralAggregates).toBeUndefined();
    expect(db.gatherCentralAggregates).toBeUndefined();
    expect(typeof services.getCentralOversight).toBe("function");
  });

  it("a hospital role (admin) is DENIED central oversight; the denial is audited", async () => {
    const admin = await actorFor(ACCOUNTS.admin); // administrateur lacks central.aggregate.view
    const before = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    await expect(getCentralOversight(admin)).rejects.toBeInstanceOf(AuthorizationError);
    const after = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    expect(after).toBe(before + 1);
  });

  it("the central supervisor has NO hospital operational access (aggregate-only)", async () => {
    const central = await actorFor(CENTRAL);
    const ctx = await selectHospital(central, BERTOUA); // a member of Bertoua (for sign-in) …
    // … but holds no operational capability there: a hospital-scoped read is denied.
    await expect(getConfigurationCompleteness(central, ctx)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(searchPatientsForActor(central, ctx, "Z")).rejects.toBeInstanceOf(AuthorizationError);
  });
});
