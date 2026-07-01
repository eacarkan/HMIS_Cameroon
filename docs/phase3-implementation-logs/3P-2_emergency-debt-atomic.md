# Phase 3 QA Patch 3P-2 — Emergency-bypass debt: atomic with the triggering action

**Unit:** 3P-2 (mentor follow-up QA patch) · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3 patch: couple emergency-bypass debt atomically to triggering action`

> Focused QA patch addressing the mentor's conditional acceptance. **Not new scope**; refactor + atomicity hardening only. Synthetic data only · not Gate 7 · no production · no schema migration · no `01_`/`02_` changes.

## 1. Problem (mentor finding)
`accrueEmergencyDebtTx` (`server/db/emergency.ts`) was atomic for *debt creation + emergency-flag assertion* and race-safe against un-flag, but it ran in a **separate transaction** from the triggering **pharmacy dispense** (`dispensing-service.ts`) and **diagnostic start** (`diagnostic-service.ts`). A crash/failure between the action commit and the debt commit could leave an emergency service delivered **without** a coupled debt — defeating the discharge gate.

## 2. Change — couple debt + action in ONE transaction
Added `accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource? })` to `server/db/emergency.ts`: it runs on the **caller's** interactive transaction client, so the debt can be folded into the triggering action's `$transaction`. Steps (unchanged guarantees, now sharing the action's tx):
1. a guarded `updateMany(where isEmergency:true)` **asserts the encounter is still emergency** AND takes its **row write-lock** (serialises against `unflagEncounterEmergencyTx` and against a concurrent accrual on the same encounter). If no longer emergency → **throws** → the whole action rolls back.
2. **idempotency (opt-in)**: if a debt with the **same deterministic `source`** already exists on the encounter, it is **reused** (never duplicated). The step-1 row lock makes the find-then-create atomic against a concurrent retry / partial re-dispense.
Returns `{ debt, created }` so the caller audits **only a real accrual**.

- **`server/db/dispensing.ts`** — `dispenseReservationsForPrescription` takes an optional `emergencyDebt` and, **after** the dispense record + status transition (inside the same `$transaction`, only when a record was actually created), accrues the placeholder debt via `accrueEmergencyDebtWithinTx(..., { idempotentBySource: true })`. Returns `emergencyDebt: { id, created } | null`. A no-op dispense (zero reservations won) accrues nothing.
- **`server/db/diagnostics.ts`** — `startDiagnosticTx` now wraps the guarded status claim **and** the priced-debt accrual in one `prisma.$transaction`; the guarded `status in (requested|payment_confirmed) → in_progress` claim means exactly one starter wins, and the accrual runs in the same tx. Returns `{ order, emergencyDebt }`.
- **`server/services/dispensing-service.ts`** / **`diagnostic-service.ts`** — pass the `emergencyDebt` payload into the tx and record the `emergency.debt_accrued` audit **only when `created`** (a retry/partial reuse must not re-audit). The post-tx separate `accrueEmergencyDebtTx` calls were removed.
- **`server/db/emergency.ts`** — `accrueEmergencyDebtTx` (used by the **manual** cashier/Director accrual in `emergency-service.ts`, where recording the debt *is* the action) now delegates to the helper **without** idempotency, so its behaviour is unchanged (always creates).

**Guarantees delivered:** the action and the debt **commit-or-fail together**; the action **fails if the debt cannot be created**; the existing **un-flag serialisation** is preserved (the accrual still takes the encounter row lock, so `isEmergency=false` with outstanding debt is impossible); a **retry / partial re-dispense / concurrent double-action cannot duplicate** the debt; the audit is tied to the successful transaction.

## 3. Schema summary
**None.** No migration. `EmergencyDebt` already has the fields needed; idempotency is keyed on the deterministic `source` string under the encounter row lock — **no new column / index** (so no stop-and-propose was required). Per the mentor's "additive migrations only (stop-and-propose)", I deliberately avoided a schema link and used the in-tx existence check the prompt explicitly allowed.

## 4. RBAC / audit summary
- No RBAC change. `dispense.perform`, `diagnostic.result.enter`, `emergency.flag`, `emergency.debt.*` gates unchanged; per-hospital scoping unchanged.
- `emergency.debt_accrued` now fires exactly once per coupled debt (gated on `created`); the manual accrual audit is unchanged. `dispense.completed` / `diagnostic.started` audits unchanged.

## 5. Tests (6 new — the 4 mentor cases + 2 review regressions)
`tests/integration/phase3p2-emergency-debt-atomic.test.ts` — all 4 of the mentor's required cases plus the 2 defects the adversarial review surfaced:
1. **fail-if-no-debt → no orphaned service** — `startDiagnosticTx` with an emergency debt targeting a **non-emergency** encounter throws and **rolls the start back** (order stays `requested`, zero debt) — proves commit-or-fail-together.
2. **un-flag serialisation invariant** — after an emergency dispense couples the debt, the encounter **cannot be un-flagged** while it is outstanding (stays `isEmergency=true`, debt stays outstanding).
3. **retry → no duplicate** — two `accrueEmergencyDebtWithinTx` calls with the same `source` → second returns `created:false`, same id, **count stays 1**.
4. **retried dispense + retried lab start are safely guarded** — each second call is refused by the status guard; **exactly one** debt per source.
5. **(review regression) in-tx eligibility re-derivation** — a payment confirmed before the start accrues **no spurious debt** on a now-paid exam (`startDiagnosticTx` returns the started order but `emergencyDebt: null`).
6. **(review regression) a settled placeholder is not live coverage** — after the round-1 placeholder is settled, a later same-`source` accrual creates a **fresh outstanding** debt (count 2, outstanding 1).

Existing suites unaffected: `phase3f2-emergency-debt-coupling` (7), `emergency-2h`, `dispensing-2d5`, `diagnostics-2i`, `phase3f3` all still green — full set **36 passed (6 files)**.

## 6. Adversarial review (run before commit) — 2 real defects found + FIXED
A focused adversarial Workflow review (atomicity / idempotency / un-flag-serialisation+deadlock / regression dimensions; each major finding independently verified) ran on the WI2 diff. The un-flag-serialisation/deadlock and audit dimensions returned **no confirmed defect** (lock order is consistent: both the accrual and the un-flag take the encounter row lock before the debt row — no inversion). Two **MAJOR** correctness defects were confirmed (high confidence) and fixed before commit — note **neither broke the atomicity claim** (action + debt still commit together); both were eligibility-correctness bugs:
- **Stale-read eligibility (both paths).** `isPaid`/bypass was read *before* the transaction; a payment confirmed in the read→tx window would couple a spurious debt to a now-paid service (priced lab debt on a paid exam; amount-0 placeholder on a paid prescription). **Fix:** re-derive `isPaid` **inside the tx, under the claimed/updated row's write-lock** (`startDiagnosticTx` re-reads the order; `dispenseReservationsForPrescription` re-reads the prescription after its status `updateMany` lock) and skip the accrual when already paid. Regression test (5).
- **Status-less idempotency dedup.** The in-tx existence check matched *any* same-`source` debt — including a `settled`/`waived` one — so a later dispense round after the round-1 placeholder was settled would silently skip re-accrual, delivering goods with **no outstanding** debt (the discharge gate counts only `outstanding`). **Fix:** the dedup `findFirst` now filters `status: "outstanding"`, so only a *live* placeholder is reused; a decided one forces a fresh outstanding debt. Regression test (6).

## 7. Test evidence
[`docs/qa-command-output/3P-2/`](../qa-command-output/3P-2/): `typecheck` clean; `lint` 0 errors (1 pre-existing warning in `phase3f1` — the optional refund area); `check:arch` green; `check:privacy` green; emergency/dispense/diagnostic + new atomic suite **34 passed (6 files)**. Authoritative full-suite refresh is 3P-3 (WI3).

## 8. Known issues
None introduced. Pre-existing, non-blocking: one unused-var lint warning in `phase3f1-financial-hardening.test.ts` (tracked under the optional 3F-1 refund item).

## 9. Boundary confirmation
Synthetic data only · not Gate 7 · no production · refactor + atomicity only · **no schema change** · hospital scoping + per-hospital RBAC unchanged · audit tied to the successful tx · no `01_`/`02_` changes · no Phase 4.

## 10. Files changed
- `server/db/emergency.ts` (+`accrueEmergencyDebtWithinTx`; `accrueEmergencyDebtTx` delegates).
- `server/db/dispensing.ts` (fold accrual into the dispense tx; `+emergencyDebt` param/result).
- `server/db/diagnostics.ts` (`startDiagnosticTx` → one tx for status + debt; returns `{order, emergencyDebt}`).
- `server/db/index.ts` (export `accrueEmergencyDebtWithinTx`).
- `server/services/dispensing-service.ts`, `server/services/diagnostic-service.ts` (pass payload; audit on `created`).
- `tests/integration/phase3p2-emergency-debt-atomic.test.ts` (4 new tests); `tests/integration/phase3f2-emergency-debt-coupling.test.ts` (unused-param cleanup).
- `docs/phase3-implementation-logs/3P-2_emergency-debt-atomic.md`, `docs/qa-command-output/3P-2/`.
