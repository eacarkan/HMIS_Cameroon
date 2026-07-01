# Release notes — SIGH/DME `v0.5.0-rc.1` (synthetic)

**Synthetic-data release candidate for mentor / internal UAT review only · not production · not Gate 7 · no real patient data · no live external calls.**

## Summary
This release candidate consolidates the MinSANTE HMIS (SIGH/DME) prototype through **Phase 5** (release-candidate hardening), on top of the mentor-accepted Phase 1A → Phase 4A–4F baseline and the Phase 4G patient-matching readiness foundation. It is a **synthetic UAT** package: mock/sandbox-first, feature-flags off, hospital-scoped, server-side RBAC, audited.

## What's included
- **Phase 1A / 2 / 3** — patient identity, encounters, clinical documentation, cashier/billing, pharmacy (catalogue → dispensing → FEFO → adjustments → reporting), operational reporting + DHIS2 aggregate CSV, queue, emergency exception, hospitalization, lab/radiology, multi-hospital configuration, data separation + per-hospital RBAC, central aggregate-only oversight, site readiness, UAT/Gate-7 readiness evidence.
- **Phase 4A–4F** (mentor-accepted) — integration framework, DHIS2 configurable export, external result import, payment-provider abstraction, insurance/mutuelle foundation, advanced reporting/analytics — all mock/sandbox-first, no live external calls.
- **Phase 4G** — local, warning-only patient-matching + a mock MPI adapter (no network, no auto-merge).
- **Phase 5 (this RC)** — QA hygiene (5A), app-level security/access review (5G), UX/role-dashboard polish (5B), synthetic data factory + UAT scenarios (5C), performance/query hardening (5D), validation/error + bilingual polish (5E), this release packaging (5F), and pilot-readiness evidence + demo rehearsal (5H).

## Boundaries (unchanged)
Synthetic data only · not Gate 7 · not real patient data · not production · not hospital operational authorization · mock/sandbox-first (no live external calls by default; credential references only; flags off) · central oversight aggregate-only · patient matching warning-only (no auto-merge, mock MPI) · no source-code transfer · no `01_`/`02_` changes.

## Verification (final tip)
See [`QA_EVIDENCE_INDEX.md`](QA_EVIDENCE_INDEX.md). Reproduce with the §8 QA block (`typecheck · lint · test · test:integration · build · smoke · check:arch · check:privacy · check:i18n · test:e2e`).

## Known issues
See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md). No critical blocker; the only tracked item is a non-blocking `pg` driver-adapter deprecation warning.
