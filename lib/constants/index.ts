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
 * Demo login credentials shown on the login screen (Step 4). Client-safe — mirrors
 * the seeded users in prisma/seed-data. Fake accounts only (A-001/D-008).
 */
export const DEMO_PASSWORD = "demo1234";

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
  "hospital.select": "Sélection d'hôpital",
  "patient.create": "Création patient",
  "encounter.create": "Ouverture de visite",
  "consultation.create": "Consultation",
  "consultation.update": "Mise à jour consultation",
  "invoice.create": "Création de facture",
  "payment.record": "Paiement",
  "receipt.print": "Impression de reçu",
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
