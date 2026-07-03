/**
 * Constants — app-wide invariants (01, 06, 09).
 *
 * Brand, the mandatory prototype label, the official print header and the locale.
 * Plain values, no logic. UI strings shown to users live in `messages/fr.json`;
 * this file holds structural constants and the fixed official wording reused on
 * screens and printed documents.
 */

/** Single supported locale — French only (D-007). */
export const LOCALE = "fr" as const;

/** Currency unit label (D-009 — amounts are integers, formatted in lib/money). */
export const CURRENCY_LABEL = "FCFA" as const;

/** Product short name. */
export const APP_NAME = "SIGH · DME" as const;

/** Product long name / subtitle. */
export const APP_LONG_NAME =
  "Système d'Information de Gestion Hospitalière" as const;

/**
 * The mandatory prototype label — shown persistently in-app and on every printed
 * document (01, 06 §5, 09 §10, R-001).
 */
export const PROTOTYPE_LABEL =
  "Prototype de démonstration fonctionnelle — non destiné à la production" as const;

/**
 * Phase 5F — release-candidate marker. This is a SYNTHETIC-data release candidate for mentor / internal
 * UAT review only. It is explicitly NOT a production release, NOT Gate 7, and carries no authorization.
 */
export const RELEASE_CANDIDATE = "v0.5.0-rc.1" as const;
// Phase 6.3 S3 (mentor-approved governance wording): the visible label states the review
// environment + synthetic data + Gate-7/integration boundaries WITHOUT the softened-away
// "non production" phrasing. Still explicitly a synthetic review build, never production.
export const RELEASE_LABEL =
  "Environnement de revue — données synthétiques · hors Gate 7 · aucune intégration directe" as const;

/** Official header lines for printed documents (used from Step 10 onward, 06 §13). */
export const OFFICIAL_HEADER = {
  country: "République du Cameroun",
  ministry: "Ministère de la Santé Publique",
} as const;

/**
 * Demo hospital display values (A-002/A-003, 07_Demo_Scenario §3). Client-safe —
 * display only, used by the top-bar placeholder. The real, selected hospital
 * context (with scoping) arrives at Step 5 in `server/db/hospital-context`.
 */
export const DEMO_HOSPITAL = {
  code: "HRB-DEMO",
  name: "Hôpital Régional de Bertoua — Démo",
  region: "Est",
} as const;

/**
 * The synthetic demo password is NO LONGER a committed constant (Phase 6.1). It is
 * provided at runtime via the server-side env var `HMIS_DEMO_SHARED_PASSWORD` (see
 * `lib/demo-password.ts` → `getDemoSharedPassword()`), used for seeding + server-side
 * one-click demo login. The public demo-access page may display the optional
 * `NEXT_PUBLIC_DEMO_PASSWORD_HINT`. Fake accounts only (A-001/D-008).
 */

/**
 * Fake tariff catalogue (05 §4 — "one or two fake tariffs"; 07 §8). Integer FCFA.
 * Real tariffs/price-lists are post-audit (C-006, Q-006). Client-safe.
 */
export const TARIFFS = [
  {
    code: "consultation_generale",
    label: "Consultation médecine générale",
    amount: 2000,
    defaultQty: 1,
  },
  {
    code: "ouverture_dossier",
    label: "Frais d'ouverture de dossier",
    amount: 1000,
    defaultQty: 1,
  },
  {
    code: "consultation_specialisee",
    label: "Consultation spécialisée",
    amount: 5000,
    defaultQty: 0,
  },
  { code: "pansement", label: "Pansement", amount: 1500, defaultQty: 0 },
  { code: "injection", label: "Injection", amount: 1000, defaultQty: 0 },
] as const;

