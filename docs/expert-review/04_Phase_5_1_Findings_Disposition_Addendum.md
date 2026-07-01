# Addendum — Phase 5.1 Findings Disposition (F-01, F-02)

**This is an addendum to the all-phases expert evaluation** (`00_All_Phases_Expert_Evaluation.md`, `01_Findings_Register.md`). The original evaluation inspected the Phase 5 tip `cee1557` and is **not** rewritten. This addendum records how the two **High** findings were dispositioned by the Phase 5.1 stabilisation patch.

**New final tip:** the Phase 5.1 commit on `feature/phase5-1-stabilisation-f01-f02` (baseline `cee1557` → review-docs `ea7c0a2` → Phase 5.1). Hash in the final response / bundle README.

## Disposition

| ID | Original severity | Status | Evidence |
|---|---|---|---|
| **F-01** — payment atomicity | High | **RESOLVED (code)** | `recordPaymentTx` (interactive `$transaction` + `SELECT … FOR UPDATE`); authoritative in-lock re-validation; `tests/integration/phase5-1-payment-atomicity.test.ts` proves concurrent-overpay prevention (exactly one of two full payments succeeds; invoice never over-collects). |
| **F-02** — account lockout | High | **RESOLVED (code)** | Additive `User` lockout columns + enforcement in `authenticateCredentials` (deny-when-locked even with correct password; reset on success; no enumeration); `tests/unit/account-lockout-5-1.test.ts` + `tests/integration/phase5-1-account-lockout.test.ts`. |

## Statement

**The two High software findings from the all-phases expert evaluation have been resolved at the software level, subject to mentor review.** Full QA at the new tip: vitest **772** (unit+component 424 + integration 348), e2e **65**, lint 0/0, build/smoke/typecheck/check:arch/check:privacy/check:i18n/check:release green, 0 MISSING_MESSAGE.

**Real-data pilot still requires** infrastructure, an independent cybersecurity baseline + penetration test, SOPs, training, signed synthetic UAT, and **MINSANTE Gate 7 authorization**. These are administrative/infrastructure items outside software scope.

## No change to authorization status
This addendum does **not** change Gate 7, production, or real-patient-data status. The software remains synthetic-only, mock/sandbox-first, `authorized:false` by design. The remaining Medium findings (F-03 UI per-hospital gating, F-04 coverage baseline, F-05 load testing) and the external-security item (F-06) are unchanged and still recommended before extended UAT / real pilot. The residual `pg` deprecation warning (F-09) is unchanged (non-blocking, library-level).

## Real-data blockers remaining (unchanged, non-software)
Signed UAT · validated hardware · cybersecurity baseline + pen-test · backup/restore drills · trained users · SOPs · support/incident/fallback procedures · co-signed **Hospital Director + MINSANTE Gate 7** decision.
