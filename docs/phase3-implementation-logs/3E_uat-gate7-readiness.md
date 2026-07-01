# Phase 3E — UAT Evidence & Gate 7 Readiness Package (evidence only)

**Unit:** 3E (final Phase 3 unit) · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3E: add UAT evidence and Gate 7 readiness package (evidence only, no authorization)`

> **EVIDENCE ONLY** — the software never authorizes Gate 7 (administrative, co-signed Hospital Director + MINSANTE). Synthetic UAT only.

## 1. Objective
Structured **UAT evidence** + a **Gate 7 readiness package** — a scenario library, execution records (pass/fail/blocker), a Gate 7 criteria checklist with Director/MINSANTE **sign-off placeholders**, and a readiness report that **explicitly disclaims authorization** (doc 34 §8).

## 2. Schema (additive; stop-and-propose → proceed)
Three additive models (anticipated by §8.7), reusing the `SiteReadinessStatus` enum — no existing-table change. Migration `20260630210000_phase3e_uat_gate7`:
- `UatScenario` (hospital-scoped library; `@@unique[hospitalId, code]`).
- `UatExecution` (latest result per scenario; `UatStatus` not_run/pass/fail/blocker; `@@unique[hospitalId, scenarioId]`).
- `Gate7ReadinessItem` (criterion + status + **Director/MINSANTE sign-off placeholders**; `@@unique[hospitalId, criterion]`).

## 3. The core guarantee — never an authorization
- `computeGate7Signal(...).authorized` is **hardcoded `false`** — the signal reports only whether *evidence is assembled*, never approval.
- `getUatEvidence` always returns the disclaimer (`GATE7_DISCLAIMER_FR/EN` — "preuves de préparation uniquement — ne constitue pas une autorisation"), and the `/uat` page renders it as a prominent banner.
- Sign-off fields are **placeholders** (free text, no legal e-signature), set only by the Director (`uat.signoff_placeholder`).

## 4. Verification against doc 34 §8.14 (required tests)
| Requirement | Coverage |
|---|---|
| Status / blocker logic | ✅ unit (`summarizeUat`, `computeGate7Signal`) |
| Hospital scoping | ✅ integration (cross-hospital recording denied) |
| RBAC + sign-off placeholders | ✅ integration (admin manages; **Director-only** sign-off — admin denied; cashier cannot view) |
| **Report states "readiness evidence only — not authorization"** | ✅ unit (disclaimer text) + integration (`disclaimerFr` matches; `signal.authorized === false`) + e2e (banner visible) |
| e2e: record UAT → readiness report | ✅ `tests/e2e/uat-gate7-3e.spec.ts` |
| Audit | ✅ `uat.scenario_created` / `uat.execution_recorded` / `gate7.item_updated` / `gate7.signoff_placeholder_changed` |

## 5. RBAC / audit summary
Caps `uat.manage` (admin: record executions + Gate 7 criteria), `uat.signoff_placeholder` (Director: placeholders only), `uat.view` (admin/director/central). All per-hospital. Audit: `uat.scenario_created`, `uat.execution_recorded`, `uat.status_changed`, `gate7.item_updated`, `gate7.signoff_placeholder_changed`. Composite-unique upserts (no update-by-id-only).

## 6. UI
`/uat` — prominent non-authorization disclaimer banner; readiness summary (UAT pass / Gate 7 ready / evidence-assembled badge, blocker flag); the UAT scenario library (per-scenario status form for managers); the Gate 7 checklist (status form for managers + sign-off-placeholder form for the Director; read-only otherwise). Nav item `/uat` + bilingual `uat` namespace (parity-guarded).

## 7. Test evidence
[`docs/qa-command-output/3E/`](../qa-command-output/3E/). `tsc`/`eslint`/`check:arch`/`check:privacy`/`smoke` clean; `npm test` **338 passed**; `test:integration` **287 passed**; `test:e2e` **50 passed**. Vitest total **625** (338 + 287). Screenshots: [`docs/phase3e-screenshots/`](../phase3e-screenshots/).

## 8. Known issues
- The printable readiness report is the `/uat` page itself (browser print); a dedicated print-stylesheet view is a cosmetic follow-up.
- Sign-off placeholders are deliberately free text (no legal e-signature) per §8.5.

## 9. Boundary confirmation (doc 34 §2.1 + §8.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · audit on UAT/Gate7 changes · **evidence only**, **no authorization claim**, **no legal e-signature**, **no official-letter / contract generation** · no `01_`/`02_` changes.

## 10. Files changed
- `prisma/schema.prisma` (+`UatStatus`, `UatScenario`, `UatExecution`, `Gate7ReadinessItem`), migration `20260630210000_phase3e_uat_gate7`.
- `lib/uat-gate7.ts`; `server/db/uat-gate7.ts`; `server/services/uat-gate7-service.ts`; `server/actions/uat-actions.ts`.
- `lib/rbac/index.ts` (+3 caps); `server/services/audit-service.ts` (+5 actions); db/services `index.ts` re-exports; `prisma/seed-data.ts` (reset cleanup).
- `app/(app)/uat/page.tsx`; `components/admin/uat-forms.tsx`; `components/layout/nav.ts` (nav item); `messages/fr.json`/`messages/en.json` (`uat` ns + `nav.uat`); `tests/unit/i18n-parity.test.ts`.
- `tests/unit/uat-gate7.test.ts`; `tests/integration/phase3e-uat-gate7.test.ts`; `tests/e2e/uat-gate7-3e.spec.ts`; `docs/qa-command-output/3E/`, `docs/phase3e-screenshots/`.