/** French labels for audit action codes (dotted codes can't be next-intl keys). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "demo.session_requested": "Session de démonstration (un clic) demandée",
  "hospital.select": "Sélection d'hôpital",
  "patient.create": "Création patient",
  "encounter.create": "Ouverture de visite",
  "encounter.status_change": "Changement de statut de visite",
  "encounter.assign": "Affectation de visite",
  "consultation.create": "Consultation",
  "consultation.update": "Mise à jour consultation",
  "consultation.finalize": "Finalisation consultation",
  "consultation.amend": "Amendement consultation",
  "invoice.create": "Création de facture",
  "payment.record": "Paiement",
  "receipt.print": "Impression de reçu",
  "invoice.void": "Annulation de facture",
  "receipt.reprint": "Réimpression de reçu",
  "cashier.shift_close": "Clôture de caisse",
  "auth.password_change": "Changement de mot de passe",
  "auth.password_reset": "Réinitialisation de mot de passe",
  "sensitive.read": "Lecture sensible",
  "authz.denied": "Action refusée",
  // Phase 1 (Gate 3/4) — configuration / master data.
  "department.create": "Création département",
  "department.update": "Mise à jour département",
  "department.deactivate": "Désactivation département",
  "service_unit.create": "Création unité de service",
  "service_unit.update": "Mise à jour unité de service",
  "service_unit.deactivate": "Désactivation unité de service",
  "setting.update": "Mise à jour paramètre",
  "document_template.create": "Création modèle de document",
  "document_template.update": "Mise à jour modèle de document",
  "document_template.deactivate": "Désactivation modèle de document",
  // Phase 1 (Gate 3/4) — patient identity / contact.
  "patient_contact.create": "Ajout contact patient",
  "patient_contact.update": "Mise à jour contact patient",
  "patient_contact.deactivate": "Désactivation contact patient",
  "patient_identifier.create": "Ajout identifiant patient",
  "patient_identifier.update": "Mise à jour identifiant patient",
  "patient_identifier.deactivate": "Désactivation identifiant patient",
  "patient_duplicate.warning": "Doublon signalé",
  "patient_duplicate.review": "Revue de doublon",
  // Phase 1 (Gate 3/4) — clinical structure.
  "observation.create": "Constante enregistrée",
  "observation.update": "Mise à jour constante",
  "diagnosis.create": "Diagnostic enregistré",
  "diagnosis.update": "Mise à jour diagnostic",
  // Phase 1 (Gate 3/4) — tariff / price list.
  "price_list.create": "Création liste tarifaire",
  "price_list.update": "Mise à jour liste tarifaire",
  "price_list.deactivate": "Désactivation liste tarifaire",
  "tariff.create": "Création tarif",
  "tariff.update": "Mise à jour tarif",
  "tariff.deactivate": "Désactivation tarif",
  "invoice_item.tariff_source_used": "Tarif utilisé (source de facture)",
  // Phase 1 (Gate 5B) — cashier reporting, user lifecycle, logout.
  "auth.logout": "Déconnexion",
  "cashier.daily_report.generate": "Rapport de caisse (export)",
  "user.create": "Création utilisateur",
  "user.activate": "Activation utilisateur",
  "user.deactivate": "Désactivation utilisateur",
  "role.assign": "Attribution de rôle",
  "role.remove": "Retrait de rôle",
  // Phase 2A — service / department catalogue configuration.
  "service.created": "Création service",
  "service.updated": "Mise à jour service",
  "service.deactivated": "Désactivation service",
  "service.reactivated": "Réactivation service",
  "service.reordered": "Réordonnancement des services",
  "service.eligibility_changed": "Changement d'éligibilité du service",
  // Phase 2B — patient identity.
  "patient.temporary_created": "Création d'un patient temporaire",
  "patient.identity_updated": "Mise à jour de l'identité patient",
  // Phase 2C — cancellation workflow, refund voucher, Brouillard de Caisse.
  "invoice.cancellation_requested": "Demande d'annulation de facture",
  "invoice.cancellation_approved": "Annulation de facture approuvée",
  "invoice.cancellation_rejected": "Demande d'annulation rejetée",
  "refund_voucher.created": "Création d'un bon de remboursement",
  "refund_voucher.approved": "Bon de remboursement approuvé",
  "refund_voucher.executed": "Bon de remboursement payé",
  "refund_voucher.cancelled": "Bon de remboursement annulé",
  "cashier.shift_opened": "Ouverture de caisse",
  "cashier.shift_closed": "Clôture de caisse (brouillard)",
  "cashier.closing_corrected": "Correction de brouillard de caisse",
  // Phase 2D-1 — medication catalogue.
  "medication.created": "Création d'un médicament",
  "medication.updated": "Mise à jour d'un médicament",
  "medication.deactivated": "Désactivation d'un médicament",
  "medication.reactivated": "Réactivation d'un médicament",
  // Phase 2D-2 — prescription lifecycle.
  "prescription.created": "Création d'une ordonnance",
  "prescription.finalized": "Finalisation d'une ordonnance",
  "prescription.sent_to_pharmacy": "Ordonnance envoyée à la pharmacie",
  "prescription.cancelled": "Annulation d'une ordonnance",
  // Phase 2D-3 — stock batches.
  "stock.batch_received": "Réception d'un lot de stock",
  // Phase 2D-4 — stock reservations.
  "reservation.created": "Réservation de stock",
  "reservation.released": "Libération de réservation",
  // Phase 2D-5 — collection payment + dispensing.
  "prescription.payment_confirmed": "Paiement d'ordonnance confirmé",
  "dispense.completed": "Délivrance de médicaments",
  // Phase 2D-6 — Pharmacist-in-Charge FEFO override.
  "fefo.override": "Dérogation FEFO (lot non prioritaire)",
  // Phase 2D-7 — dual-validated stock adjustments.
  "stock.adjustment_requested": "Ajustement de stock demandé",
  "stock.adjustment_approved": "Ajustement de stock approuvé",
  "stock.adjustment_rejected": "Ajustement de stock rejeté",
  // Phase 2E — aggregate DHIS2 CSV export.
  "report.exported_csv": "Export CSV agrégé (DHIS2)",
  // Phase 2F — per-service digital queue.
  "queue.ticket_created": "Ajout à la file d'attente",
  "queue.status_changed": "Changement de statut de file",
  "queue.marked_urgent": "File — priorité urgente",
  // Phase 2H — emergency exception + emergency debt.
  "emergency.flagged": "Encounter marqué urgence",
  "emergency.debt_accrued": "Dette d'urgence enregistrée",
  "emergency.debt_settled": "Dette d'urgence réglée",
  "emergency.debt_waived": "Dette d'urgence annulée (Directeur)",
  // Phase 2G — ward-level hospitalization.
  "admission.requested": "Hospitalisation demandée",
  "admission.ward_assigned": "Service d'hospitalisation attribué",
  "admission.cancelled": "Demande d'hospitalisation annulée",
  "admission.discharge_requested": "Sortie demandée",
  "admission.discharged": "Sortie autorisée",
  "admission.daily_fee_charged": "Frais journaliers d'hospitalisation facturés",
  // Phase 2I — manual lab & radiology.
  "diagnostic.catalogue_changed": "Catalogue d'examens modifié",
  "diagnostic.requested": "Examen demandé",
  "diagnostic.payment_confirmed": "Paiement d'examen confirmé",
  "diagnostic.started": "Examen démarré",
  "diagnostic.result_entered": "Résultat d'examen saisi",
  "diagnostic.validated": "Résultat d'examen validé",
  "diagnostic.cancelled": "Examen annulé",
  "diagnostic.pdf_generated": "Compte rendu d'examen imprimé",
};

/**
 * English overlay for the audit action-code labels (Phase 6.2B). Same keys as
 * `AUDIT_ACTION_LABELS`; used by the dashboard recent-activity feed so it reads in the
 * selected language. Free-form audit *summaries* (stored per event) stay in the language
 * they were recorded in — this is the localized action label, not the stored summary.
 * A unit test asserts key parity with the French map so the two never drift.
 */
