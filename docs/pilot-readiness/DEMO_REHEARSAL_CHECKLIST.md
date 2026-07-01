# Demo rehearsal checklist (Phase 5H)

**DEMO — SYNTHETIC DATA ONLY · readiness evidence only, NOT an authorization · not Gate 7 · not production.**

## Before the demo — reset to a known synthetic state
```bash
npm install
npm run db:push          # sync the schema
npm run db:seed          # base HRB-DEMO synthetic seed
# (or) npm run db:reset  # clear operational data + re-seed the known base
```
The reset restores a deterministic starting state (patients/encounters/invoices = 0; counters at 0; base demo data re-seeded). All accounts are fake `@hrb-demo.cm`.

## Optional — layer edge-case scenarios (synthetic factory, Phase 5C)
The `tests/helpers/scenarios.ts` factory builds repeatable edge cases (billed encounter, emergency debt, insurance claim draft, duplicate match). See `docs/uat/DEMO_SCENARIO_PROFILES.md`.

## Demo script (golden path + Phase 4/4G highlights)
1. **Login → select hospital** (HRB-DEMO). Note the persistent prototype + fake-data markers.
2. **Register a patient → open a visit → record a consultation** (+ ICD-10 diagnosis).
3. **Create an invoice → record a payment → print the receipt** (reconciles on the amount).
4. **Dashboard tile + audit log** reflect the activity (who / what / when).
5. **Pharmacy**: dispense against a paid prescription (FEFO); a stock adjustment (dual validation).
6. **Emergency**: flag an encounter → accrue an emergency debt → Director waiver.
7. **Reporting**: operational report + DHIS2 aggregate CSV (no patient identifier).
8. **Phase 4 (mock/sandbox)**: DHIS2 mapping + mock export · external result import (staging → review) · mock payment reconciliation · insurance claim draft · analytics report run/export.
9. **Phase 4G**: patient-match review (warning-only, no auto-merge; mock MPI).
10. **Central oversight** (as `superviseur_central`): aggregate-only, no patient-level data.
11. **System status** (`/etat-systeme`): RC version, fake-data marker, and the **"readiness evidence only — not an authorization"** banner.

## After the demo
- `npm run db:reset` to return to the known state.
- Nothing leaves the machine: no live external call, no real credentials, synthetic data only.

## Verify the build is demo-ready (§8 QA block)
`npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build && npm run smoke && npm run check:arch && npm run check:privacy && npm run check:i18n && npm run check:release && npm run test:e2e`
