# Phase 5F — Release Candidate Packaging and Versioning

**Batch:** 5F · **Branch:** `feature/phase5f-release-packaging` (from the 5E tip) · **Commit message:** `Phase 5F: add release candidate packaging and versioning`

> **Synthetic data only · NOT Gate 7 · not production / no deployment · no schema.** Doc 41 §6 (5F), §9.

## 1. Objective
Establish reproducible release-candidate **packaging + versioning + release notes + evidence index + known-issues**, with a guardrail that keeps the evidence index honest and the version marker clearly synthetic.

## 2. What changed (versioning + docs + guardrail — no behaviour/schema change)
- **RC version marker.** `RELEASE_CANDIDATE = "v0.5.0-rc.1"` + `RELEASE_LABEL` ("Candidat de version (RC) — données synthétiques · non production · hors Gate 7") in `lib/constants`, **surfaced on the system-status page** (`/etat-systeme`) alongside the app version and the always-on fake-data marker.
- **Release docs** under `docs/release/`: `RELEASE_NOTES.md` (what's in the RC + boundaries), `RELEASE_CANDIDATE_CHECKLIST.md` (quality gates + boundary attestation + packaging), `QA_EVIDENCE_INDEX.md` (phase/batch → evidence folder + log), `KNOWN_ISSUES.md` (no critical blocker; the non-blocking `pg` driver warning + by-design mock/placeholder items).
- **`check:release` guardrail** (`scripts/check-release.ts`, wired as `npm run check:release`): asserts the version marker is a synthetic RC (regex `vX.Y.Z-rc.N`; label states synthetic + non-production; **no** production/Gate-7 claim) and that the release docs + the **QA evidence folders the index references actually exist** — so the evidence index can't drift from reality.

## 3. Tests + results (doc 41 §8)
- **unit** `tests/unit/release-5f.test.ts` (2) — the marker is a `vX.Y.Z-rc.N` RC; the label is synthetic + non-production + "hors Gate 7" and carries no production-ready/authorization claim.
- **`check:release`** ✓ — `v0.5.0-rc.1` synthetic; release docs + 8 referenced QA evidence folders present.
- **Suite at this tip:** unit+component **416** (+2), integration **339** (vitest **755**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓ · `check:i18n` **22** ✓. Evidence [`docs/qa-command-output/phase5/5F/`](../qa-command-output/phase5/5F/).

## 4. Reproducible bundle
The mentor bundle is a `git archive` of the final committed tip, excluding the legacy `docs/gate6-demo-package`, `docs/gate5b-screenshots`, and `mentor-review/` — identical recipe to Phases 3/4/4G, so it is reproducible from any clean checkout.

## 5. Boundary confirmation
No production / no deployment · synthetic RC marker (no Gate-7/production claim) · reproducible packaging · no schema · all golden paths green.

## 6. Files changed
- `lib/constants/index.ts` (+`RELEASE_CANDIDATE`/`RELEASE_LABEL`); `app/(app)/etat-systeme/page.tsx` (surface the RC); `messages/fr.json` (`systemStatus.releaseCandidate`).
- `scripts/check-release.ts` (+`check:release` script); `docs/release/{RELEASE_NOTES,RELEASE_CANDIDATE_CHECKLIST,QA_EVIDENCE_INDEX,KNOWN_ISSUES}.md`.
- `tests/unit/release-5f.test.ts`; `docs/phase5-implementation-logs/5F_release-packaging.md`; `docs/qa-command-output/phase5/5F/`.
