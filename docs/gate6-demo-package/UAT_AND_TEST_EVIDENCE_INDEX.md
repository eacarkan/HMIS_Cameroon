# UAT and Test Evidence Index

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation · **Data:** fake/demo only
**Status:** Draft for mentor review · **Date:** 2026-06-28

> All test and UAT evidence runs on the dedicated **test database** with fictional data. No real patient data, no secrets, no production URLs.

## Latest verification commands (this gate)
Full transcript: `docs/gate6-demo-package/command-output.txt` (captured 2026-06-28, branch `feature/gate4-ui-workflows`, HEAD `ae75762`).

| Command | Latest result | What it proves |
|---|---|---|
| `npm run typecheck` | ✅ exit 0 | Type safety across the codebase |
| `npm run lint` | ✅ exit 0 | Lint + import guardrails clean |
| `npm run build` | ✅ exit 0 (21 routes) | Production build compiles; routes incl. `/rapports-caisse`, `/rapports-caisse/export`, `/administration/utilisateurs` |
| `npm run test` | ✅ **41 passed** (12 files) | Unit + component (money, numbering, RBAC, dates, validation, panels, sidebar, invoice form) |
| `npm run test:integration` | ✅ **55 passed** (13 files) | Services with hospital scoping, RBAC, audit, billing DB tariffs, cashier report/export, user lifecycle + admin-lockout |
| `npm run test:e2e` | ✅ **8 passed** | User flows incl. golden path, RBAC denial, logout |
| `npm run smoke:test` | ✅ GOLDEN PATH PASSED (13 checks) | End-to-end reconciliation: 3 000 FCFA; numbers `HRB-DEMO-P/V/F/R-2026-000001`; KPIs 1/1/3 000; RBAC block; 15-entry audit chain |
| `npm run check:arch` | ✅ pass | UI → actions → services → db → Prisma (no direct DB access in UI) |
| `npm run check:privacy` | ✅ pass | No secrets; `.env` gitignored; prototype label present; 5 fake `@hrb-demo.cm` accounts |

## Gate 5 evidence files (`docs/gate5-evidence/`)
| File | What it proves |
|---|---|
| `README.md` | Consolidated Gate 5 evidence summary, role evidence matrix (allowed/denied with `authz.denied`), and known limitations. "No new features added in Gate 5 — evidence consolidation only." |
| `UAT_CHECKLIST.md` | 24 role-based UAT scenarios (U-01…U-24): ID / actor / scenario / expected / evidence / result, each backed by automated evidence and/or Gate 4 screenshots, plus a sign-off checklist. |
| `command-output.txt` | Gate 5 verification transcript (per-command blocks with `exit=0`). |

> Note: the Gate 5 checklist marked the cashier daily report (U-23) as deferred and mobile (U-24) as pass-with-caveat. The cashier daily report and CSV export were subsequently delivered in **Gate 5B** (commit `ae75762`); the **latest** state is the Gate 6 `command-output.txt` and the Gate 5B screenshots.

## Phase 0 UAT (`docs/testing/`)
| File | What it proves |
|---|---|
| `UAT_PHASE_0_WALKING_SKELETON.md` | Manual Phase 0 walking-skeleton acceptance checklist (French-first, fake data). |
| `UAT_PHASE_0_WALKING_SKELETON_EXECUTED.md` | Executed/filled-in version of the same checklist. |

## QA command output (`docs/qa-command-output/`)
Per-command transcripts captured for mentor review (paths redacted, fake data only): `build.txt`, `check-arch.txt`, `check-privacy.txt`, `lint.txt`, `smoke-test.txt`, `test-e2e.txt`, `test-integration.txt`, `test.txt`, `typecheck.txt`.

## What this evidence does and does not establish
- **Establishes:** the Phase 1 pilot-core workflows function on fake/demo data, with server-side RBAC, hospital scoping, audit, and integer-FCFA billing, under automated verification.
- **Does not establish:** production readiness, real-data suitability, hosting/security audit, legal-EMR validity, or hospital acceptance. Those require **Gate 7** and the decisions in `MINSANTE_DECISIONS_NEEDED.md`.
