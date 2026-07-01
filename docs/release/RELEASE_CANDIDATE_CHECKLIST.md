# Release-candidate checklist — `v0.5.0-rc.1` (synthetic)

**Synthetic UAT RC · not production · not Gate 7.** Every item below is verified at the final committed tip by the §8 QA block (evidence: `docs/qa-command-output/`).

## Quality gates
- [x] `typecheck` clean
- [x] `lint` — 0 errors, 0 warnings
- [x] `test` (unit + component) green
- [x] `test:integration` green
- [x] `build` (production) green
- [x] `smoke` — GOLDEN PATH passes
- [x] `check:arch` — layering enforced (UI → actions → services → db → Prisma)
- [x] `check:privacy` — no secrets; real-data path disabled; 10 fake `@hrb-demo.cm`; DHIS2/analytics aggregate-only; no `unstable_cache`
- [x] `check:i18n` — bilingual parity for all declared namespaces
- [x] `test:e2e` (Playwright, production build) green; **0 `MISSING_MESSAGE`**
- [x] `check:release` — RC version is synthetic (no production/Gate-7 claim); QA evidence folders present

## Boundary attestation
- [x] Synthetic data only; no real patient data
- [x] Mock/sandbox-first; no live external calls by default (network-egress guards); credential references only; flags off
- [x] Hospital scoping (service + DB) + per-hospital server-side RBAC preserved
- [x] Central oversight aggregate-only (snapshot-fed); no patient-level central disclosure
- [x] Patient matching warning-only (no auto-merge; mock MPI, no network)
- [x] Not production · not Gate 7 · no operational-use authorization
- [x] No changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`
- [x] Not merged to `main`; not pushed

## Packaging
- [x] Version marker `RELEASE_CANDIDATE = v0.5.0-rc.1` (surfaced on the system-status page)
- [x] Release notes, QA evidence index, known issues under `docs/release/`
- [x] Reproducible bundle = `git archive` of the final tip, excluding legacy demo/screenshot folders
