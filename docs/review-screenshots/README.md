# Review screenshots — Phase 0 walking skeleton

Captured from the running app against the **test/demo database** (fake data only,
HRB-DEMO). French-first UI; the prototype label
« Prototype de démonstration fonctionnelle — non destiné à la production » is visible on
every screen. Retina (2×) PNGs.

| # | File | Screen | Actor |
|---|---|---|---|
| 1 | `01-login.png` | Login (`/connexion`) — institutional header, demo accounts hint | — |
| 2 | `02-dashboard.png` | Dashboard + app shell (sidebar, top bar, hospital context, KPIs 1/1/3 000 FCFA) | Administrateur |
| 3 | `03-patient-search.png` | Patient search/list (search-before-create) | Administrateur |
| 4 | `04-patient-create.png` | Patient creation form (sectioned, French validation) | Administrateur |
| 5 | `05-patient-detail-banner.png` | Patient detail with the sticky patient banner | Administrateur |
| 6 | `06-encounter.png` | Encounter (visit) view + consultation/billing sections | Administrateur |
| 7 | `07-consultation.png` | Consultation form (motif, note, constantes, diagnostic) | Administrateur |
| 8 | `08-billing.png` | Invoice creation (tariff line items, live total 3 000 FCFA) | Administrateur |
| 9 | `09-payment-status.png` | Invoice **Payée** + payment record + "Imprimer le reçu" | Administrateur |
| 10 | `10-receipt-preview.png` | Official receipt (République du Cameroun · MINSANTE · hôpital, R/P/F numbers, total, prototype label) | Administrateur |
| 11 | `11-audit-log.png` | Journal d'audit (acteur · action · entité · heure · résumé + filter) | Administrateur |
| 12 | `12-rbac-denied.png` | RBAC: receptionist nav filtered (no Facturation/Audit) + audited "Action refusée (payment.record)" | Agent d'accueil |
| 13 | `13-mobile-dashboard.png` | Narrow/mobile dashboard (390 px) — sidebar collapses, tiles stack | Administrateur |

Notes:
- 02/13 (dashboard) were captured at the clean golden-path state (1 patient / 1 visit /
  3 000 FCFA). 08 (billing form) uses a **second** fresh fake visit (Marie NDIAYE,
  `HRB-DEMO-P-2026-000002`) so the empty invoice form is shown.
- Generated with headless Chrome via CDP against `http://localhost:3000` while the dev
  server ran with `DATABASE_URL` pinned to the test database. Re-runnable; no real data.