export const AUDIT_ACTION_LABELS_EN: Record<string, string> = {
  "auth.login": "Sign-in",
  "demo.session_requested": "Demonstration session (one-click) requested",
  "hospital.select": "Hospital selection",
  "patient.create": "Patient created",
  "encounter.create": "Visit opened",
  "encounter.status_change": "Visit status change",
  "encounter.assign": "Visit assignment",
  "consultation.create": "Consultation",
  "consultation.update": "Consultation updated",
  "consultation.finalize": "Consultation finalized",
  "consultation.amend": "Consultation amended",
  "invoice.create": "Invoice created",
  "payment.record": "Payment",
  "receipt.print": "Receipt printed",
  "invoice.void": "Invoice voided",
  "receipt.reprint": "Receipt reprinted",
  "cashier.shift_close": "Cashier close",
  "auth.password_change": "Password change",
  "auth.password_reset": "Password reset",
  "sensitive.read": "Sensitive read",
  "authz.denied": "Action denied",
  // Phase 1 (Gate 3/4) — configuration / master data.
  "department.create": "Department created",
  "department.update": "Department updated",
  "department.deactivate": "Department deactivated",
  "service_unit.create": "Service unit created",
  "service_unit.update": "Service unit updated",
  "service_unit.deactivate": "Service unit deactivated",
  "setting.update": "Setting updated",
  "document_template.create": "Document template created",
  "document_template.update": "Document template updated",
  "document_template.deactivate": "Document template deactivated",
  // Phase 1 (Gate 3/4) — patient identity / contact.
  "patient_contact.create": "Patient contact added",
  "patient_contact.update": "Patient contact updated",
  "patient_contact.deactivate": "Patient contact deactivated",
  "patient_identifier.create": "Patient identifier added",
  "patient_identifier.update": "Patient identifier updated",
  "patient_identifier.deactivate": "Patient identifier deactivated",
  "patient_duplicate.warning": "Potential duplicate flagged",
  "patient_duplicate.review": "Duplicate reviewed",
  // Phase 1 (Gate 3/4) — clinical structure.
  "observation.create": "Vital sign recorded",
  "observation.update": "Vital sign updated",
  "diagnosis.create": "Diagnosis recorded",
  "diagnosis.update": "Diagnosis updated",
  // Phase 1 (Gate 3/4) — tariff / price list.
  "price_list.create": "Price list created",
  "price_list.update": "Price list updated",
  "price_list.deactivate": "Price list deactivated",
  "tariff.create": "Tariff created",
  "tariff.update": "Tariff updated",
  "tariff.deactivate": "Tariff deactivated",
  "invoice_item.tariff_source_used": "Tariff used (invoice source)",
  // Phase 1 (Gate 5B) — cashier reporting, user lifecycle, logout.
  "auth.logout": "Sign-out",
  "cashier.daily_report.generate": "Cashier report (export)",
  "user.create": "User created",
  "user.activate": "User activated",
  "user.deactivate": "User deactivated",
  "role.assign": "Role assigned",
  "role.remove": "Role removed",
  // Phase 2A — service / department catalogue configuration.
  "service.created": "Service created",
  "service.updated": "Service updated",
  "service.deactivated": "Service deactivated",
  "service.reactivated": "Service reactivated",
  "service.reordered": "Services reordered",
  "service.eligibility_changed": "Service eligibility changed",
  // Phase 2B — patient identity.
  "patient.temporary_created": "Temporary patient created",
  "patient.identity_updated": "Patient identity updated",
  // Phase 2C — cancellation workflow, refund voucher, Brouillard de Caisse.
  "invoice.cancellation_requested": "Invoice cancellation requested",
  "invoice.cancellation_approved": "Invoice cancellation approved",
  "invoice.cancellation_rejected": "Cancellation request rejected",
  "refund_voucher.created": "Refund voucher created",
  "refund_voucher.approved": "Refund voucher approved",
  "refund_voucher.executed": "Refund voucher paid",
  "refund_voucher.cancelled": "Refund voucher cancelled",
  "cashier.shift_opened": "Cashier session opened",
  "cashier.shift_closed": "Cashier session closed (day-book)",
  "cashier.closing_corrected": "Cashier day-book correction",
  // Phase 2D-1 — medication catalogue.
  "medication.created": "Medication created",
  "medication.updated": "Medication updated",
  "medication.deactivated": "Medication deactivated",
  "medication.reactivated": "Medication reactivated",
  // Phase 2D-2 — prescription lifecycle.
  "prescription.created": "Prescription created",
  "prescription.finalized": "Prescription finalized",
  "prescription.sent_to_pharmacy": "Prescription sent to pharmacy",
  "prescription.cancelled": "Prescription cancelled",
  // Phase 2D-3 — stock batches.
  "stock.batch_received": "Stock batch received",
  // Phase 2D-4 — stock reservations.
  "reservation.created": "Stock reservation",
  "reservation.released": "Reservation released",
  // Phase 2D-5 — collection payment + dispensing.
  "prescription.payment_confirmed": "Prescription payment confirmed",
  "dispense.completed": "Medication dispensing",
  // Phase 2D-6 — Pharmacist-in-Charge FEFO override.
  "fefo.override": "FEFO override (non-priority batch)",
  // Phase 2D-7 — dual-validated stock adjustments.
  "stock.adjustment_requested": "Stock adjustment requested",
  "stock.adjustment_approved": "Stock adjustment approved",
  "stock.adjustment_rejected": "Stock adjustment rejected",
  // Phase 2E — aggregate DHIS2 CSV export.
  "report.exported_csv": "Aggregate CSV export (DHIS2)",
  // Phase 2F — per-service digital queue.
  "queue.ticket_created": "Added to the queue",
  "queue.status_changed": "Queue status change",
  "queue.marked_urgent": "Queue — urgent priority",
  // Phase 2H — emergency exception + emergency debt.
  "emergency.flagged": "Encounter flagged as emergency",
  "emergency.debt_accrued": "Emergency debt recorded",
  "emergency.debt_settled": "Emergency debt settled",
  "emergency.debt_waived": "Emergency debt waived (Director)",
  // Phase 2G — ward-level hospitalization.
  "admission.requested": "Admission requested",
  "admission.ward_assigned": "Ward assigned",
  "admission.cancelled": "Admission request cancelled",
  "admission.discharge_requested": "Discharge requested",
  "admission.discharged": "Discharge authorized",
  "admission.daily_fee_charged": "Daily inpatient fee charged",
  // Phase 2I — manual lab & radiology.
  "diagnostic.catalogue_changed": "Exam catalogue changed",
  "diagnostic.requested": "Exam requested",
  "diagnostic.payment_confirmed": "Exam payment confirmed",
  "diagnostic.started": "Exam started",
  "diagnostic.result_entered": "Exam result entered",
  "diagnostic.validated": "Exam result validated",
  "diagnostic.cancelled": "Exam cancelled",
  "diagnostic.pdf_generated": "Exam report printed",
};

