# Gate 5 — UAT checklist (Phase 1 pilot-core, executed)

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Role-based UAT for the Phase 1 pilot-core workflows (`12 §8`). **Fake data only** (HRB-DEMO).
Each row is backed by automated evidence (E2E / integration / smoke / component) and/or a
Gate 4 screenshot; a row not exercised in this pass is marked **N/A** (never as Pass).

Demo accounts (password `HMIS_DEMO_SHARED_PASSWORD`): Awa NJOYA (Administrateur) · Brigitte MBARGA (Agent
d'accueil) · Dr Jean-Paul ETOA (Médecin) · Solange ABENA (Caissier) · Dr Emmanuel TCHOUA
(Directeur, lecture seule).

| ID | Actor | Scenario / steps | Expected | Evidence | Result |
|---|---|---|---|---|---|
| U-01 | Tous | Login → session | Authenticated; role-filtered nav | E2E golden-path `E2E-01`; smoke `auth.login` | **Pass** |
| U-02 | Tous | Select assigned hospital | Active hospital context (only assigned) | E2E `E2E-01`; integration `scoping-rbac`; smoke `hospital.select` | **Pass** |
| U-03 | ACC | Patient search-before-create | No match → offer to create | E2E `E2E-02`; integration `patient` | **Pass** |
| U-04 | ACC | Register patient (BELLO) | Patient + `HRB-DEMO-P-2026-000001` | E2E `E2E-02`; smoke patient number | **Pass** |
| U-05 | ACC | Manage contacts/identifiers | Add/deactivate, audited; clinical denied | integration `gate3-rbac-audit`; component `gate4-panels`; screenshot `03` | **Pass** |
| U-06 | ACC | Duplicate warning + review (no merge) | Candidate shown; dismiss only; **no merge** | integration `gate3` (no merge); component (no merge control); screenshot `03` | **Pass** |
| U-07 | ACC/MED | Open outpatient encounter | Open visit `HRB-DEMO-V-2026-000001` | E2E `E2E-03`; smoke encounter | **Pass** |
| U-08 | MED | Record consultation | Consultation saved (Finalisée) | E2E `E2E-03b`; integration `consultation` | **Pass** |
| U-09 | MED | Structured observations/vitals | Vitals saved, scoped; free-text kept | integration `gate3-rbac-audit`; screenshot `04` | **Pass** |
| U-10 | MED | Structured diagnosis | Diagnosis saved; tariff denied | integration `gate3-rbac-audit`; screenshot `04` | **Pass** |
| U-11 | ADM | Configure dept/unit/setting/template | CRUD/deactivate, audited; non-admin denied | integration `gate3-rbac-audit`; screenshot `01` | **Pass** |
| U-12 | ADM | Manage tariffs / price lists | CRUD, integer FCFA, audited; CAI read-only | integration `gate3` + `gate4-billing-tariff`; screenshot `02` | **Pass** |
| U-13 | CAI | Bill from **DB tariff catalogue** | Lines sourced from DB; total = sum; FCFA | E2E `E2E-04`; integration `gate4-billing-tariff`; component `invoice-form`; screenshot `05` | **Pass** |
| U-14 | — | Tariff change does not alter past invoice | Snapshot frozen | integration `gate3` + `gate4-billing-tariff` | **Pass** |
| U-15 | CAI | Record payment | Statut **Payée** | E2E `E2E-04`; smoke payment | **Pass** |
| U-16 | CAI | Print official receipt | République du Cameroun · R/F numbers · prototype label | E2E `E2E-04`; screenshot `06`; smoke receipt | **Pass** |
| U-17 | DIR | Dashboard KPIs | 1 / 1 / 3 000 FCFA | E2E `E2E-05`; smoke dashboard | **Pass** |
| U-18 | ADM/DIR | Audit log + new event labels | Actions visible in French; `authz.denied` | E2E `E2E-05`; integration `audit`; screenshot `07` | **Pass** |
| U-19 | Wrong role | Denied action server-side | Refused + `authz.denied` audited | integration `gate3-rbac-audit`; E2E `rbac.spec`; smoke RBAC block | **Pass** |
| U-20 | Tous | No cross-hospital leakage | Other hospital returns nothing | integration `scoping-rbac` + `phase1-data-model` + `gate3` | **Pass** |
| U-21 | Tous | Logout → /connexion | Session ends | E2E `logout.spec` | **Pass** |
| U-22 | Réviseur | Fake data / prototype label only | No real data; label everywhere | `check:privacy`; all screenshots | **Pass** |
| U-23 | CAI/DIR | Cashier daily report | Daily totals reconcile | — (not implemented in Phase 1 build) | **N/A — deferred** |
| U-24 | Tous | Narrow/mobile usability | Stacks; **no mobile nav** | review `13-mobile-dashboard` (prior gate) | **Pass with caveat** |

## Sign-off
- [x] Golden path completes for the pilot dataset (smoke 13/13; E2E 8/8).
- [x] RBAC differs by role; denied actions fail server-side and are audited.
- [x] Hospital scoping: no cross-hospital data reachable (tests).
- [x] Billing: integer FCFA; invoice = lines = payment; DB-sourced tariffs; snapshot preserved.
- [x] Audit: significant actions (incl. denied) logged with actor/hospital/time/summary.
- [ ] Cashier daily report (U-23) — deferred Phase 1 item, not in this build.
- [ ] Receipt printed to PDF/paper — manual step (preview verified).
- Human reviewer: ______________  Date: ____________
