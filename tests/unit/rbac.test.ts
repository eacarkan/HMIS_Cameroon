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

  it("Phase 2C — cashier requests/executes; admin approves (cashier ≠ approver)", () => {
    // Cashier REQUESTS cancellations, EXECUTES refunds, manages their own Brouillard — never approves.
    expect(can(["caissier"], "invoice.cancel.request")).toBe(true);
    expect(can(["caissier"], "refund.execute")).toBe(true);
    expect(can(["caissier"], "cashier.shift.manage")).toBe(true);
    expect(can(["caissier"], "invoice.cancel.approve")).toBe(false);

    // Administrator APPROVES cancellations/refunds — never requests, executes, or runs a shift.
    expect(can(["administrateur"], "invoice.cancel.approve")).toBe(true);
    expect(can(["administrateur"], "refund.read")).toBe(true);
    expect(can(["administrateur"], "invoice.cancel.request")).toBe(false);
    expect(can(["administrateur"], "refund.execute")).toBe(false);
    expect(can(["administrateur"], "cashier.shift.manage")).toBe(false);

    // Director has read-only oversight of refunds, no execution/approval.
    expect(can(["directeur"], "refund.read")).toBe(true);
    expect(can(["directeur"], "invoice.cancel.approve")).toBe(false);
    expect(can(["directeur"], "cashier.shift.manage")).toBe(false);
  });

  it("Phase 2D-1 — medication catalogue: admin manages, clinicians/pharmacy view", () => {
    // Admin manages the catalogue (configuration); also views it.
    expect(can(["administrateur"], "medication.manage")).toBe(true);
    expect(can(["administrateur"], "medication.view")).toBe(true);
    // Clinicians and pharmacy view but do not manage.
    expect(can(["medecin"], "medication.view")).toBe(true);
    expect(can(["medecin"], "medication.manage")).toBe(false);
    expect(can(["pharmacien"], "medication.view")).toBe(true);
    expect(can(["pharmacien"], "medication.manage")).toBe(false);
    expect(can(["pharmacien_chef"], "medication.view")).toBe(true);
    expect(can(["pharmacien_chef"], "medication.manage")).toBe(false);
    expect(can(["directeur"], "medication.view")).toBe(true);
    // Reception is not part of the medication flow.
    expect(can(["agent_accueil"], "medication.view")).toBe(false);
    // Pharmacy roles are not clinical/billing data-entry actors (de-scoped).
    expect(can(["pharmacien"], "consultation.create")).toBe(false);
    expect(can(["pharmacien"], "payment.record")).toBe(false);
    expect(can(["pharmacien"], "invoice.create")).toBe(false);
  });

  it("Phase 2D-2 — prescriptions: doctor creates; pharmacy/oversight read; others none", () => {
    expect(can(["medecin"], "prescription.create")).toBe(true);
    expect(can(["medecin"], "prescription.read")).toBe(true);
    // Pharmacy reads (to dispense later) but does not prescribe.
    expect(can(["pharmacien"], "prescription.read")).toBe(true);
    expect(can(["pharmacien"], "prescription.create")).toBe(false);
    expect(can(["pharmacien_chef"], "prescription.read")).toBe(true);
    // Oversight reads.
    expect(can(["administrateur"], "prescription.read")).toBe(true);
    expect(can(["directeur"], "prescription.read")).toBe(true);
    expect(can(["administrateur"], "prescription.create")).toBe(false);
    // Reception and cashier are not in the prescription flow.
    expect(can(["agent_accueil"], "prescription.read")).toBe(false);
    expect(can(["caissier"], "prescription.create")).toBe(false);
  });

  it("Phase 2D-3 — stock: pharmacy receives + reads; oversight reads; others none", () => {
    expect(can(["pharmacien"], "stock.receive")).toBe(true);
    expect(can(["pharmacien"], "stock.read")).toBe(true);
    expect(can(["pharmacien_chef"], "stock.receive")).toBe(true);
    // Oversight reads but cannot receive (not pharmacy).
    expect(can(["administrateur"], "stock.read")).toBe(true);
    expect(can(["administrateur"], "stock.receive")).toBe(false);
    expect(can(["directeur"], "stock.read")).toBe(true);
    expect(can(["directeur"], "stock.receive")).toBe(false);
    // Reception/doctor/cashier are not in the stock flow.
    expect(can(["agent_accueil"], "stock.read")).toBe(false);
    expect(can(["medecin"], "stock.receive")).toBe(false);
    expect(can(["caissier"], "stock.read")).toBe(false);
  });

  it("Phase 2D-5 — cashier confirms payment; pharmacy dispenses (separated)", () => {
    expect(can(["caissier"], "prescription.payment.confirm")).toBe(true);
    // The cashier reads the prescription to confirm payment, but NEVER dispenses or reads pharmacy
    // dispense records (segregation of duties).
    expect(can(["caissier"], "prescription.read")).toBe(true);
    expect(can(["caissier"], "dispense.perform")).toBe(false);
    expect(can(["caissier"], "dispense.read")).toBe(false);
    expect(can(["pharmacien"], "dispense.perform")).toBe(true);
    expect(can(["pharmacien_chef"], "dispense.perform")).toBe(true);
    expect(can(["pharmacien"], "prescription.payment.confirm")).toBe(false);
    // Doctor/admin neither confirm payment nor dispense.
    expect(can(["medecin"], "dispense.perform")).toBe(false);
    expect(can(["medecin"], "prescription.payment.confirm")).toBe(false);
    expect(can(["administrateur"], "dispense.perform")).toBe(false);
  });

  it("Phase 2D-5 — dispense records (`dispense.read`): pharmacy performs+reads; oversight reads; cashier/doctor cannot", () => {
    // Pharmacy both performs and reads.
    expect(can(["pharmacien"], "dispense.read")).toBe(true);
    expect(can(["pharmacien_chef"], "dispense.read")).toBe(true);
    // Oversight reads dispense records but never performs.
    expect(can(["administrateur"], "dispense.read")).toBe(true);
    expect(can(["administrateur"], "dispense.perform")).toBe(false);
    expect(can(["directeur"], "dispense.read")).toBe(true);
    expect(can(["directeur"], "dispense.perform")).toBe(false);
    // The cashier (payment) and doctor (clinical) are NOT in the dispensing read surface.
    expect(can(["caissier"], "dispense.read")).toBe(false);
    expect(can(["medecin"], "dispense.read")).toBe(false);
    expect(can(["agent_accueil"], "dispense.read")).toBe(false);
  });

  it("Phase 2D-7 — stock adjustments: pharmacist requests, Pharmacist-in-Charge approves (requester ≠ approver)", () => {
    // The pharmacist REQUESTS but cannot approve.
    expect(can(["pharmacien"], "stock.adjustment.request")).toBe(true);
    expect(can(["pharmacien"], "stock.adjustment.approve")).toBe(false);
    // The Pharmacist-in-Charge APPROVES but does not self-request (role split mirrors 2C).
    expect(can(["pharmacien_chef"], "stock.adjustment.approve")).toBe(true);
    expect(can(["pharmacien_chef"], "stock.adjustment.request")).toBe(false);
    // No one else touches adjustments.
    expect(can(["administrateur"], "stock.adjustment.request")).toBe(false);
    expect(can(["administrateur"], "stock.adjustment.approve")).toBe(false);
    expect(can(["directeur"], "stock.adjustment.approve")).toBe(false);
    expect(can(["medecin"], "stock.adjustment.request")).toBe(false);
    expect(can(["caissier"], "stock.adjustment.request")).toBe(false);
  });

  it("Phase 2D-6 — FEFO override is the Pharmacist-in-Charge ONLY", () => {
    expect(can(["pharmacien_chef"], "fefo.override")).toBe(true);
    // A regular pharmacist follows FEFO and cannot override.
    expect(can(["pharmacien"], "fefo.override")).toBe(false);
    expect(can(["administrateur"], "fefo.override")).toBe(false);
    expect(can(["directeur"], "fefo.override")).toBe(false);
    expect(can(["medecin"], "fefo.override")).toBe(false);
    expect(can(["caissier"], "fefo.override")).toBe(false);
  });

  it("Phase 2D-4 — the 48h reservation-release sweep is pharmacy + admin only", () => {
    expect(can(["pharmacien"], "reservation.release")).toBe(true);
    expect(can(["pharmacien_chef"], "reservation.release")).toBe(true);
    expect(can(["administrateur"], "reservation.release")).toBe(true);
    expect(can(["medecin"], "reservation.release")).toBe(false);
    expect(can(["directeur"], "reservation.release")).toBe(false);
    expect(can(["caissier"], "reservation.release")).toBe(false);
  });

  it("Phase 2E — operational reports: admin reads+exports; director reads only; others none", () => {
    expect(can(["administrateur"], "report.operational.read")).toBe(true);
    expect(can(["administrateur"], "report.export")).toBe(true);
    // The director has read-only aggregate oversight — NO export.
    expect(can(["directeur"], "report.operational.read")).toBe(true);
    expect(can(["directeur"], "report.export")).toBe(false);
    // Cashier keeps their own cashier report, not the operational one; clinicians/reception none.
    expect(can(["caissier"], "report.operational.read")).toBe(false);
    expect(can(["caissier"], "report.export")).toBe(false);
    expect(can(["medecin"], "report.operational.read")).toBe(false);
    expect(can(["agent_accueil"], "report.operational.read")).toBe(false);
    expect(can(["pharmacien"], "report.export")).toBe(false);
  });

  it("Phase 2F — queue: reception/doctor manage+urgent, pharmacy manage, others read-only or none", () => {
    // Reception (triage desk) + doctor: read, manage, urgent.
    for (const role of ["agent_accueil", "medecin"]) {
      expect(can([role], "queue.read")).toBe(true);
      expect(can([role], "queue.manage")).toBe(true);
      expect(can([role], "queue.urgent")).toBe(true);
    }
    // Pharmacy: read + manage, but NOT the triage urgent override.
    expect(can(["pharmacien"], "queue.manage")).toBe(true);
    expect(can(["pharmacien"], "queue.urgent")).toBe(false);
    // Cashier / director / admin: read-only oversight, no manage/urgent.
    for (const role of ["caissier", "directeur", "administrateur"]) {
      expect(can([role], "queue.read")).toBe(true);
      expect(can([role], "queue.manage")).toBe(false);
      expect(can([role], "queue.urgent")).toBe(false);
    }
  });

  it("Phase 2H — emergency: triage/doctor flag; cashier accrues/settles; ONLY the Director waives", () => {
    // Flag: reception (triage) + doctor.
    expect(can(["agent_accueil"], "emergency.flag")).toBe(true);
    expect(can(["medecin"], "emergency.flag")).toBe(true);
    expect(can(["caissier"], "emergency.flag")).toBe(false);
    // Accrue + settle: cashier (financial). Doctor/reception cannot accrue.
    expect(can(["caissier"], "emergency.debt.accrue")).toBe(true);
    expect(can(["caissier"], "emergency.debt.settle")).toBe(true);
    expect(can(["medecin"], "emergency.debt.accrue")).toBe(false);
    // WAIVE is the Hospital Director ONLY.
    expect(can(["directeur"], "emergency.debt.waive")).toBe(true);
    expect(can(["caissier"], "emergency.debt.waive")).toBe(false);
    expect(can(["administrateur"], "emergency.debt.waive")).toBe(false);
    expect(can(["medecin"], "emergency.debt.waive")).toBe(false);
    // Read (ledger): clinical + financial + oversight.
    for (const role of ["agent_accueil", "medecin", "caissier", "directeur", "administrateur"]) {
      expect(can([role], "emergency.debt.read")).toBe(true);
    }
  });

  it("Phase 2G — hospitalization: doctor requests/discharges; admission desk assigns + charges; reads broad", () => {
    // Request + discharge: doctor only (clinical acts).
    expect(can(["medecin"], "admission.request")).toBe(true);
    expect(can(["medecin"], "admission.discharge")).toBe(true);
    expect(can(["agent_accueil"], "admission.request")).toBe(false);
    expect(can(["agent_accueil"], "admission.discharge")).toBe(false);
    expect(can(["caissier"], "admission.discharge")).toBe(false);
    // Ward assignment: admission desk / head nurse (reception), NOT the doctor or cashier.
    expect(can(["agent_accueil"], "admission.assign")).toBe(true);
    expect(can(["medecin"], "admission.assign")).toBe(false);
    expect(can(["caissier"], "admission.assign")).toBe(false);
    // Daily fee (billing act): admission desk + cashier; not the doctor; not the admin.
    expect(can(["agent_accueil"], "admission.fee.charge")).toBe(true);
    expect(can(["caissier"], "admission.fee.charge")).toBe(true);
    expect(can(["medecin"], "admission.fee.charge")).toBe(false);
    expect(can(["administrateur"], "admission.fee.charge")).toBe(false);
    // The admin is NOT a clinical/billing superuser here — read-only oversight only.
    expect(can(["administrateur"], "admission.request")).toBe(false);
    expect(can(["administrateur"], "admission.assign")).toBe(false);
    // Read: clinical + admission desk + financial + oversight.
    for (const role of ["agent_accueil", "medecin", "caissier", "directeur", "administrateur"]) {
      expect(can([role], "admission.read")).toBe(true);
    }
  });

  it("Phase 2I — diagnostics: doctor requests; cashier pays; technician enters; validator validates", () => {
    // Request + read: doctor (results hidden until validated, enforced in the service).
    expect(can(["medecin"], "diagnostic.request")).toBe(true);
    expect(can(["medecin"], "diagnostic.read")).toBe(true);
    expect(can(["agent_accueil"], "diagnostic.request")).toBe(false);
    // Payment: cashier only.
    expect(can(["caissier"], "diagnostic.payment.confirm")).toBe(true);
    expect(can(["medecin"], "diagnostic.payment.confirm")).toBe(false);
    expect(can(["technicien_diagnostic"], "diagnostic.payment.confirm")).toBe(false);
    // Enter ≠ validate: the technician enters; only the validator validates.
    expect(can(["technicien_diagnostic"], "diagnostic.result.enter")).toBe(true);
    expect(can(["technicien_diagnostic"], "diagnostic.validate")).toBe(false);
    expect(can(["validateur_diagnostic"], "diagnostic.validate")).toBe(true);
    expect(can(["validateur_diagnostic"], "diagnostic.result.enter")).toBe(false);
    expect(can(["medecin"], "diagnostic.result.enter")).toBe(false);
    expect(can(["medecin"], "diagnostic.validate")).toBe(false);
    // Catalogue: admin only (Lead Tech mapping deferred).
    expect(can(["administrateur"], "diagnostic.catalogue.manage")).toBe(true);
    expect(can(["technicien_diagnostic"], "diagnostic.catalogue.manage")).toBe(false);
    // Read: clinical + diagnostics staff + financial + oversight.
    for (const role of ["medecin", "caissier", "directeur", "administrateur", "technicien_diagnostic", "validateur_diagnostic"]) {
      expect(can([role], "diagnostic.read")).toBe(true);
    }
    // Diagnostics staff are NOT clinical/billing/admin superusers.
    expect(can(["technicien_diagnostic"], "consultation.create")).toBe(false);
    expect(can(["validateur_diagnostic"], "invoice.create")).toBe(false);
    expect(can(["technicien_diagnostic"], "admin.manage")).toBe(false);
  });

  it("no roles grants nothing; multiple roles union their capabilities", () => {
    expect(can([], "patient.read")).toBe(false);
    expect(can(["agent_accueil", "caissier"], "payment.record")).toBe(true);
    expect(can(["unknown_role"], "patient.read")).toBe(false);
  });
});
