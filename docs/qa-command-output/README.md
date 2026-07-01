# QA command output — provenance

**Synthetic data only · not Gate 7 · no real patient data.**

This folder holds the literal command transcripts behind the QA evidence, organised **per phase**. Read this index to find the authoritative totals for each phase; do not read older folders as the current HEAD.

## Current HEAD
The latest committed tip is the **Phase 5** work-in-progress (release-candidate hardening) stacked on **Phase 4G**. The most recent full-suite transcripts live in the **highest-numbered `phase5/<batch>/`** folder (or `phase4/4G/` if no Phase 5 batch has run yet). Each batch folder is a per-tip snapshot; counts climb monotonically.

## ⚠️ Root-level files = LEGACY Phase 3 evidence (NOT the current HEAD)
The root `*.txt` files (`test.txt`, `test-integration.txt`, `test-e2e.txt`, `check-arch.txt`, `check-privacy.txt`, `smoke-test.txt`, `lint.txt`, `typecheck.txt`, `build.txt`) are the **Phase 3 final-tip** snapshot (`42e9e0f`): vitest **632** (338 + 294), e2e **50**. Retained for Phase 3 provenance only — **not** the current HEAD.

## Per-phase evidence folders
| Phase | Folder(s) | Final-tip totals (that phase) |
|---|---|---|
| **Phase 3** | root `*.txt` + `3A/ 3B/ 3F-1…3F-5/ 3C/ 3D/ 3E/ 3P-1/ 3P-2/` | vitest 632 (338 + 294) · e2e 50 |
| **Phase 4A–4F** | `phase4/4A/ … phase4/4F/` + **`phase4/FINAL/`** (mentor-accepted tip `2e37994`) | vitest **720** (392 + 328) · e2e **63** · lint 0/0 |
| **Phase 4G** | `phase4/4G/` (tip `6a99c05`) | vitest **734** (401 + 333) · e2e **65** · lint 0/0 |
| **Phase 5** | `phase5/<batch>/` (5A, 5G, 5B, 5C, 5D, 5E, 5F, 5H — added as each batch commits) | see the highest-numbered batch folder |

The per-batch folders are the authoritative, dated transcripts referenced by each implementation log and consolidated review (`docs/phase4-implementation-logs/`, `docs/phase4g-implementation-logs/`, `docs/phase5-implementation-logs/`).

## Reproduce from scratch
`npm install` → provision Postgres → `npm run db:push && npm run db:seed` → the §8 QA block:
```
npm run typecheck && npm run lint && npm run test && npm run test:integration \
  && npm run build && npm run smoke && npm run check:arch && npm run check:privacy \
  && npm run check:i18n && npm run test:e2e
```
`npm run check:i18n` runs the bilingual i18n-parity guard (`tests/unit/i18n-parity.test.ts`).
