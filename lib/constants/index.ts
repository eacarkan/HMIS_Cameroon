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
