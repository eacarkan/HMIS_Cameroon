# UAT — Phase 0 Walking Skeleton — EXECUTED

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Executed copy of [UAT_PHASE_0_WALKING_SKELETON.md](UAT_PHASE_0_WALKING_SKELETON.md).
All data is **fake** (HRB-DEMO). The blank template is kept for a fresh manual pass.

- **Executed:** 2026-06-27, production build (`next build` + `next start`) against the
  dedicated **test** database (`hmis_cameroon_test`).
- **Method:** each case marked **Pass** is backed by at least one of — the end-to-end
  Playwright suite (`npm run test:e2e`, 7 passed), the service-layer golden-path smoke
  (`npm run smoke:test`), the DB-backed integration suite (`npm run test:integration`,
  26 passed), or **visual review of the recaptured screenshots** in
  `docs/review-screenshots/` (all 14 validated — no 404, prototype label present).
  Command outputs: `docs/qa-command-output/`.
- A case not exercised in this pass is marked **Not executed** (never as Pass).

## Result summary

| Status | Count | Cases |
|---|---|---|
| Pass | 16 | 1–14, 17, 18 |
| Pass (with caveat) | 1 | 15 (see note) |
| Not executed | 1 | 16 (logout — no automated coverage this pass) |
| Fail | 0 | — |

## Test cases

| # | Objective | Status | Evidence |
|---|---|---|---|
| 1 | Login | **Pass** | E2E `golden-path.spec.ts` (logs in, lands on hospital selection); smoke `auth.login`; screenshot `01-login.png` |
| 2 | Hospital selection | **Pass** | E2E selects « Bertoua »; smoke `selectHospital`; top bar shows HRB-DEMO in `02-dashboard.png` |
| 3 | French-first navigation | **Pass** | All 14 screenshots are French (Tableau de bord, Patients, Facturation, Journal d'audit…); component test `sidebar.test.tsx` |
| 4 | Prototype label visible | **Pass** | Visible band on every one of the 14 screenshots **and** on the receipt (`10-receipt-preview.png`); `check:privacy` asserts the label in app + receipt; component test `prototype-banner.test.tsx` |
| 5 | Patient search-before-create | **Pass** | E2E patient flow (search then create); screenshot `03-patient-search.png` |
| 6 | Patient creation | **Pass** | E2E; smoke asserts number **HRB-DEMO-P-2026-000001**; screenshots `04-patient-create.png`, `05-patient-detail-banner.png` |
| 7 | Patient banner | **Pass** | E2E patient detail; screenshot `05-patient-detail-banner.png` (name, N° patient, 36 ans · Féminin, hôpital, visite en cours) |
| 8 | Encounter creation | **Pass** | E2E opens a visit; smoke asserts **HRB-DEMO-V-2026-000001**, statut Ouverte; screenshot `06-encounter.png` |
| 9 | Consultation | **Pass** | E2E records consultation; smoke `recordConsultation`; integration `consultation.test.ts`; screenshot `07-consultation.png`; `06-encounter.png` shows it Finalisée |
| 10 | Invoice creation | **Pass** | E2E creates invoice; smoke + integration `billing.test.ts` assert **HRB-DEMO-F-2026-000001**, total **3 000 FCFA**; screenshots `08-billing.png`, `09-payment-status.png` |
| 11 | Payment | **Pass** | E2E encaisse; smoke + integration assert statut **Payée**, reçu **HRB-DEMO-R-2026-000001**, remaining 0; screenshot `09-payment-status.png` |
| 12 | Receipt preview/print | **Pass** (preview) | E2E asserts receipt content (République du Cameroun, R/F numbers, total); screenshot `10-receipt-preview.png`. *Caveat:* the browser **print dialog** is not automated — on-screen preview verified; physical/PDF print is a manual step. |
| 13 | Dashboard KPIs | **Pass** | E2E dashboard; smoke asserts **1 / 1 / 3 000 FCFA**; integration `dashboard.test.ts`; screenshots `02-dashboard.png` (admin), `12-rbac-denied.png` (KPIs + activity) |
| 14 | Audit log | **Pass** | E2E audit assertions; integration `audit.test.ts`; screenshots `11-audit-log.png`, `14-rbac-audit-denied.png` (filter « Action refusée ») |
| 15 | RBAC denied action | **Pass** (caveat) | Server-side denial proven: smoke "RBAC block (reception cannot encaisser)"; integration `scoping-rbac.test.ts` + `billing.test.ts` (reception → `AuthorizationError`); audited `authz.denied` shown in `14-rbac-audit-denied.png`; nav filtered in `12-rbac-denied.png`. *Caveat:* the direct-route guard **redirects** the receptionist from `/journal-audit` to `/` (no on-screen "Accès refusé" message — denial is enforced + audited server-side, surfaced via the audit log). |
| 16 | Logout | **Not executed** | `signOutAction` is implemented and wired in the top-bar user menu, but logout is **not** covered by an automated test and was not manually exercised in this pass. |
| 17 | Narrow screen | **Pass** | Screenshot `13-mobile-dashboard.png` at 390 px — sidebar collapses, tiles stack, top bar + prototype label remain visible |
| 18 | No real data | **Pass** | `check:privacy` (no secrets; 5 demo accounts all `@hrb-demo.cm`; fake); HRB-DEMO marked « Démo » across screenshots; no real national ID anywhere |

## Sign-off

- [x] All automated suites green: typecheck, lint, build, unit/component (33), integration (26), E2E (7), smoke. See `docs/qa-command-output/`.
- [x] All 14 review screenshots recaptured in production mode, validated (no 404, prototype label present), fake data only.
- [ ] Logout (case 16) to be exercised in a manual pass.
- [ ] Receipt printed to PDF/paper in a manual pass (case 12 caveat).
- [x] No real patient data observed.
- Reviewer (automated + visual, this pass): Claude / build pipeline — Date: 2026-06-27
- Human reviewer: ______________  Date: ____________
