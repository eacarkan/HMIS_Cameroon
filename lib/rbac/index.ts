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
  | "pharmacien_chef"
  // Phase 2I — diagnostics roles. `technicien_diagnostic` enters lab/radiology results;
  // `validateur_diagnostic` validates them (the enter ≠ validate clinical control).
  | "technicien_diagnostic"
  | "validateur_diagnostic"
  // Phase 3B — central oversight role. Aggregate-only, cross-hospital, READ-ONLY: it sees
  // per-hospital AGGREGATE counts (never patient-level data) and holds NO hospital operational
  // capability. The one deliberate cross-hospital role (national/regional supervision).
  | "superviseur_central";

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
  // Phase 2E — hospital operational reporting + the DHIS2-aligned AGGREGATE CSV export (no patient
  // identifiers). `read` = aggregate report views (admin + director oversight); `export` = run the
  // audited CSV export (admin only). Cross-hospital denied; the cashier keeps `cashier.report.read`.
  | "report.operational.read"
  | "report.export"
  // Phase 2F — simple per-service digital queue. `read` = view the queue board; `manage` = add a
  // patient + advance status; `urgent` = the triage override that jumps the line (audited).
  | "queue.read"
  | "queue.manage"
  | "queue.urgent"
  // Phase 2H — emergency "treat first, pay later" exception. `flag` = triage/doctor flags the
  // encounter emergency (lets dispensing bypass the paid-check); `debt.accrue`/`debt.settle` =
  // cashier records/settles Emergency Debt; `debt.waive` = Hospital Director ONLY (mandatory reason);
  // `debt.read` = view the debt ledger (clinical + financial + oversight).
  | "emergency.flag"
  | "emergency.debt.read"
  | "emergency.debt.accrue"
  | "emergency.debt.settle"
  | "emergency.debt.waive"
  // Phase 2G — simple ward-level hospitalization. `request` = doctor requests/cancels an admission;
  // `assign` = admission desk / head nurse assigns a ward (starts the daily ward fee); `discharge` =
  // doctor requests + authorises discharge (the financial gate blocks it while money is owed);
  // `fee.charge` = generate a daily ward fee (a billing act — admission desk + cashier); `read` =
  // view admissions (clinical + admission desk + financial + oversight).
  | "admission.read"
  | "admission.request"
  | "admission.assign"
  | "admission.discharge"
  | "admission.fee.charge"
  // Phase 2I — manual lab & radiology. `request` = doctor orders a test/exam; `read` = view orders
  // (the RESULT stays hidden from the doctor until validated, enforced in the service); `payment.confirm`
  // = cashier validates payment; `result.enter` = technician enters the manual result; `validate` =
  // biologist/radiologist validates; `catalogue.manage` = Admin/Lead Tech maintains the catalogue.
  | "diagnostic.request"
  | "diagnostic.read"
  | "diagnostic.payment.confirm"
  | "diagnostic.result.enter"
  | "diagnostic.validate"
  | "diagnostic.catalogue.manage"
  // Phase 2A capabilities — service/department catalogue. `manage` = Hospital Admin (and
  // Local IT Lead when assigned); `view` = operational roles, scoped to ACTIVE services.
  | "service.config.manage"
  | "service.config.view"
  // Phase 3A capabilities — multi-hospital configuration foundation. `config.template.manage` =
  // create/update hospital-agnostic configuration templates (Hospital Admin). `config.instance.manage`
  // = apply a template to + override this hospital's instance configuration (Hospital Admin).
  // `config.view` = read the per-hospital completeness dashboard + Bertoua/Ebolowa comparison
  // (Hospital Admin + Director; the "Local IT Lead" role maps onto these for the prototype).
  // All three are server-enforced and hospital-scoped; cross-hospital config is denied.
  | "config.template.manage"
  | "config.instance.manage"
  | "config.view"
  // Phase 3B — central aggregate oversight. `central.aggregate.view` is the ONLY cross-hospital
  // capability: read-only, AGGREGATE-only (per-hospital counts), never patient-level. It is a GLOBAL
  // capability (not bound to one hospital), so it is checked against the actor's full role set —
  // unlike every hospital-scoped capability, which is checked against the active hospital's roles.
  | "central.aggregate.view"
  // Phase 3C capabilities — site-readiness & deployment checklist (status tracking only).
  // `readiness.manage` = update checklist items (Hospital Admin / Local IT Lead). `readiness.view`
  // = read-only checklist + status dashboard (Director + central aggregate viewer). Hospital-scoped.
  | "readiness.manage"
  | "readiness.view"
  // Phase 3E capabilities — UAT evidence + Gate 7 readiness (evidence only). `uat.manage` = record
  // UAT executions + set Gate 7 criteria (Hospital Admin). `uat.signoff_placeholder` = set the
  // Director/MINSANTE sign-off PLACEHOLDERS (Director). `uat.view` = read-only (Director + central).
  | "uat.manage"
  | "uat.signoff_placeholder"
  | "uat.view"
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
  // Phase 2D-7 — dual-validated stock adjustments: a `pharmacien` REQUESTS (correction / loss /
  // expired-stock removal); the `pharmacien_chef` APPROVES or REJECTS (requester ≠ approver).
  | "stock.adjustment.request"
  | "stock.adjustment.approve"
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
  | "dispense.read"
  // Phase 4A — integration framework & external-system registry (mock/sandbox-first; no live calls).
  // `integration.system.manage` = create/configure external systems + connectors + run mock jobs
  // (Hospital Admin — an INTEGRATION-admin capability, deliberately SEPARATE from clinical roles).
  // `integration.job.view` = read the registry + job list/status (admin + director oversight).
  // `integration.job.retry` = retry a failed job (admin). All hospital-scoped; cross-hospital denied.
  | "integration.system.manage"
  | "integration.job.view"
  | "integration.job.retry"
  // Phase 4B — DHIS2 configurable export / API-readiness (aggregate-only; mock API; no real codes).
  // `dhis2.mapping.manage` = create/edit DHIS2 mapping sets (Hospital Admin). `dhis2.export.run` =
  // validate + run the (CSV / mock-API) aggregate export (Hospital Admin). Hospital-scoped.
  | "dhis2.mapping.manage"
  | "dhis2.export.run"
  // Phase 4C — external lab/radiology result import (STAGING → review; importer ≠ reviewer).
  // `external_result.import` = stage imported results (Hospital Admin — the import/integration side).
  // `external_result.review` = review the queue + promote (into the clinical record via the existing
  // Phase 2I path) or reject (diagnostics technician — a reviewer DISTINCT from the importer, and the
  // promoted result is still hidden until a SEPARATE validator validates it). Hospital-scoped.
  | "external_result.import"
  | "external_result.review"
  // Phase 4D — payment provider abstraction (mock only; no real API). `external_payment.view` = see the
  // provider registry + transactions (finance + oversight). `external_payment.reconcile` = create mock
  // intents, run the mock status machine, and reconcile a CONFIRMED transaction against its invoice
  // through the EXISTING billing rule (finance = cashier; also holds payment.record). Hospital-scoped.
  | "external_payment.view"
  | "external_payment.reconcile"
  // Phase 4E — insurance / mutuelle foundation (manual only; no insurer API). `payer.manage` = manage
  // the payer registry + coverage profiles (Hospital Admin). `claim.manage` = link patient coverage,
  // set eligibility placeholders, run pre-auth + claim-draft workflows (billing/finance = cashier +
  // admin). All manual statuses; no auto-submission. Hospital-scoped; cross-hospital denied.
  | "payer.manage"
  | "claim.manage"
  // Phase 4F — advanced reporting / analytics foundation (aggregate-only; no AI; no patient-level
  // central disclosure). `analytics.report.manage` = create/toggle saved report definitions, run them,
  // and export aggregate output (Hospital Admin). `analytics.report.view` = view definitions / runs /
  // exports (Admin + Director). Hospital-scoped; reuses the aggregate operational report only.
  | "analytics.report.manage"
  | "analytics.report.view"
  // Phase 4G — patient-matching / MPI readiness (local, warning-only, manual review, NO auto-merge).
  // `patient_match.review` = review LOCAL duplicate candidates + record decisions (a local hospital
  // identity/admin role — NOT clinical, NOT the central supervisor). `patient_match.configure` = the
  // (optional) admin toggle for the mock MPI adapter. Hospital-scoped; cross-hospital denied; central
  // supervisor can never see patient-level candidates.
  | "patient_match.review"
  | "patient_match.configure";

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
    // Phase 3A — the Hospital Admin manages configuration templates, applies them to a hospital
    // instance (scoped), overrides instance config, and reads the completeness dashboard.
    "config.template.manage",
    "config.instance.manage",
    "config.view",
    // Phase 3C — the Hospital Admin maintains + reads the site-readiness checklist.
    "readiness.manage",
    "readiness.view",
    // Phase 3E — the Hospital Admin records UAT executions + maintains the Gate 7 checklist (+ reads).
    "uat.manage",
    "uat.view",
    "tariff.read",
    "tariff.manage",
    "cashier.report.read",
    "user.manage",
    // Phase 2E — the administrator views operational reports AND runs the audited DHIS2 CSV export.
    "report.operational.read",
    "report.export",
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
    // Phase 2F — oversight view of the queue board.
    "queue.read",
    // Phase 2H — oversight read of the emergency-debt ledger (admin cannot flag/waive).
    "emergency.debt.read",
    // Phase 2G — oversight read of admissions (admin does not admit/assign/discharge/charge).
    "admission.read",
    // Phase 2I — the admin maintains the lab/radiology catalogue + reads orders (oversight).
    "diagnostic.catalogue.manage",
    "diagnostic.read",
    // Phase 4A — the Hospital Admin is the INTEGRATION administrator (separate from clinical roles):
    // manages external systems + connectors, runs mock jobs, and views + retries jobs.
    "integration.system.manage",
    "integration.job.view",
    "integration.job.retry",
    // Phase 4B — the Hospital Admin manages DHIS2 mappings + runs the aggregate export (CSV / mock API).
    "dhis2.mapping.manage",
    "dhis2.export.run",
    // Phase 4C — the Hospital Admin stages external result imports (the integration/import side; a
    // separate diagnostics reviewer promotes/validates — the admin cannot review its own imports).
    "external_result.import",
    // Phase 4D — oversight view of the mock payment provider registry + transactions (no reconcile).
    "external_payment.view",
    // Phase 4E — the Hospital Admin manages the payer registry + coverage profiles, and can run the
    // insurance claim/coverage workflow (billing-linked; manual only).
    "payer.manage",
    "claim.manage",
    // Phase 4F — the Hospital Admin defines, runs and exports aggregate analytics reports.
    "analytics.report.manage",
    "analytics.report.view",
    // Phase 4G — the Hospital Admin (local identity/admin role) reviews LOCAL duplicate candidates and
    // records decisions; NOT clinical, NOT central. Warning-only, manual, no auto-merge.
    "patient_match.review",
    "patient_match.configure",
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
    // Phase 2F — the reception / triage desk runs the queue: read, add+advance, and the urgent override.
    "queue.read",
    "queue.manage",
    "queue.urgent",
    // Phase 2H — the triage desk flags an emergency encounter + reads the debt ledger.
    "emergency.flag",
    "emergency.debt.read",
    // Phase 2G — the admission desk / head nurse assigns the ward, generates the daily fee, reads.
    "admission.read",
    "admission.assign",
    "admission.fee.charge",
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
    // Phase 2F — the doctor reads/advances their consultation queue and may flag urgent (clinical triage).
    "queue.read",
    "queue.manage",
    "queue.urgent",
    // Phase 2H — the doctor flags an emergency encounter + reads the debt ledger.
    "emergency.flag",
    "emergency.debt.read",
    // Phase 2G — the doctor requests admission, requests/authorises discharge, and reads admissions.
    "admission.read",
    "admission.request",
    "admission.discharge",
    // Phase 2I — the doctor orders lab/radiology and reads them (results hidden until validated).
    "diagnostic.request",
    "diagnostic.read",
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
    // Phase 2F — the cashier sees the queue board (read-only).
    "queue.read",
    // Phase 2H — the cashier records (accrues) + settles Emergency Debt and reads the ledger.
    "emergency.debt.read",
    "emergency.debt.accrue",
    "emergency.debt.settle",
    // Phase 2G — the cashier generates the daily ward fee (billing act) and reads admissions.
    "admission.read",
    "admission.fee.charge",
    // Phase 2I — the cashier validates payment for a lab/radiology order (+ reads to do so).
    "diagnostic.read",
    "diagnostic.payment.confirm",
    // Phase 4D — the cashier (finance) manages mock payment providers/transactions and reconciles a
    // confirmed external payment against its invoice through the existing recordPayment rule.
    "external_payment.view",
    "external_payment.reconcile",
    // Phase 4E — the cashier runs the insurance claim/coverage/pre-auth workflow (billing-linked; manual).
    "claim.manage",
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
    // Phase 3A — the Director reads the per-hospital configuration completeness dashboard
    // (oversight; cannot manage templates or instance config).
    "config.view",
    // Phase 3C — the Director reads the site-readiness checklist (read-only oversight).
    "readiness.view",
    // Phase 3E — the Director reads UAT evidence + provides the (placeholder) Gate 7 sign-off.
    "uat.view",
    "uat.signoff_placeholder",
    // Phase 2E — the director views aggregate operational reports (no export).
    "report.operational.read",
    // Phase 4F — the Director views aggregate analytics definitions / runs / exports (no manage/run).
    "analytics.report.view",
    // Phase 2F — oversight view of the queue board.
    "queue.read",
    // Phase 2H — the Hospital Director is the ONLY role that may WAIVE an emergency debt (+ read it).
    "emergency.debt.read",
    "emergency.debt.waive",
    // Phase 2G — oversight read of admissions.
    "admission.read",
    // Phase 2I — oversight read of lab/radiology orders.
    "diagnostic.read",
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
    // Phase 4A — the Director reads the integration registry + job status (oversight only).
    "integration.job.view",
    // Phase 4D — oversight view of the mock payment provider registry + transactions.
    "external_payment.view",
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
    // Phase 2D-7 — the pharmacist REQUESTS stock adjustments (the Pharmacist-in-Charge approves).
    "stock.adjustment.request",
    // Phase 2F — the pharmacy advances its dispensing queue.
    "queue.read",
    "queue.manage",
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
    // Phase 2D-7 — the Pharmacist-in-Charge APPROVES/REJECTS stock adjustments (cannot self-request).
    "stock.adjustment.approve",
    // Phase 2F — the pharmacy advances its dispensing queue.
    "queue.read",
    "queue.manage",
  ],
  // Phase 2I — diagnostics staff. The technician ENTERS results (lab + radiology); the validator
  // VALIDATES them (enter ≠ validate). Both see the result they handle; neither touches money/clinical
  // records beyond the order. (A finer biologiste/radiologue split by modality is a future refinement.)
  technicien_diagnostic: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "diagnostic.read",
    "diagnostic.result.enter",
    // Phase 4C — the diagnostics technician reviews the external-result import queue and promotes a
    // staged result into the clinical record via the existing enter path (a SEPARATE validator then
    // validates it before the doctor can see it). Distinct from the admin importer (importer ≠ reviewer).
    "external_result.review",
  ],
  validateur_diagnostic: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "diagnostic.read",
    "diagnostic.validate",
  ],
  // Phase 3B — central supervisor. AGGREGATE-only cross-hospital oversight; NO hospital
  // operational capability (no patient/clinical/financial/pharmacy access). `dashboard.read`
  // lets them reach the shell; `central.aggregate.view` is the only oversight capability.
  superviseur_central: ["dashboard.read", "central.aggregate.view", "readiness.view", "uat.view"],
};

/** True if any of the actor's roles grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) =>
    ROLE_CAPABILITIES[role as Role]?.includes(capability),
  );
}

/**
 * True if the roles the actor holds AT a specific hospital grant the capability (Phase 3B).
 * This is the per-hospital authorization primitive: a hospital-scoped capability must be checked
 * against `rolesByHospital[hospitalId]`, never the cross-hospital union — so a privilege granted
 * at one hospital cannot be exercised at another. (Global capabilities like `central.aggregate.view`
 * are the deliberate exception and are checked with `can(actor.roles, …)`.)
 */
export function canAtHospital(
  rolesByHospital: Record<string, readonly string[]>,
  hospitalId: string,
  capability: Capability,
): boolean {
  return can(rolesByHospital[hospitalId] ?? [], capability);
}
