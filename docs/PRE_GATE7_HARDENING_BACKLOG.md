# Pre–Gate 7 Hardening Backlog (real-data pilot prerequisites)

**Status:** these are **NOT blockers for synthetic-data UAT demonstration** — the Phase 2 code is accepted for controlled synthetic UAT. They are the items to harden **before real patient data / a real cash or emergency pilot / Gate 7**. Captured from the mentor's Phase 2 review and kept separate from the UAT-ready codebase so the two are never conflated.

> Gate 7 also requires the organizational prerequisites that software cannot self-authorize — signed UAT, validated hardware deployment, a baseline cybersecurity assessment, and MINSANTE authorization (see `docs/gate7-readiness/GATE_7_READINESS_EVIDENCE.md`). This backlog is the **software** side only.

## Resolved by the independent expert audit (NOT deferred — already fixed)
The Phase 2 expert audit (`docs/PHASE_2_EXPERT_AUDIT.md`) found **two new defects beyond this backlog and fixed them** (with regression tests in `tests/integration/phase2-expert-audit.test.ts`):
- **[FIXED] BLOCKER — expired stock reservable/dispensable.** `reserveForPrescription` now filters expired lots before FEFO allocation (`!isExpired`), so an expired batch is never reserved or dispensed.
- **[FIXED] MAJOR — prescription on a closed encounter.** `createPrescription` now enforces `encounter.status === 'open'` (matching diagnostics/hospitalization).

Low-priority test-quality follow-up (not a product defect): **16. Strengthen audit-log assertions** — several tests assert audit via `toContain(<number>)`; assert the full record (hospitalId + actorId + action enum + timestamp) so a malformed audit row can't pass.

## ✅ Resolved in the pre-Gate-7 hardening pass (this branch)
Implemented + regression-tested (`tests/integration/phase2-expert-audit.test.ts`); full suite green:
- **[DONE] #3 — Lab/radiology 4-eyes.** `validateDiagnosticResult` now refuses self-validation (`validatedById ≠ resultEnteredById`) at the service AND as a DB-guarded claim, even if one user holds both capabilities.
- **[DONE] #1 + #5 — 2C cancellation/refund atomicity + status guards.** Invoice-cancellation approval now runs in ONE `$transaction` (status-guarded claim → cancel invoice + payments → create voucher; all-or-nothing). Cancellation-decision and RefundVoucher transitions are status-pinned (`updateMany where status = expected`), so a concurrent double-decide loses. Concurrency tests added.
- **[DONE] #4 — One open cashier shift.** A partial unique index `CashierShift_one_open_per_cashier (hospitalId, cashierId) WHERE status='open'` (dev migration + `setup-test-db.ts`) is the race backstop; `openCashierShift` catches the violation and returns the friendly message. Concurrency test added.
- **[DONE] #2 — Emergency bypass auto-couples EmergencyDebt.** An emergency-bypassed **lab/radiology** start auto-accrues the real `EmergencyDebt(catalogue price)`; an emergency-bypassed **pharmacy** dispense (meds are unpriced in 2D) auto-opens a once-per-prescription **placeholder** outstanding debt ("à tarifer"), so the 2G discharge gate can never silently miss the charge. Probes flipped to assert the debt now exists.

**Residual of the financial cluster (still open):** `recordPayment` reads the remaining balance then writes non-atomically, so two cashiers paying the SAME invoice concurrently could exceed the total (rare; partial payments are allowed and the UI shows the remaining). Wrap read+create+status in a transaction with a re-check before real cash use.

## High priority (before real cash / emergency / clinical pilot)

1. **Transactional financial workflows (2C).** Compose the multi-step money flows as a single all-or-nothing transaction:
   - Invoice cancellation approval = one transaction (invoice status update + payment cancellation + RefundVoucher creation).
   - RefundVoucher approve/execute/cancel guarded by the exact current status (status-guarded `updateMany`).
   - Tie the financial audit entry to the same transaction where possible.
2. **Emergency bypass ⇒ debt is automatic (2H + 2D-5 dispensing + 2I lab/radiology).** Any emergency-bypassed pharmacy/lab/radiology/billing action must **create or link an `EmergencyDebt` in the same controlled workflow**, so the discharge gate can never miss a charge that was never accrued. Today the bypass and the debt accrual are separable (debt is a separate cashier action).
3. **Lab/radiology: enter ≠ validate at the USER level (2I).** Capability separation (technician vs validator roles) is in place; add an explicit guard + test so that **the same user who entered a result cannot validate it**, even if they happen to hold both capabilities. Test: a user with both roles enters a result, then tries to validate → refused.
4. **One open cashier shift per cashier (2C).** Enforce at the DB/transaction level (guarded insert / unique-ish constraint), not only in service logic; and avoid a payment/refund race during shift-close total calculation.
5. **Status-guarded atomic transitions for all refund/cancellation moves (2C).** Each transition must claim the exact expected current status atomically so concurrent double-decisions lose.

## Medium priority (before pilot)

6. **Strict `YYYY-MM-DD` DOB parsing (2B)** — replace lenient `Date` parsing on the real-data path.
7. **Concurrency-safe temporary-patient numbering (2B)** — `Inconnu_YYMMDD_NN` sequence under contention.
8. **Validation-error UX on temporary-identity / identity-correction forms (2B).**
9. **Official DHIS2 validation (2E)** — MINSANTE to validate org-unit codes, data-element codes, age/gender bands, diagnosis coding, CSV column format, and the monthly calendar before the CSV is treated as the official DHIS2 format.
10. **Explicit cashier/refund operational SOP (2C)** — who enters/validates/corrects, documented with the hospital.
11. **Ward-fee / discharge **exception** procedure (2G)** — define and (eventually) support the controlled exception for discharging a patient who still owes (Director waiver / social case / transfer / death / administrative exception), with authorization + audit.

## Cross-cutting (apply the strict pattern to high-risk mutations)

12. **No update-by-id-only for financial / stock / emergency / diagnostic / hospitalization transitions.** The pattern for high-risk modules is: `updateMany` with `hospitalId` **and** the expected status, and/or a transaction — never the config-style update-by-id (which is acceptable only for low-risk configuration where the service layer scopes by hospital).
13. **Tighter audit atomicity** for financial / pharmacy / emergency workflows — move the audit write inside the same transaction as the state change (today audit is appended right after the committed transaction — a consistent, mentor-acknowledged pattern, fine for UAT).
14. **Cross-hospital tests** — confirm explicit cross-hospital scoping tests exist for stock adjustments (2D-7) and the other extension modules.
15. **Queue rule (2F)** — decide consciously whether the same patient may hold multiple active tickets for the same service/day.

## Out of scope (not this backlog)
Full offline mode · DHIS2 API · PACS/DICOM / analyzer / LIS integration · Mobile Money / insurance gateways · patient merge · historical real-data migration · production deployment. These remain deferred to later phases per the planning baseline.
