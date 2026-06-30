# HMIS Cameroon — Phase 2 Mentor Review (read me first)

**Project:** HMIS Cameroon (SIGH/DME) prototype for MINSANTE · **Data:** synthetic / fake only · **NOT Gate 7** · no real patient data · no production authorization.

This source bundle is the **final Phase 2** state (core 2A→2E + extensions 2F/2H/2G/2I/2J). It is self-contained: source + tests + migrations + per-unit logs + screenshots + QA evidence.

## Where to look
1. **`docs/phase2-implementation-logs/PHASE_2_CONSOLIDATED_REVIEW.md`** — the one-page cross-batch review (per-unit tables for core + extensions, architecture, RBAC + segregation of duties, data-integrity/concurrency hardening, privacy/no-PII, boundaries, Gate-7 note, known limitations).
2. **`docs/phase2-implementation-logs/PHASE_2A_… … PHASE_2J_…`** — one log per batch (objective, schema, behaviour, RBAC, audit, tests, adversarial-review findings fixed before commit).
3. **`docs/qa-command-output/`** — the actual command transcripts behind the test counts below (typecheck, lint, test, test-integration, build, test-e2e, smoke-test, check-arch, check-privacy).
4. **`docs/gate7-readiness/GATE_7_READINESS_EVIDENCE.md`** (Fr+En) — what the software carries vs. the administrative prerequisites it cannot self-authorize.
5. **`docs/PRE_GATE7_HARDENING_BACKLOG.md`** — the pre-real-data hardening backlog (separate from the UAT-ready code).

## Final QA evidence (this tip)
Reproduce with: `npm install` → provision Postgres (`.env.example`) → `npm run db:push && npm run db:seed` → then each command below (transcripts in `docs/qa-command-output/`).

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test` (unit + component) | green |
| `npm run test:integration` | green |
| `npm run test:e2e` (Playwright, production build) | **40 specs** green |
| `npm run smoke:test` (golden path) | PASSED |
| `npm run check:arch` | green |
| `npm run check:privacy` | green — **9** fake `@hrb-demo.cm` accounts |

**Total Vitest (unit + component + integration): 527 tests across 92 files** (incl. the post-acceptance `phase2-expert-audit` probe suite; 297 unit+component + 230 integration). See `docs/qa-command-output/test.txt` + `test-integration.txt` for the exact split, and `docs/PHASE_2_EXPERT_AUDIT.md` for the independent audit.

> If any count in a log and in `docs/qa-command-output/` disagree, the command-output files are the source of truth (they are the literal transcripts).

## Architecture (enforced)
`lib/* (pure)` → `server/db` (only Prisma caller, hospital-scoped) → `server/services` (capability RBAC + append-only audit) → `server/actions` → `app/` + `components/`. Integer FCFA. Real-data path fail-closed.

## Boundaries
Synthetic data only · not Gate 7 · additive schema only · hospital-scoped · capability RBAC (admin not a clinical/billing superuser) · append-only audit · bilingual · no DHIS2 API (manual CSV) · no patient-level export · 2G ward-level only (no bed map) · 2I text-only (no analyzer/PACS/DICOM) · 2J draft protection (no offline mode) · patient merge not implemented (guarded warning-only).
