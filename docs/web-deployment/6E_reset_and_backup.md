# Phase 6E — Demo Data Reset / Backup Runbook

**Batch:** 6E · **Spec:** Doc 43 §9 (+ Doc 42 §7, §11) · **Commit message:** `Phase 6E: add demo reset and backup runbook`
**Boundary:** **manual reset only — no automatic destructive scheduled reset** · no weekly-by-default · operator-managed · synthetic · Neon backup/restore documented.

## What was implemented
- **`docs/web-deployment/Demo_Reset_and_Backup_Runbook.md`** — the manual demo-reset + backup/restore runbook: the reset policy (manual only), the operator-run `db:seed` / `db:reset` procedure against the Neon **demo** DB, the synthetic seed process, demo-account verification, Neon automatic backups + point-in-time restore + optional `pg_dump` snapshot, and a documented (NOT implemented) optional admin-only reset (capability-gated + audited + synthetic + never automatic).
- **`tests/integration/phase6e-seed-reproducibility.test.ts`** — proves the seed/reset is reproducible: after a reset the baseline is deterministic (ten synthetic `@hrb-demo.cm` accounts + HRB-DEMO), the demo accounts authenticate, and a reset restores a **clean, unlocked** baseline (lockout state cleared) — the manual-reset guarantee behind the runbook.

## Files changed
- **New** `docs/web-deployment/Demo_Reset_and_Backup_Runbook.md`.
- **New test** `tests/integration/phase6e-seed-reproducibility.test.ts` (3).

## Schema / migration
**None.** No automatic reset action is implemented; no schema, no destructive automation.

## RBAC / audit
No new capabilities or audit events (runbook-first). If an optional admin-only reset is coded later, it must be capability-gated + audited (`demo.reset_performed`) + synthetic + never automatic — documented, not implemented here.

## Tests run + results (`docs/qa-command-output/web-deployment/6E/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green · `check:i18n` **26** · `test:integration` **355** (+3 seed reproducibility) · `build` green. (unit+component unchanged at 453.)

## Screenshots / evidence
QA transcripts in `docs/qa-command-output/web-deployment/6E/`. Seed/verify output is the integration-test transcript.

## Known issues
None. (No automatic destructive reset by design.)

## Boundary confirmation
Manual reset only (no auto-destructive, no weekly-by-default) · operator-managed · synthetic · Neon backup/restore documented (not automated by the repo) · no schema change · no `01_`/`02_` changes · not merged/pushed.
