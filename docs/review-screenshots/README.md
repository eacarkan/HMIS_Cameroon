# Review screenshots — Phase 0 walking skeleton

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Captured in **production mode** (`next build` + `next start`, so **no Next.js dev
overlay**) against the dedicated **test** database (`hmis_cameroon_test`) seeded with a
deterministic golden-path fixture. **Fake data only** (HRB-DEMO). French-first UI; the
prototype label is visible on every screen. Retina (2×) PNGs.

**Every screenshot here was machine-validated and visually reviewed.** The capture
script refuses to save any page that shows `404` / "This page could not be found", that
is missing the prototype label, or that is missing its expected content — so a broken
page can never be saved silently.

Regenerate (one command — builds, starts prod server on the test DB, seeds, captures,
validates): `npm run screenshots:review`
(pipeline: `scripts/capture-review-screenshots.sh` → `scripts/seed-review-fixture.ts`
→ `scripts/capture-review-screenshots.mjs`).

| # | File | Screen | Actor |
|---|---|---|---|
| 1 | `01-login.png` | Login (`/connexion`) — institutional header, demo accounts hint, prototype band | — |
| 2 | `02-dashboard.png` | Dashboard + app shell (sidebar, top bar, hospital context, KPIs 2/2/3 000 FCFA) | Administrateur |
| 3 | `03-patient-search.png` | Patient search/list (search-before-create) | Administrateur |
| 4 | `04-patient-create.png` | Patient creation form (sectioned, French fields) | Administrateur |
| 5 | `05-patient-detail-banner.png` | Patient detail with the sticky patient banner (Aïssatou BELLO, `…P-2026-000001`) | Administrateur |
| 6 | `06-encounter.png` | Encounter/visit (`…V-2026-000001`) — visit info, consultation Finalisée, facture Payée | Administrateur |
| 7 | `07-consultation.png` | Consultation form (motif, note, constantes, diagnostic) — fresh visit (Marie NDIAYE) | Administrateur |
| 8 | `08-billing.png` | Invoice creation (tariff line items, live total) — fresh visit (Marie NDIAYE, `…P-2026-000002`) | Administrateur |
| 9 | `09-payment-status.png` | Invoice `…F-2026-000001` **Payée** + payment + "Imprimer le reçu" (Aïssatou BELLO) | Administrateur |
| 10 | `10-receipt-preview.png` | Official receipt (République du Cameroun · MINSANTE · hôpital, R/P/F numbers, total + Montant payé 3 000 FCFA, prototype label) | Administrateur |
| 11 | `11-audit-log.png` | Journal d'audit (acteur · action · entité · heure · résumé + filter) | Administrateur |
| 12 | `12-rbac-denied.png` | RBAC — receptionist nav filtered to **only** Tableau de bord + Patients (no Facturation/Audit/Administration) | Agent d'accueil |
| 13 | `13-mobile-dashboard.png` | Narrow/mobile dashboard (390 px) — sidebar collapses, tiles stack | Administrateur |
| 14 | `14-rbac-audit-denied.png` | RBAC server-side denial — audit log filtered « Action refusée »: receptionist's blocked `payment.record` ("rôle non autorisé") | Directeur (lecture seule) |

Notes:
- The fixture seeds two patients: **Aïssatou BELLO** (`…P-2026-000001`) with a full
  paid journey (encounter → consultation → invoice F-000001 → receipt R-000001), and
  **Marie NDIAYE** (`…P-2026-000002`) with a fresh open visit and no consultation/invoice
  — so the empty consultation (07) and invoice (08) forms render cleanly.
- Route IDs are per-row **cuids** regenerated on every reseed (only the human-readable
  numbers are deterministic). The capture seeds and reads those IDs in one ordered step
  against the same DB the server serves, then visits valid routes only — which is why the
  earlier id-bearing detail screens (05/06/07/09/10) no longer 404.
- RBAC denial (case 6 of the correction brief) is evidenced three ways: filtered nav
  (`12`), the server-side `authz.denied` audit entry (`14`), and the integration/smoke
  tests (`scoping-rbac.test.ts`, `billing.test.ts`, golden-path "RBAC block").
