/**
 * UAT evidence & Gate 7 readiness (Phase 3E) — pure, client-safe. EVIDENCE ONLY: the software team
 * never authorizes Gate 7 (administrative, co-signed Hospital Director + MINSANTE). Sign-off fields
 * are placeholders. The readiness report always carries the non-authorization disclaimer. No I/O.
 */

import type { ReadinessStatus } from "@/lib/site-readiness";

/** The mandatory disclaimer shown on every readiness report (doc 34 §8.4 / §8.14). */
export const GATE7_DISCLAIMER_FR =
  "Preuves de préparation uniquement — ne constitue pas une autorisation (Gate 7 est administratif, co-signé Directeur + MINSANTE).";
export const GATE7_DISCLAIMER_EN =
  "Readiness evidence only — not an authorization (Gate 7 is administrative, co-signed Director + MINSANTE).";

export const UAT_STATUSES = ["not_run", "pass", "fail", "blocker"] as const;
export type UatStatus = (typeof UAT_STATUSES)[number];

export type UatScenarioTemplate = {
  code: string;
  category: string;
  titleFr: string;
  titleEn: string;
  expectedResult: string;
};

/** The seed UAT scenario library — one representative scenario per doc 34 §8.4 category (synthetic). */
export const UAT_SCENARIO_LIBRARY: readonly UatScenarioTemplate[] = [
  { code: "UAT-REG", category: "patient_registration", titleFr: "Enregistrement d'un patient", titleEn: "Patient registration", expectedResult: "Patient créé avec numéro unique." },
  { code: "UAT-TEMP", category: "temporary_patient", titleFr: "Patient temporaire (inconnu)", titleEn: "Temporary (unknown) patient", expectedResult: "Identifiant temporaire unique attribué." },
  { code: "UAT-VISIT", category: "outpatient_visit", titleFr: "Ouverture d'une visite externe", titleEn: "Open an outpatient visit", expectedResult: "Visite liée à un service de consultation." },
  { code: "UAT-CONS", category: "consultation", titleFr: "Rédaction d'une consultation", titleEn: "Record a consultation", expectedResult: "Note finalisée + diagnostic codé." },
  { code: "UAT-BILL", category: "billing_cashier", titleFr: "Facturation + encaissement", titleEn: "Billing + cashier payment", expectedResult: "Facture réglée, reçu imprimable, caisse réconciliée." },
  { code: "UAT-RX", category: "prescription_pharmacy", titleFr: "Ordonnance → dispensation", titleEn: "Prescription → dispensing", expectedResult: "Stock déduit en FEFO après paiement." },
  { code: "UAT-QUEUE", category: "queue", titleFr: "File d'attente par service", titleEn: "Per-service queue", expectedResult: "Ticket créé, ordre urgent respecté." },
  { code: "UAT-HOSP", category: "hospitalization", titleFr: "Hospitalisation (lit + sortie)", titleEn: "Hospitalization (ward + discharge)", expectedResult: "Sortie bloquée tant que facture/dette non réglée." },
  { code: "UAT-URG", category: "emergency_exception", titleFr: "Exception d'urgence (payer après)", titleEn: "Emergency (pay-later) exception", expectedResult: "Dette d'urgence auto-créée, levée par le Directeur." },
  { code: "UAT-LAB", category: "lab_radiology", titleFr: "Laboratoire / imagerie", titleEn: "Lab / radiology", expectedResult: "Résultat masqué au médecin jusqu'à validation (saisie ≠ validation)." },
  { code: "UAT-REP", category: "reporting", titleFr: "Rapports + export DHIS2 (agrégé)", titleEn: "Reporting + DHIS2 (aggregate) export", expectedResult: "CSV agrégé sans identifiant patient." },
  { code: "UAT-RBAC", category: "user_rbac", titleFr: "Utilisateurs + habilitations (RBAC)", titleEn: "Users + RBAC", expectedResult: "Action interdite refusée côté serveur + audit." },
  { code: "UAT-I18N", category: "bilingual_ui", titleFr: "Interface bilingue (Fr/En)", titleEn: "Bilingual UI (Fr/En)", expectedResult: "Bascule Fr/En sur les écrans clés." },
  { code: "UAT-READY", category: "backup_status_readiness", titleFr: "Sauvegarde / état / préparation", titleEn: "Backup / status / readiness", expectedResult: "État système + préparation du site consultables." },
];

