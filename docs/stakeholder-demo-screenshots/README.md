# Stakeholder demo screenshots — one-patient golden path

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

The **approved stakeholder demo** scenario from
`03_Software/Planning/07_Demo_Scenario_and_Fake_Dataset.md`: a single fictional patient
(**Aïssatou BELLO**) registered, consulted, billed and paid (3 000 FCFA), with the
dashboard and audit log reconciling. **Fake data only** (HRB-DEMO).

Distinct from `docs/review-screenshots/` (the *technical* set, which uses two patients to
also show empty consultation/billing forms). This stakeholder set:

- uses **one patient only**, so the dashboard reads exactly
  **Patients aujourd'hui 1 · Visites ouvertes 1 · Encaissements 3 000 FCFA**;
- **hides the demo-accounts / password hint** on the login screen
  (`NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false`);
- is captured in **production mode** (no dev overlay) and machine-validated (no 404,
  prototype label present on every screen).

Regenerate: `npm run screenshots:demo`.

| # | File | Screen |
|---|---|---|
| 1 | `01-connexion.png` | Login — institutional header, **no demo-account hint / password** |
| 2 | `02-tableau-de-bord.png` | Dashboard — KPIs **1 / 1 / 3 000 FCFA** + recent activity |
| 3 | `03-recherche-patient.png` | Patient search/list (Aïssatou BELLO) |
| 4 | `04-dossier-patient.png` | Patient detail + sticky banner (`…P-2026-000001`) |
| 5 | `05-visite.png` | Encounter `…V-2026-000001` — consultation Finalisée + facture Payée |
| 6 | `06-facture-payee.png` | Invoice `…F-2026-000001` **Payée** + receipt link |
| 7 | `07-recu.png` | Official receipt (upper) — République du Cameroun · MINSANTE · hôpital, R/P/F numbers |
| 8 | `08-recu-complet.png` | **Full receipt** — through Montant payé 3 000 FCFA, Caissier, signature area, footer + prototype note |
| 9 | `09-journal-audit.png` | Journal d'audit — the golden-path actions reconcile with the dashboard |

Actor: **Administrateur** (Awa NJOYA) for the in-app screens; the journey data is produced
by the role-appropriate users (reception → clinician → cashier) per the demo script.
