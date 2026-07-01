# Phase 3F-1 — Financial Transaction Hardening (verify + document)

**Unit:** 3F-1 · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3F-1: harden financial transactions (atomic cancellation/refund guards)`

> **Origin:** the financial hardening this unit covers was implemented in Phase 2 as **H2** (commit `17a9fa1`). Per the operator's direction, 3F-1 **verifies + gap-fills + documents** that work against doc 34 §9 — it does **not** re-implement working logic. Synthetic data only.

## 1. Objective
Harden cancellation/refund financial workflows for atomicity before any real-data pilot: atomic, status-guarded transitions; no double-approval/double-refund; requester ≠ approver; cross-hospital denied; audit only on a successful transition (doc 34 §9).

## 2. Commit
`Phase 3F-1: harden financial transactions (atomic cancellation/refund guards)` — adds the 3F-1 verification suite + this log + evidence (no application-logic change; the behaviour shipped in H2).

## 3. Verification against doc 34 §9.14 (required tests)
New suite `tests/integration/phase3f1-financial-hardening.test.ts` (6 tests) maps 1:1 to the required list — **all pass against the existing H2 implementation**:

| doc 34 §9.14 requirement | Result |
|---|---|
| Cancellation approval **all-or-nothing** (invoice + payments cancelled + voucher raised together) | ✅ |
| Refund voucher **cannot execute twice** (status-guarded) | ✅ |
| **Cancelled voucher cannot be approved** | ✅ |
| **Cross-hospital refund blocked** (per-hospital RBAC) | ✅ |
| **Cashier self-approval blocked** (lacks approve cap) + **requester ≠ approver** (dual-cap user cannot approve own request) | ✅ |
| **Audit only on a successful transition** (failed second execute writes no new audit) | ✅ |
| **Financial totals remain consistent** (voucher amount = collected amount; no recorded payment survives) | ✅ |

**Gap-fill:** none required — H2 already satisfies every §9.14 requirement. The implementation (`approveCancellationTx` `$transaction`: status-guarded claim → cancel invoice + recorded payments → create voucher; status-pinned `updateRefundVoucher`; `isSeparateApprover` guard) is unchanged. The cross-hospital case is additionally strengthened by the Phase 3A/3B **per-hospital `requireCapability`**.

## 4. Test evidence
Raw transcripts: [`docs/qa-command-output/3F-1/`](../qa-command-output/3F-1/). `tsc`/`eslint`/`check:arch`/`check:privacy` clean; targeted suite **6 passed**; `test:integration` **253 passed** (was 247 + 6). Vitest total **571** (318 + 253). e2e unchanged at **43** (no app/UI code changed in this unit — see 3B e2e evidence).

## 5. Schema summary
**None.** No model/field/migration. (H2's only migration was the cashier-shift index, which belongs to 3F-4.)

## 6. RBAC / audit summary
No new capability. Decisions: cashier `invoice.cancel.request`; admin `invoice.cancel.approve` (requester ≠ approver enforced); `refund.execute` (cashier). All hospital-scoped (now per-hospital via 3A/3B). Audit `invoice.cancellation_approved`, `refund_voucher.created/approved/executed/cancelled` — written only after a successful transition.

## 7. Known issues
None for this unit. (The residual `recordPayment` concurrent-overpay item from the Phase 2 backlog is a separate, still-deferred concern; not in 3F-1 scope.)

## 8. Boundary confirmation (doc 34 §2.1 + §9.17)
Synthetic / fake data only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · audit on transitions · **no external accounting**, **no Mobile Money API**, **no insurance**, **no real cash-operation authorization** · no `01_`/`02_` changes.

## 9. Files changed
- `tests/integration/phase3f1-financial-hardening.test.ts` — the 3F-1 verification suite.
- `docs/qa-command-output/3F-1/` — evidence.
- (No application-logic files changed; behaviour originates in H2 `17a9fa1`.)
