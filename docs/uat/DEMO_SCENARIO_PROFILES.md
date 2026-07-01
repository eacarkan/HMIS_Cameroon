# Demo scenario profiles (Phase 5C — synthetic data factory)

**Synthetic / fake data only · not Gate 7 · not real patient data.**

The synthetic-data factory (`tests/helpers/scenarios.ts`) builds repeatable, deterministic UAT/demo scenarios on top of the base demo seed (HRB-DEMO), using the **real** services so hospital scoping, RBAC, and audit all fire. Every record is fake demo data (patient names are tagged `DEMO_*`). Reset with `npm run db:reset` first for a deterministic starting state.

## Scenarios

| Builder | Edge case covered | What it creates | Key assertion |
|---|---|---|---|
| `seedBilledEncounter(tag)` | Billing golden path | reception patient → doctor consultation + ICD-10 diagnosis → cashier invoice (3 000 FCFA) + cash payment | invoice `paid` |
| `seedEmergencyDebt(tag)` | 2H — treat-first-pay-later | emergency-flagged encounter + a cashier-accrued outstanding `EmergencyDebt` (5 000 FCFA) | debt `outstanding`, encounter `isEmergency` |
| `seedInsuranceClaim(tag)` | 4E — insurance / mutuelle (manual) | payer (CNPS) + coverage profile + patient coverage + a billing-linked claim **DRAFT** (2 400 FCFA) | claim `DRAFT`, `invoiceId` set |
| `seedDuplicateMatch(tag)` | 4G — local duplicate matching | two matching synthetic patients + generated warning-only match candidate(s) | ≥ 1 `CANDIDATE` |

## Guarantees (verified — `tests/integration/phase5c-demo-factory.test.ts`)
- **Coverage.** Each builder produces its expected synthetic artifact across billing / emergency / insurance / matching.
- **Repeatable + deterministic.** After a reset, an identical run yields the identical deterministic patient number and counts (numbering counters reset with the DB).
- **100% synthetic.** Every seeded patient name is tagged `DEMO_*`; no real nominative data; the factory drives only the synthetic HRB-DEMO demo accounts (`@hrb-demo.cm`).

## Notes
- The factory is **additive** — it layers scenarios on top of the base seed and does **not** modify the base seed or the golden path.
- Phase 4 external features remain **mock/flag-off**: the insurance claim is a manual draft (no insurer API), matching is warning-only (no auto-merge), and no live external call is made.