/**
 * Locale-aware label for an audit action code (Phase 6.2B). Returns the English label for
 * `en`, otherwise the French label, falling back to the raw code when a code is unmapped.
 */
export function auditActionLabel(code: string, locale: string): string {
  if (locale === "en") {
    return AUDIT_ACTION_LABELS_EN[code] ?? AUDIT_ACTION_LABELS[code] ?? code;
  }
  return AUDIT_ACTION_LABELS[code] ?? code;
}

/**
 * French labels for the Phase 2A `ServiceType` codes — used in server-side audit summaries.
 * The UI uses bilingual next-intl keys (`serviceType.*`); this is the French fallback.
 */
export const SERVICE_TYPE_LABELS_FR: Record<string, string> = {
  OUTPATIENT: "Consultation externe",
  INPATIENT_WARD: "Service d'hospitalisation",
  SUPPORT: "Support",
  CASHIER: "Caisse",
  PHARMACY: "Pharmacie",
  LABORATORY: "Laboratoire",
  IMAGING: "Imagerie",
  EMERGENCY: "Urgences",
  ADMINISTRATION: "Administration",
};

/**
 * French display labels for common coded values (contact/identifier/observation types).
 * Client-safe; the UI falls back to the raw code via `codeLabelFr` when not mapped.
 */
