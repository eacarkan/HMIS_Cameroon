# Phase 5A — Known-Issue Burn-Down and QA Hygiene

**Batch:** 5A · **Branch:** `feature/phase5a-qa-hygiene` (from the Phase 4G tip `6a99c05`) · **Commit message:** `Phase 5A: clean QA hygiene and known issues`

> **Synthetic data only · NOT Gate 7 · no behavior/feature change · no schema.** Doc 41 §6 (5A), §8, §9. Release-candidate hygiene only.

## 1. Objective
Burn down known issues + QA hygiene: **0 lint warnings**, no missing i18n keys, no stale QA references, a consolidated QA-evidence index, updated mentor READMEs, and internally-consistent test counts.

## 2. What changed (docs / config only — no source/behaviour change)
- **Lint is 0 errors, 0 warnings.** The 4G batch's residual warnings (2 unused imports + 3 unused args) were already cleared in the 4G commit `6a99c05`; 5A confirms and owns the clean baseline (evidence `phase5/5A/lint.txt`).
- **i18n:** no missing keys. The bilingual parity guard passes for **22** namespaces (now incl. `roles`, `analytics`, `patientMatch`), and a full production-build e2e run shows **zero** `MISSING_MESSAGE` in the server log. Added a first-class **`npm run check:i18n`** script (runs `tests/unit/i18n-parity.test.ts`) so the QA block can cite it (doc 41 §8).
- **QA provenance / consolidation:** rewrote `docs/qa-command-output/README.md` into a clear **per-phase index** — root `*.txt` = legacy Phase 3; `phase4/FINAL/` = the Phase 4A–4F mentor-accepted evidence (720 / 63); `phase4/4G/` = Phase 4G (734 / 65); `phase5/<batch>/` = Phase 5 (added per batch). No stale count is presented as the current HEAD.
- **Mentor READMEs:** added a non-stale pointer at the top of `MENTOR_README.md` — it remains the Phase 4A–4F accepted baseline, and now points to the separately-packaged Phase 4G and (in-progress) Phase 5 evidence, and to the per-phase QA index.
- **Test-count consistency:** the QA README, the phase logs, and this batch's transcripts all cite the same current-HEAD totals (vitest **734** = unit+component 401 + integration 333; e2e **65**).

## 3. Boundary confirmation
No behaviour/feature change · no schema/migration · no new integration · RBAC/scoping/central-aggregate rules unchanged · synthetic only · all Phase 1A/2/3/4/4G golden paths green.

## 4. Tests + results (doc 41 §8)
Full §8 block + i18n parity, all green: `typecheck` clean · `lint` **0 errors, 0 warnings** · `test` **401** (unit+component) · `test:integration` **333** (vitest **734**) · `build` ✓ · `smoke` GOLDEN PATH ✓ · `check:arch` ✓ · `check:privacy` ✓ (10 fake `@hrb-demo.cm`) · **`check:i18n` 22** ✓ · `test:e2e` **65** (production build; **0 `MISSING_MESSAGE`**). Evidence [`docs/qa-command-output/phase5/5A/`](../qa-command-output/phase5/5A/).

## 5. Known issues
- **Non-blocking (tracked for 5D):** a `pg` `client.query()` `pg@9` deprecation warning appears in some test/e2e `[WebServer]` logs (library/runtime, not a failed control) — flagged by the mentor as a Phase 5 backlog item; investigated + cleaned if practical under 5D.

## 6. Files changed
- `package.json` (+`check:i18n` script); `docs/qa-command-output/README.md` (per-phase index); `MENTOR_README.md` (non-stale 4G/Phase-5 pointer).
- `docs/phase5-implementation-logs/5A_qa-hygiene.md`; `docs/qa-command-output/phase5/5A/` (transcripts).
