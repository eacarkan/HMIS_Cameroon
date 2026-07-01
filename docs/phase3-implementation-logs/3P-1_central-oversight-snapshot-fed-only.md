# Phase 3 QA Patch 3P-1 — Central oversight: snapshot-fed only (remove legacy live aggregate path)

**Unit:** 3P-1 (mentor follow-up QA patch) · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3 patch: central oversight snapshot-fed only (remove legacy live aggregate path)`

> Focused QA patch addressing the mentor's conditional acceptance. **Not new scope**; refactor + dead-path removal only. Synthetic data only · not Gate 7 · no production · no `01_`/`02_` changes.

## 1. Problem (mentor finding)
`getCentralAggregates` (`server/services/central-oversight-service.ts`) called `gatherCentralAggregates` (`server/db/central-oversight.ts`), which read **live over the operational tables** (`patient` / `encounter` / `invoice` / `payment` `groupBy` across all hospitals). Both were still exported from the production barrels (`server/services/index.ts`, `server/db/index.ts`). The central page already used the snapshot-fed `getCentralOversight`; the live path was exercised **only** by `tests/integration/phase3b-cross-hospital-denial.test.ts`. A live cross-hospital read of operational tables — even aggregate — is exactly the surface the mentor wanted gone, so central oversight is unambiguously snapshot-fed only.

## 2. Caller audit (the required "grep first")
```
$ grep -rn "getCentralAggregates|gatherCentralAggregates" server app components tests
server/db/index.ts                         (re-export)
server/services/index.ts                   (re-export)
server/services/central-oversight-service.ts  (definition of getCentralAggregates + import of gatherCentralAggregates)
server/db/central-oversight.ts             (definition of gatherCentralAggregates)
tests/integration/phase3b-cross-hospital-denial.test.ts  (the ONLY consumer)
```
No `app/`, `components/`, or `server/actions/` caller. **No legitimate hospital-scoped (non-central) usage** exists, so no stop-and-propose was needed — the live path is dead production code and was deleted outright.

## 3. Change
- **Deleted** `getCentralAggregates` + the `CentralAggregates` type from `central-oversight-service.ts`; removed the now-unused `gatherCentralAggregates` / `CentralHospitalAggregate` imports.
- **Deleted** `gatherCentralAggregates` + the `CentralHospitalAggregate` type from `server/db/central-oversight.ts` (the only function there that queried `patient`/`encounter`/`invoice`/`payment` directly).
- **Removed** both from the production barrels (`server/services/index.ts`, `server/db/index.ts`).
- Updated the file header docs of both modules to state plainly that the central read path is snapshot-fed only and that the live path was removed.
- **Kept** (unchanged): `getCentralOversight` (reads `listLatestHospitalSnapshots` + hospital identity only), `generateHospitalAggregateSnapshot` (hospital-side, gated by `report.operational.read`), `gatherSnapshotCounts` / `upsertHospitalAggregateSnapshot` / `listLatestHospitalSnapshots`.

The **only** central-role-accessible service is now `getCentralOversight`, and it never touches operational patient/encounter/invoice/lab/pharmacy tables — it reads stored `HospitalAggregateSnapshot` rows + that snapshot's hospital identity metadata.

## 4. Tests
`tests/integration/phase3b-cross-hospital-denial.test.ts` central section rewritten to the snapshot-fed surface:
- **`central oversight is SNAPSHOT-FED only`** — after `resetTestDb` the DB holds 8 seeded hospitals with operational rows but **zero** snapshots; `getCentralOversight(central)` returns `hospitals: []`. The removed live path would have enumerated all 8 hospitals from the operational tables. This is the **structural proof** that the central read path issues no direct operational-DB query. Access is still audited (`central.aggregate.accessed`, `hospitalId` null).
- **`the legacy LIVE central aggregate path is removed from the service + DB surface`** — asserts `services.getCentralAggregates` and `db.gatherCentralAggregates` are `undefined` and `services.getCentralOversight` is a function. Guards against re-introduction of a live cross-hospital read.
- **`a hospital role (admin) is DENIED central oversight; the denial is audited`** — `getCentralOversight(admin)` rejects `AuthorizationError`; `authz.denied` audited.
- Unchanged: the universal membership-resolved context gate, the 11-table DB isolation matrix, and the central-supervisor-has-no-hospital-operational-access test.

Snapshot-fed aggregate **content** + privacy (no nominative field, canonical ICD labels only) remains proven by `tests/integration/phase3d-central-oversight.test.ts` (unchanged, 5 tests).

## 5. Schema summary
**None.** No migration. Pure code removal + export pruning. No table/enum/index change.

## 6. RBAC / audit summary
- Unchanged authorization: `central.aggregate.view` (the deliberate GLOBAL capability) still gates `getCentralOversight`; denied attempts audited `authz.denied`; successful reads audited `central.aggregate.accessed` (national read, `hospitalId` null). No per-hospital scoping or RBAC weakened.
- Net effect: one fewer cross-hospital read path; the surviving one is aggregate-only + snapshot-fed.

## 7. Test evidence
[`docs/qa-command-output/3P-1/`](../qa-command-output/3P-1/): `typecheck` clean; `lint` 0 errors (2 pre-existing warnings unrelated to this unit); `check:arch` green; `check:privacy` green; `phase3b + phase3d` integration **11 passed**. Authoritative full-suite refresh is 3P-3 (WI3).

## 8. Known issues
None introduced. (Pre-existing, non-blocking: two unused-var lint warnings in `phase3f1`/`phase3f2` test files — tracked, addressed opportunistically in 3P-2.)

## 9. Boundary confirmation
Synthetic data only · not Gate 7 · no production · additive/refactor only (a deletion of dead code) · no schema change · hospital scoping + per-hospital RBAC **unchanged** · central oversight aggregate-only + snapshot-fed (no direct operational-DB query) · audit preserved on central access · no `01_`/`02_` changes · no Phase 4.

## 10. Files changed
- `server/services/central-oversight-service.ts` (removed `getCentralAggregates` + `CentralAggregates`; doc update).
- `server/db/central-oversight.ts` (removed `gatherCentralAggregates` + `CentralHospitalAggregate`; doc update).
- `server/services/index.ts`, `server/db/index.ts` (removed the live-path re-exports).
- `tests/integration/phase3b-cross-hospital-denial.test.ts` (central section → snapshot-fed surface; import cleanup).
- `docs/phase3-implementation-logs/3P-1_central-oversight-snapshot-fed-only.md`, `docs/qa-command-output/3P-1/`.