export type Gate7Criterion = { key: string; labelFr: string; labelEn: string };

/** Gate 7 readiness criteria (doc 34 §8.4 / doc 32 §13). Tracked, never self-authorized. */
export const GATE7_CRITERIA: readonly Gate7Criterion[] = [
  { key: "signed_uat", labelFr: "UAT signée", labelEn: "Signed UAT" },
  { key: "validated_hardware", labelFr: "Déploiement matériel validé", labelEn: "Validated hardware deployment" },
  { key: "cybersecurity_baseline", labelFr: "Base cybersécurité évaluée", labelEn: "Cybersecurity baseline" },
  { key: "backup_restore", labelFr: "Sauvegarde / restauration prêtes", labelEn: "Backup/restore readiness" },
  { key: "trained_users", labelFr: "Utilisateurs formés", labelEn: "Trained users" },
  { key: "support_process", labelFr: "Processus de support", labelEn: "Support process" },
  { key: "incident_process", labelFr: "Processus d'incident", labelEn: "Incident process" },
  { key: "fallback_procedure", labelFr: "Procédure de repli (manuelle)", labelEn: "Fallback (manual) procedure" },
  { key: "no_critical_blockers", labelFr: "Aucun bloquant critique", labelEn: "No critical blockers" },
];

/** Critical-blocker classes that must be absent for Gate 7 (doc 34 §8.4). */
export const CRITICAL_BLOCKER_CLASSES = [
  "data_loss",
  "financial_calc_error",
  "access_control_leak",
  "cross_hospital_leakage",
  "missing_audit",
] as const;

export type UatSummary = {
  total: number;
  run: number;
  pass: number;
  fail: number;
  blocker: number;
  /** 0–100 over RUN scenarios. */
  percentPass: number;
  hasBlocker: boolean;
};

/** Roll up UAT execution statuses. */
export function summarizeUat(statuses: readonly UatStatus[]): UatSummary {
  const total = statuses.length;
  const run = statuses.filter((s) => s !== "not_run").length;
  const pass = statuses.filter((s) => s === "pass").length;
  const fail = statuses.filter((s) => s === "fail").length;
  const blocker = statuses.filter((s) => s === "blocker").length;
  const percentPass = run === 0 ? 0 : Math.round((pass / run) * 100);
  return { total, run, pass, fail, blocker, percentPass, hasBlocker: blocker > 0 };
}

export type Gate7ReadinessSignal = {
  criteriaTotal: number;
  criteriaReady: number;
  uat: UatSummary;
  /** Evidence is assembled (all criteria ready + UAT complete with no blocker). NEVER an authorization. */
  evidenceComplete: boolean;
  /** Always false here — software cannot authorize Gate 7. */
  authorized: false;
};

/** Compute the Gate 7 readiness SIGNAL (evidence assembled or not) — never an authorization. */
export function computeGate7Signal(
  uat: UatSummary,
  criteriaStatuses: readonly ReadinessStatus[],
): Gate7ReadinessSignal {
  const criteriaTotal = criteriaStatuses.length;
  const criteriaReady = criteriaStatuses.filter((s) => s === "ready").length;
  const evidenceComplete =
    criteriaTotal > 0 &&
    criteriaReady === criteriaTotal &&
    uat.total > 0 &&
    uat.run === uat.total &&
    !uat.hasBlocker &&
    uat.fail === 0;
  return { criteriaTotal, criteriaReady, uat, evidenceComplete, authorized: false };
}
