# Phase 3 Final QA Patch — Central snapshot oversight and emergency debt atomicity

**Branch:** `feature/phase2h-emergency`  
**Scope:** focused mentor-review cleanup only. Synthetic data only; not Gate 7; no production authorization; no Phase 4.

## 1. Objective

Resolve the remaining Phase 3 mentor blockers:

1. Replace stale final-review evidence with current final-tip QA transcripts and a fresh mentor bundle.
2. Ensure central aggregate oversight is **snapshot-fed only**; no central-user-facing path may live-query hospital operational tables.
3. Ensure emergency-bypassed pharmacy and lab/radiology actions create or reuse their linked `EmergencyDebt` inside the same transaction as the triggering action.

## 2. Mentor Findings Addressed

- **Stale evidence / stale archive:** root `docs/qa-command-output/*.txt` represent the post-QA-patch tip and cite consistent counts: vitest 632, unit/component 338, integration 294, Playwright e2e 50, privacy 10 fake `@hrb-demo.cm` accounts.
- **Legacy live central aggregate path:** the former `getCentralAggregates` / `gatherCentralAggregates` live operational-table path is deleted from production service and DB surfaces.
- **Emergency debt not fully atomic:** emergency pharmacy dispense and diagnostic start fold emergency-debt accrual into the action transaction.

## 3. Files Changed

Central oversight:

- `server/services/central-oversight-service.ts`
- `server/db/central-oversight.ts`
- `server/services/index.ts`
- `server/db/index.ts`
- `tests/integration/phase3b-cross-hospital-denial.test.ts`
- `tests/integration/phase3d-central-oversight.test.ts`

Emergency debt atomic coupling:

- `server/db/emergency.ts`
- `server/db/dispensing.ts`
- `server/db/diagnostics.ts`
- `server/services/dispensing-service.ts`
- `server/services/diagnostic-service.ts`
- `server/db/index.ts`
- `tests/integration/phase3f2-emergency-debt-coupling.test.ts`
- `tests/integration/phase3p2-emergency-debt-atomic.test.ts`

Evidence and review material:

- `docs/qa-command-output/`
- `docs/qa-command-output/README.md`
- `docs/phase3-implementation-logs/00_Phase_3_Consolidated_Mentor_Review.md`
- `docs/phase3-implementation-logs/3P-1_central-oversight-snapshot-fed-only.md`
- `docs/phase3-implementation-logs/3P-2_emergency-debt-atomic.md`
- `docs/phase3-implementation-logs/3Z_FINAL_QA_PATCH_CENTRAL_AND_EMERGENCY.md`
- `MENTOR_README.md`

No files under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**` were touched.

## 4. Central Aggregate Cleanup Details

The central-user-facing path is now only:

```text
getCentralOversight(actor)
  -> listLatestHospitalSnapshots()
  -> HospitalAggregateSnapshot + Hospital identity metadata
