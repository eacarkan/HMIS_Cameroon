/**
 * RBAC matrix (pure, client-safe) — 09 §6, 07 §4.
 *
 * Coarse roles for the prototype. The detailed permission set comes post-audit; the
 * *structure* (roles → capabilities, contextual per hospital) is fixed now. Used both
 * server-side (enforcement, server/authz + authz-service) and client-side (nav
 * filtering). No side effects, no data access.
 */

export type Role =
  | "administrateur"
  | "agent_accueil"
  | "medecin"
  | "caissier"
  | "directeur"
  // Phase 2D — pharmacy roles. `pharmacien` dispenses + enters stock + requests adjustments;
  // `pharmacien_chef` (Pharmacist-in-Charge) authorises FEFO overrides + approves stock adjustments
  // (dual validation = pharmacien requests, pharmacien_chef approves).
  | "pharmacien"
  | "pharmacien_chef";

export type Capability =
  // Phase 0 capabilities.
  | "dashboard.read"
  | "patient.read"
  | "patient.create"
  | "encounter.read"
  | "encounter.create"
  | "consultation.read"
  | "consultation.create"
  | "invoice.read"
  | "invoice.create"
  | "payment.record"
  | "receipt.print"
  | "audit.read"
  | "admin.manage"
  // Phase 1 (Gate 3) capabilities. NB: the administrator manages configuration and
  // tariffs but is NOT granted routine patient-identity or clinical access (23 §6);
  // those are reception / clinician only.
  | "config.read"
  | "config.manage"
  | "patient.identity.read"
  | "patient.identity.manage"
  | "patient.duplicate.manage"
  | "clinical.structure.read"
  | "clinical.structure.manage"
  | "tariff.read"
  | "tariff.manage"
  | "tariff.use"
  // Phase 1 (Gate 5B) capabilities.
  | "cashier.report.read"
  | "user.manage"
  // Phase 2A capabilities — service/department catalogue. `manage` = Hospital Admin (and
  // Local IT Lead when assigned); `view` = operational roles, scoped to ACTIVE services.
  | "service.config.manage"
  | "service.config.view"
  // Phase 2C capabilities — cashier/billing strengthening. The cashier REQUESTS a cancellation
  // and EXECUTES an approved refund and manages their own shift; only the Hospital Administrator
  // APPROVES cancellations/refunds (cashier ≠ approver). Refund vouchers are widely readable.
  | "invoice.cancel.request"
  | "invoice.cancel.approve"
  | "refund.read"
  | "refund.execute"
  | "cashier.shift.manage"
  // Phase 2D-1 — medication catalogue. `manage` = Hospital Admin (catalogue is configuration);
  // `view` = clinicians + pharmacy + oversight (used by prescribing and dispensing later).
  | "medication.manage"
  | "medication.view"
  // Phase 2D-2 — prescriptions. `create` = doctor only (clinical act); `read` = doctor + pharmacy
  // (needed to dispense later) + oversight.
  | "prescription.create"
  | "prescription.read"
  // Phase 2D-3 — medication stock. `receive` = pharmacy (enter batches); `read` = pharmacy +
  // oversight. Adjustments (2D-7) get their own dual-validation capabilities.
  | "stock.receive"
  | "stock.read"
  // Phase 2D-4 — manual release of stale (48h non-collection) stock reservations (pharmacy + admin).
  | "reservation.release"
  // Phase 2D-6 — authorise a FEFO override (dispense from a deliberately chosen non-earliest-expiry
  // batch with a mandatory reason). Restricted to the Pharmacist-in-Charge (pharmacien_chef) only.
  | "fefo.override"
  // Phase 2D-5 — the cashier confirms the prescription was paid at the cashier; the pharmacy
  // dispenses (consuming reservations + deducting on-hand). `dispense.read` views the pharmacy
  // dispense records (batch-level decisions) — pharmacy + oversight, NOT the cashier/doctor.
  | "prescription.payment.confirm"
  | "dispense.perform"
  | "dispense.read";

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  // Hospital administrator — configuration, tariffs, users, service catalogue, and oversight
  // READS. Phase 2A applies capability-based RBAC: the admin is NOT a clinical/billing
  // superuser, so the data-entry capabilities (patient/encounter/consultation/invoice create,
  // payment.record, receipt.print) are REMOVED — entry stays with reception/clinician/cashier.
  // (This additively corrects the broad Phase 1A admin access flagged in the Phase 1A review.)
  administrateur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
    "admin.manage",
    "config.read",
    "config.manage",
    "service.config.manage",
    "service.config.view",
    "tariff.read",
    "tariff.manage",
    "cashier.report.read",
    "user.manage",
    // Phase 2C — the administrator APPROVES cancellations/refunds (cannot request or execute),
    // and can read refund vouchers for oversight. No payment/refund execution (not clinical, not
    // a cashier).
    "invoice.cancel.approve",
    "refund.read",
    // Phase 2D-1 — the administrator manages the medication catalogue (configuration).
    "medication.manage",
    "medication.view",
    // Phase 2D-2 — oversight read of prescriptions.
    "prescription.read",
    // Phase 2D-3 — oversight read of stock.
    "stock.read",
    // Phase 2D-4 — may run the 48h reservation-release sweep.
    "reservation.release",
    // Phase 2D-5 — oversight read of dispense records (not a dispenser).
    "dispense.read",
  ],
  agent_accueil: [
    "dashboard.read",
    "patient.read",
    "patient.create",
    "encounter.read",
    "encounter.create",
    "patient.identity.read",
    "patient.identity.manage",
    "patient.duplicate.manage",
    "service.config.view",
  ],
  medecin: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "consultation.create",
    "patient.identity.read",
    "clinical.structure.read",
    "clinical.structure.manage",
    "service.config.view",
    // Phase 2D-1 — the doctor reads the catalogue to prescribe (no catalogue management).
    "medication.view",
    // Phase 2D-2 — the doctor creates + reads prescriptions (clinical act).
    "prescription.create",
    "prescription.read",
  ],
  caissier: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "invoice.read",
    "invoice.create",
    "payment.record",
    "receipt.print",
    "tariff.read",
    "tariff.use",
    "cashier.report.read",
    "service.config.view",
    // Phase 2C — the cashier REQUESTS cancellations, EXECUTES approved refund vouchers, and
    // opens/closes/corrects their own Brouillard de Caisse. They cannot APPROVE (admin only).
    "invoice.cancel.request",
    "refund.read",
    "refund.execute",
    "cashier.shift.manage",
    // Phase 2D-5 — the cashier confirms a prescription was paid (collection payment), and reads
    // the prescription to do so (the confirm action lives on the prescription view).
    "prescription.payment.confirm",
    "prescription.read",
  ],
  directeur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
    "config.read",
    "cashier.report.read",
    "service.config.view",
    // Phase 2C — read-only oversight of refund vouchers.
    "refund.read",
    // Phase 2D-1 — oversight view of the medication catalogue.
    "medication.view",
    // Phase 2D-2 — oversight read of prescriptions.
    "prescription.read",
    // Phase 2D-3 — oversight read of stock.
    "stock.read",
    // Phase 2D-5 — oversight read of dispense records.
    "dispense.read",
  ],
  // Phase 2D — pharmacy roles. Baseline operational reads + catalogue view; the pharmacy-specific
  // capabilities (dispense, stock, FEFO override, adjustment approval) are added in later 2D sub-batches.
  pharmacien: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "service.config.view",
    "medication.view",
    // Phase 2D-2 — read prescriptions (needed to dispense them in 2D-5).
    "prescription.read",
    // Phase 2D-3 — receive + read medication stock.
    "stock.receive",
    "stock.read",
    // Phase 2D-4 — release stale (48h) reservations.
    "reservation.release",
    // Phase 2D-5 — dispense (consume reservations + deduct on-hand) + read dispense records.
    "dispense.perform",
    "dispense.read",
  ],
  pharmacien_chef: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "service.config.view",
    "medication.view",
    "prescription.read",
    "stock.receive",
    "stock.read",
    "reservation.release",
    "dispense.perform",
    "dispense.read",
    // Phase 2D-6 — the Pharmacist-in-Charge is the ONLY role that may authorise a FEFO override.
    "fefo.override",
  ],
};

/** True if any of the actor's roles grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) =>
    ROLE_CAPABILITIES[role as Role]?.includes(capability),
  );
}
