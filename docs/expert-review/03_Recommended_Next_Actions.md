# Recommended Next Actions — MinSANTE HMIS / SIGH-DME

Baseline `cee1557`. Priority-ordered. **Recommendation: do NOT open another feature/coding phase.** The programme is a credible synthetic RC; the right posture now is **stabilisation + decision control**, plus one small, bounded correctness patch for the two High findings — not new scope.

## 0. Decision-control summary (do these first, they are cheap and de-risk everything)
1. **Tag the synthetic RC baseline** at the final tip: `git tag phase-5-rc1-synthetic-2026-07-01 cee1557` (annotated, local). Marks the reviewed baseline.
2. **Do not merge to `main`** and **do not push** yet — keep `main` clean until a deliberate "internal release baseline" decision. (The branch is intended for mentor review, not integration.)
3. Keep the two mentor packages (`phase4g-mentor-review.zip`, `phase5-mentor-review.zip`) as the review artifacts; they are reproducible from `cee1557`.

## 1. Immediate technical cleanup (low effort, high signal) — a small "5.1 stabilisation patch", NOT a new phase
- **Fix F-01 (payment atomicity).** Wrap `recordPayment`'s create-payment + status-update in one interactive `$transaction` and re-derive `remaining` inside the tx under a row lock (mirror the existing `accrueEmergencyDebtTx` / stock-guard pattern). Add a concurrency regression test. *This is the single most important correctness fix and is small + well-precedented in this codebase.*
- **Fix F-02 (lockout enforcement)** *or* explicitly defer it in writing. Either add the persisted failed-attempt counter + `lockedUntil` (additive migration) and enforce it in the authorize path, **or** record it as an accepted, documented deferral tied to the infrastructure/edge (rate-limiting) work. Do not leave it implied-but-absent.
- Re-run the full §8 QA block; refresh the RC evidence; keep lint 0/0.

## 2. Before the DOSTS demo / technical-readiness presentation
- Rehearse `docs/pilot-readiness/DEMO_REHEARSAL_CHECKLIST.md` end-to-end on a clean reset.
- Present strictly as **synthetic technical readiness** — lead with the boundary statement (`authorized:false`, mock/sandbox-first, no real data). Show the readiness panel + capability matrix + QA evidence index.
- No new features for the demo; the current surface is more than sufficient.

## 3. Before controlled / extended synthetic UAT
- Resolve **F-03** (converge page/nav gating to per-hospital `canAtHospital`) — removes the union-hint inconsistency before multi-hospital UAT users exercise it.
- Establish an **F-04** coverage baseline (`vitest --coverage`), publish it, set soft floors on `lib/`, `server/services`, `server/db` (report, don't hard-gate the RC).
- Freeze the synthetic UAT scenario set from the 5C factory; assign a UAT owner + script.

## 4. Before a real-data pilot / Gate 7 (mostly NOT software)
- **Software:** close F-01/F-02; add **F-05** load/latency evidence at realistic volumes; wire real tariffs for emergency-dispense debt (F-12); optional F-07 DB-level cross-hospital guard, F-13 conservative fuzzy matching (human-review only), F-11 a11y pass, F-14 CI secret-scanning.
- **Non-software (procure/commission — outside this repo):** signed synthetic UAT; validated hardware; LAN/UPS; hosting; **backup + restore drills**; firewalls/telecom; **independent cybersecurity baseline + pen-test (F-06)**; user training; SOPs; incident/fallback procedures.
- **Administrative:** the co-signed **Hospital Director + MINSANTE Gate 7** decision. The software cannot and must not self-authorize this.

## 5. Before production
- Everything in §4, **plus** production infrastructure, monitoring/observability, O&M procedures, and a formal go-live/rollback plan. Enable live integrations only one-at-a-time, behind their flags, each with real-credential vaulting and a per-connector security review.

## 6. Deferred / optional
- F-08 (typed error classes replacing the heuristic sanitiser), F-09 (`pg`/driver upgrade to clear the residual deprecation), F-10 (broaden English i18n if English is a real audience).

## 7. Explicit "do NOT do now"
- Do **not** start Phase 6 / a new functional module — no gap justifies new scope.
- Do **not** implement any live connector (DHIS2/payment/insurer/analyzer/MPI) — these are Ministry-gated, credential-bearing, security-reviewed items.
- Do **not** transfer source code or make production/Gate-7 claims on the strength of this package.
- Do **not** modify `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`.

## 8. Recommended single next step
**Apply the small 5.1 stabilisation patch (F-01 mandatory; F-02 fix-or-document), tag `cee1557`/its successor as the synthetic RC baseline, and hold for the DOSTS technical-readiness presentation — with no new coding phase.** Real-data pilot, production, and live integrations remain gated on the administrative + infrastructure + cybersecurity programme, not on further software features.

---
*Internal review recommendations only. Not a Ministry authorization, not Gate 7; does not approve real patient data or production; does not transfer source code; does not modify the implementation.*
