# Phase 5H — Pilot-Readiness Evidence and Demo Rehearsal Mode

**Batch:** 5H · **Branch:** `feature/phase5h-pilot-readiness` (from the 5F tip) · **Commit message:** `Phase 5H: add pilot-readiness evidence and demo rehearsal mode`

> **Synthetic data only · readiness evidence only — NOT an authorization · NOT Gate 7 · not production · no schema.** Doc 41 §6 (5H), §9.

## 1. Objective
Produce demo-rehearsal support + a pilot-readiness evidence index, with clear **"readiness evidence only — not an authorization"** and **"DEMO / SYNTHETIC DATA"** markers — evidence, never authorization.

## 2. What changed (docs + a status-page marker + a guard test)
- **Readiness marker surfaced on `/etat-systeme`.** The existing `GATE7_DISCLAIMER_FR` ("Preuves de préparation uniquement — ne constitue pas une autorisation…") + a **"DÉMO — DONNÉES SYNTHÉTIQUES"** line + the RC label now render in a prominent banner, alongside the always-on fake-data marker and the Gate 7 readiness panel (which flags administrative items as not software-self-authorizable).
- **Demo rehearsal checklist** `docs/pilot-readiness/DEMO_REHEARSAL_CHECKLIST.md` — synthetic reset instructions (`db:reset`), the golden-path + Phase 4/4G demo script, and the §8 verification block.
- **Pilot-readiness evidence index** `docs/pilot-readiness/PILOT_READINESS_EVIDENCE_INDEX.md` — what "pilot-ready (synthetic)" means, the assembled software-side evidence, the outstanding administrative (non-software) items, and the critical-blocker status — headed by the **not-an-authorization** disclaimer.

## 3. THE GUARANTEE (verified)
Pilot-readiness is **evidence, not authorization**. The software's `computeGate7Signal` returns `authorized: false` **even when all UAT scenarios pass and every criterion is "ready"** — Gate 7 is administrative + co-signed. The demo mode is **synthetic only** (deterministic reset; fake `@hrb-demo.cm`).

## 4. Tests + results (doc 41 §8)
- **unit** `tests/unit/pilot-readiness-5h.test.ts` (3) — the readiness signal is never self-authorized even with complete evidence; a blocker keeps it incomplete + unauthorized; the disclaimer states "readiness evidence only — not an authorization" (Fr + En).
- **Demo-reset reproducibility** is covered by the Phase 5C factory test (deterministic after reset; 100% synthetic).
- **Suite at this tip:** unit+component **419** (+3), integration **339** (vitest **758**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓ · `check:i18n` **22** ✓ · `check:release` ✓. Evidence [`docs/qa-command-output/phase5/5H/`](../qa-command-output/phase5/5H/).

## 5. Boundary confirmation
Evidence only (NOT authorization; `authorized: false`) · synthetic demo only · central aggregate-only · no production / Gate 7 · no schema · all golden paths green.

## 6. Files changed
- `app/(app)/etat-systeme/page.tsx` (readiness/DEMO marker banner); `messages/fr.json` (from 5F `releaseCandidate`).
- `docs/pilot-readiness/{DEMO_REHEARSAL_CHECKLIST,PILOT_READINESS_EVIDENCE_INDEX}.md`; `tests/unit/pilot-readiness-5h.test.ts`; `docs/phase5-implementation-logs/5H_pilot-readiness.md`; `docs/qa-command-output/phase5/5H/`.