export const CODE_LABELS_FR: Record<string, string> = {
  phone: "Téléphone",
  mobile: "Mobile",
  email: "E-mail",
  address: "Adresse",
  next_of_kin: "Personne à contacter",
  carte_hospitaliere: "Carte hospitalière",
  cni: "CNI",
  passeport: "Passeport",
  temperature: "Température",
  tension: "Tension",
  pouls: "Pouls",
  poids: "Poids",
};

/** Human French label for a coded value, falling back to the raw code if unmapped. */
export function codeLabelFr(code: string): string {
  if (!code) return code;
  return CODE_LABELS_FR[code.toLowerCase()] ?? code;
}

/** Payment-method labels for server-side audit summaries (UI uses messages/fr.json). */
export const PAYMENT_METHOD_FR: Record<string, string> = {
  cash: "espèces",
  mobile_money: "mobile money",
  card: "carte",
  bank_transfer: "virement",
};

export const DEMO_ACCOUNTS = [
  {
    email: "awa.njoya@hrb-demo.cm",
    displayName: "Awa NJOYA",
    roleCode: "administrateur",
  },
  {
    email: "brigitte.mbarga@hrb-demo.cm",
    displayName: "Brigitte MBARGA",
    roleCode: "agent_accueil",
  },
  {
    email: "jeanpaul.etoa@hrb-demo.cm",
    displayName: "Dr Jean-Paul ETOA",
    roleCode: "medecin",
  },
  {
    email: "solange.abena@hrb-demo.cm",
    displayName: "Solange ABENA",
    roleCode: "caissier",
  },
  {
    email: "emmanuel.tchoua@hrb-demo.cm",
    displayName: "Dr Emmanuel TCHOUA",
    roleCode: "directeur",
  },
] as const;
