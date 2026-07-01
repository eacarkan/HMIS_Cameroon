# Pilot-readiness evidence index (Phase 5H)

> **Readiness evidence only — NOT an authorization.** Gate 7 is an administrative, co-signed (Hospital Director + MINSANTE) decision. The software's readiness signal is hardcoded `authorized: false` and can never self-authorize. **Synthetic data only · not production · no real patient data.**

## What "pilot-ready (synthetic)" means here
The application has assembled the **software-side** evidence for a controlled, synthetic UAT pilot rehearsal. It does **not** assert hardware/network/cyber validation, signed UAT, trained users, backup/restore validation, or any Ministry authorization — those are administrative prerequisites outside software scope (tracked, never self-checked; see the Gate 7 readiness panel on `/etat-systeme`).

## Evidence assembled (software side)
| Area | Evidence |
|---|---|
| Functional golden path | `npm run smoke` (GOLDEN PATH) + `docs/qa-command-output/**/smoke-test.txt` |
| Full regression | unit/component + integration + e2e transcripts under `docs/qa-command-output/phase5/<latest>/` |
| Architecture / privacy / i18n | `check:arch`, `check:privacy`, `check:i18n` transcripts |
| Security / access review | `docs/security/CAPABILITY_ROLE_MATRIX.md` + `phase5/5G/` |
| Release candidate | `docs/release/` (notes, checklist, QA index, known issues) + `check:release` |
| UAT + Gate 7 readiness | Phase 3E tooling (`/uat`, `/etat-systeme`); `computeGate7Signal` → `authorized: false` |
| Demo rehearsal | `docs/pilot-readiness/DEMO_REHEARSAL_CHECKLIST.md`; synthetic factory `docs/uat/DEMO_SCENARIO_PROFILES.md` |

## Outstanding administrative items — NOT software-authorizable
Signed synthetic UAT · validated hardware deployment · cybersecurity baseline assessment · backup/restore validation · trained users · support/incident/fallback procedures · the co-signed **Hospital Director + MINSANTE Gate 7 decision**. These are surfaced as readiness placeholders and marked administrative; the readiness report states plainly *"readiness evidence only — not an authorization"*.

## Critical-blocker status
None expected: financial flows are atomic + status-guarded; access control is per-hospital server-side; cross-hospital reads are denied (central aggregate-only); patient matching is warning-only (no auto-merge); external integrations are mock/flag-off; audit is append-only on critical/central/config/finance/matching workflows. Verified by the Phase 5G access-review sweep + per-phase tests.
