# Phase 3F-4 — Cashier Shift DB Enforcement (verify + document)

**Unit:** 3F-4 · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3F-4: enforce one open cashier shift per cashier at DB level`

> **Origin:** implemented in Phase 2 as **H3** (commit `17a9fa1`). 3F-4 **verifies + gap-fills + documents** it against doc 34 §12 — no working logic re-implemented. Synthetic data only.

## 1. Objective
Enforce **one open cashier shift per cashier per hospital** at the DB/transaction level (race-safe); status-guarded close; controlled, audited correction (doc 34 §12).

## 2. Commit
`Phase 3F-4: enforce one open cashier shift per cashier at DB level` — adds the 3F-4 verification suite + this log + evidence (no application-logic change; behaviour shipped in H3).

## 3. Verification against doc 34 §12.14 (required tests)
New suite `tests/integration/phase3f4-cashier-shift-enforcement.test.ts` (4 tests), all passing:

| doc 34 §12.14 requirement | Result |
|---|---|
| Opening a **second shift blocked** | ✅ ("…déjà ouverte…"; exactly one open shift remains) |
| **Concurrent open attempt handled** (race) | ✅ `Promise.allSettled` of two opens → exactly **1 fulfilled, 1 rejected**; one open shift in DB |
| **Closed shift cannot be closed again** | ✅ (status-guarded; re-open after close allowed — constraint is on OPEN only) |
| **Correction controlled and audited** | ✅ (`cashier.closing_corrected` recorded) |
| Cross-hospital independent shifts (if permitted) | ✅ **by construction** — see §7 |

**Gap-fill:** none required. H3's partial unique index `CashierShift_one_open_per_cashier ON ("hospitalId","cashierId") WHERE status='open'` (migration `20260630160000_cashier_shift_one_open` + `scripts/setup-test-db.ts` for the db-push test env) + the `openCashierShift` P2002 friendly-error catch already satisfy §12.14. The race test is the new executable proof that the DB index (not just an application check) wins the race.

## 4. Test evidence
[`docs/qa-command-output/3F-4/`](../qa-command-output/3F-4/). `tsc`/`eslint`/`check:arch`/`check:privacy` clean; targeted **4 passed**; `test:integration` **267 passed**. Vitest total **585** (318 + 267). e2e unchanged at **43** (no app/UI code changed).

## 5. Schema summary
**None added by 3F-4.** The enforcing object — the partial unique index — was shipped with H3 (migration `20260630160000_cashier_shift_one_open`, mirrored in `setup-test-db.ts`). No new migration here.

## 6. RBAC / audit summary
No new capability. `cashier.shift.manage` (cashier opens/closes own shift); correction is controlled + audited. Hospital-scoped (per-hospital via 3A/3B). Audit `cashier.shift_opened/closed`, `cashier.closing_corrected`.

## 7. Known issues / notes
- **Cross-hospital independence is by construction:** the unique index key is `("hospitalId","cashierId")`, so a (hypothetical) multi-hospital cashier could hold one open shift per hospital independently — exactly the "if permitted" behaviour. No seeded cashier is multi-hospital, so this is covered by the index definition rather than an executable test.

## 8. Boundary confirmation (doc 34 §2.1 + §12.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · **no external accounting**, **no production cash-operation authorization** · no `01_`/`02_` changes.

## 9. Files changed
- `tests/integration/phase3f4-cashier-shift-enforcement.test.ts` — the 3F-4 verification suite.
- `docs/qa-command-output/3F-4/` — evidence.
- (No application-logic/schema files changed; the DB index originates in H3 `17a9fa1`.)
