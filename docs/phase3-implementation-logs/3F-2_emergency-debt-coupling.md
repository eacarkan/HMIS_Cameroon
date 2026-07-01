# Phase 3F-2 — Emergency Debt Auto-Coupling (verify + document)

**Unit:** 3F-2 · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3F-2: auto-couple EmergencyDebt to emergency bypass actions`

> **Origin:** implemented in Phase 2 as **H4** (commit `17a9fa1`) on top of the 2H/2G workflow. 3F-2 **verifies + gap-fills + documents** it against doc 34 §10 — no working logic re-implemented. Synthetic data only.

## 1. Objective
Ensure an emergency payment **bypass automatically creates/links an `EmergencyDebt`** in the same controlled workflow, so debt can never silently disappear; the Director waiver requires a reason and is audited; the discharge gate sees all emergency debt; cross-hospital debt access is denied (doc 34 §10).

## 2. Commit
`Phase 3F-2: auto-couple EmergencyDebt to emergency bypass actions` — adds the 3F-2 verification suite + this log + evidence (no application-logic change; behaviour shipped in H4/2H/2G).

## 3. Verification against doc 34 §10.14 (required tests)
New suite `tests/integration/phase3f2-emergency-debt-coupling.test.ts` (6 tests), all passing:

| doc 34 §10.14 requirement | Result |
|---|---|
| Emergency **pharmacy dispense creates/links** debt | ✅ (outstanding placeholder debt auto-created on bypass) |
| Emergency **lab/radiology start creates/links** debt | ✅ (priced debt = catalogue price auto-accrued) |
| **Non-emergency bypass refused** | ✅ (unpaid non-emergency dispense rejected; no debt created) |
| **Waiver audited** (+ Director-only, reason required) | ✅ (`emergency.debt_waived` with reason; empty reason + non-Director rejected) |
| **Discharge blocked when debt unresolved** | ✅ (invoice paid but outstanding emergency debt still blocks discharge) |
| **Cross-hospital debt access blocked** | ✅ (accrual via a non-member context denied — per-hospital RBAC) |

**Gap-fill:** none required. H4's auto-coupling (`startDiagnostic` priced `accrueEmergencyDebtTx`; `dispensePrescription` once-per-prescription placeholder debt), the 2H un-flag/waiver guards, and the 2G discharge gate (`countOutstandingEmergencyDebt`) already satisfy §10.14; the cross-hospital case is further strengthened by per-hospital `requireCapability` (3A/3B).

## 4. Test evidence
[`docs/qa-command-output/3F-2/`](../qa-command-output/3F-2/). `tsc`/`eslint`/`check:arch`/`check:privacy` clean; targeted **6 passed**; `test:integration` **259 passed**. Vitest total **577** (318 + 259). e2e unchanged at **43** (no app/UI code changed).

## 5. Schema summary
**None.** No model/field/migration (`EmergencyDebt` already links the triggering action via `encounterId` + `source`).

## 6. RBAC / audit summary
No new capability. `emergency.flag` (triage/doctor), `emergency.debt.accrue/settle` (cashier), `emergency.debt.waive` (Director only, reason). Audit `emergency.debt_accrued/settled/waived` (waiver carries the reason). Hospital-scoped (per-hospital via 3A/3B).

## 7. Known issues
None for this unit. The 2D-5 emergency dispense raises a **placeholder** debt (amount 0, "à définir à la caisse") to guarantee the discharge gate sees it; pricing it is a cashier follow-up (documented, by design — the gate cannot be bypassed).

## 8. Boundary confirmation (doc 34 §2.1 + §10.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · audit on accrual/settlement/waiver · **no external debt collection**, **no accounting integration**, **no real patient use** · no `01_`/`02_` changes.

## 9. Files changed
- `tests/integration/phase3f2-emergency-debt-coupling.test.ts` — the 3F-2 verification suite.
- `docs/qa-command-output/3F-2/` — evidence.
- (No application-logic files changed; behaviour originates in H4 `17a9fa1` + 2H/2G.)
