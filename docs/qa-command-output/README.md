# QA command output — provenance

**Synthetic data only · not Gate 7 · no real patient data.**

This folder holds the literal command transcripts behind the Phase 3 evidence.

## Root-level files = the final-tip (HEAD) suite snapshot
The root files here (`test.txt`, `test-integration.txt`, `test-e2e.txt`, `check-arch.txt`, `check-privacy.txt`, `smoke-test.txt`, `lint.txt`, `typecheck.txt`, `build.txt`) are the **final-tip run** at the **Phase 3 QA-patch tip** (after `3P-1` central-oversight-snapshot-fed-only + `3P-2` emergency-debt-atomic). The only commit after the code changes (this evidence-refresh commit) adds documentation only, so the root files == HEAD for code/tests.

**Final-tip totals (post-QA-patch):** vitest **632** (unit+component **338** in `test.txt` + integration **294** in `test-integration.txt`) · Playwright e2e **50** (`test-e2e.txt`, production build) · golden-path smoke pass (`smoke-test.txt`) · `next build` green (`build.txt`) · `typecheck` clean · `lint` **0 errors** (1 pre-existing unused-var warning in a `phase3f1` test, tracked under the optional 3F-1 refund item) · `check:arch` + `check:privacy` green (10 fake `@hrb-demo.cm` accounts).

> The integration count rose 287 → **294**: +6 from the new `phase3p2-emergency-debt-atomic` suite (4 mentor cases + 2 adversarial-review regressions) and +1 from the rewritten `phase3b` central section (snapshot-fed proofs). Unit+component and e2e are unchanged (338 / 50). The production build is also re-exercised by the 50 e2e tests at the tip (Playwright runs against the production build).

## Per-unit folders = progressive evidence
`3A/ 3B/ 3F-1/ … 3F-5/ 3C/ 3D/ 3E/` each contain the suite as it stood when that unit was committed, so the counts climb monotonically (3A 315+242/43 → 3B 318+247/43 → 3C 330+277/45 → 3D 331+282/48 → 3E 338+287/50 → **QA patch 338+294/50**), plus per-unit targeted tests (e.g., `test-3f5-targeted.txt`). The QA-patch folders `3P-1/` and `3P-2/` hold the targeted evidence for the two patch commits. These are the authoritative, dated transcripts referenced by each implementation log and by the consolidated review.

To reproduce from scratch: `npm install` → provision Postgres → `npm run db:push && npm run db:seed` → `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build && npm run smoke && npm run check:arch && npm run check:privacy && npm run test:e2e`.