```

It requires the global `central.aggregate.view` capability and writes `central.aggregate.accessed` audit rows. It does not query patient, encounter, invoice, payment, pharmacy, lab, radiology, or clinical-note operational tables.

`generateHospitalAggregateSnapshot(actor, ctx, period)` remains hospital-side snapshot generation. It is gated by the hospital-scoped `report.operational.read` capability, stores aggregate counts/totals only, and audits `central.snapshot.generated`.

The legacy live central path (`getCentralAggregates` / `gatherCentralAggregates`) was removed from production exports and the DB/service barrels. Tests assert the exports are absent and that central access reads nothing when no snapshots exist, proving it does not enumerate seeded operational hospitals from live tables.

## 5. Emergency Debt Atomic-Coupling Details

`accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource })` was added for callers that must couple debt to an already-running transaction. It:

- asserts the encounter is still emergency with a guarded `updateMany`;
- takes the encounter row lock, serialising against emergency unflag;
- optionally reuses an existing **outstanding** debt with the same deterministic source;
- creates the debt inside the caller transaction when no live debt exists;
- returns `{ debt, created }` so services audit only true new accruals.

Patched flows:

- **Emergency pharmacy dispense:** `dispenseReservationsForPrescription` creates/reuses the placeholder debt in the same transaction as reservation consumption, stock deduction, dispense record creation, and prescription status transition.
- **Emergency lab/radiology start:** `startDiagnosticTx` creates/reuses the priced debt in the same transaction as the guarded diagnostic status transition to `in_progress`.

Normal non-emergency payment-gated workflows are unchanged. Manual cashier/Director emergency-debt accrual still uses its own transaction because recording the debt is itself the action.

Final review cleanup: the transaction result now also returns whether payment was actually deferred after the in-transaction `isPaid` re-check. The service audit summary uses that transaction result rather than the pre-transaction bypass guess, so a concurrent payment race cannot leave a successful action audit saying `URGENCE — paiement différé` when no emergency debt was actually coupled.

## 6. Schema / Migration Changes

No schema or migration was added by this final QA patch. Idempotency uses deterministic `source` plus encounter row locking and filters reuse to `status: "outstanding"`.

## 7. RBAC / Capability Changes

No new capability was added in the final QA patch. Existing controls remain:

- `central.aggregate.view` gates central snapshot oversight.
- `report.operational.read` gates hospital-side snapshot generation.
- `dispense.perform` gates pharmacy dispensing.
- diagnostic start remains gated through the existing diagnostic technician workflow.
- emergency debt manual decisions keep existing cashier/Director controls.

## 8. Audit Changes

- Central read: `central.aggregate.accessed`.
- Snapshot generation: `central.snapshot.generated`.
- Emergency debt: `emergency.debt_accrued` is recorded only after successful action/debt coupling and only when a new debt row is created. Idempotent reuse does not duplicate the audit.
- Failed coupled transactions do not create misleading successful action/debt audit entries.
- Successful action audit summaries use the transaction-confirmed emergency-deferred flag, not the stale pre-transaction eligibility read.

## 9. Tests Added / Updated

Central oversight:

- central supervisor reads snapshot-fed aggregate output;
- hospital roles cannot call central oversight;
- no patient names, patient identifiers, encounter-level details, clinical notes, invoice patient details, pharmacy patient details, or lab/radiology result details appear in central output;
- central aggregate access is audited;
- legacy live service/DB exports are absent;
- with no snapshots, central output is empty rather than live-enumerating operational hospitals.

Emergency debt:

- emergency pharmacy dispense creates/links an outstanding `EmergencyDebt`;
- emergency lab/radiology start creates/links priced `EmergencyDebt`;
- simulated debt-create failure prevents diagnostic start from committing;
- retry/double-start does not duplicate debt;
- emergency unflag race is blocked by encounter-row locking;
- non-emergency unpaid bypass is refused;
- discharge remains blocked while unresolved emergency debt exists;
- cross-hospital emergency debt access is blocked;
- audit is written only for successful accrual/action.

## 10. Final QA Command Results

Root transcripts in `docs/qa-command-output/`:

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors; 1 tracked pre-existing unused-var warning in `phase3f1` test evidence |
| `npm run test` | unit + component **338** |
| `npm run test:integration` | integration **294** |
| `npm run build` | green |
| `npm run smoke` | golden path passed |
| `npm run check:arch` | green |
| `npm run check:privacy` | green; **10** fake `@hrb-demo.cm` accounts |
| `npm run test:e2e` | Playwright e2e **50** |

Total Vitest: **632**.

## 11. Boundaries Respected

Synthetic data only; not Gate 7; no real patient data; no production deployment; no hospital operational-use authorization; no infrastructure execution by the software team; no source-code transfer; no Phase 4 integrations; no DHIS2 API; no PACS/DICOM; no laboratory analyzer integration; no Mobile Money API; no insurance/mutuelle; no national MPI; no historical data migration; no contract/admin documents created.

## 12. Known Issues

- `lint` has 0 errors and one tracked, pre-existing unused-variable warning in optional 3F-1 refund evidence; it is documented and not part of the mentor-blocking Phase 3 final QA patch.
- Pharmacy emergency dispense still creates an amount-0 placeholder because Phase 2D medication pricing is not implemented. This is deliberate: it forces cashier follow-up and keeps the discharge gate effective without starting Phase 4 or a pharmacy pricing feature.

## 13. Confirmation

Phase 3 is ready for mentor final review as a controlled synthetic-data UAT package. It is not a Gate 7 authorization package and does not authorize production, real-data use, infrastructure execution, source-code transfer, or Phase 4 integrations.
