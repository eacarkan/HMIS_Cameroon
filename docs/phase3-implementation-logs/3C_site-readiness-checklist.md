# Phase 3C — Site Readiness & Deployment Checklist Module

**Unit:** 3C · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3C: add app-level site-readiness and deployment checklist module`

> App-level **status tracking only** — the software team performs no hardware/LAN/cyber work. Synthetic data only.

## 1. Objective
A per-hospital **site-readiness checklist** (15 categories) with status, owner, evidence note, verifier; a readiness roll-up; read-only views for directors / the central viewer; and the rule that **supplier-dependent items cannot be self-claimed `ready`** (doc 34 §6).

## 2. Commit
`Phase 3C: add app-level site-readiness and deployment checklist module`.

## 3. Schema summary (additive; stop-and-propose → proceed)
**Decision:** propose-in-report + proceed (additive, anticipated by §6.7). One new enum + one new model, no changes to existing tables:
- `SiteReadinessStatus` enum: `not_started, in_progress, ready, blocked, not_applicable, needs_validation`.
- `SiteReadinessItem` (hospital-scoped: `category, status, owner?, evidenceNote?, verifier?, statusDate?`; `@@unique([hospitalId, category])`).
- Migration `20260630190000_phase3c_site_readiness` (standard table+enum+unique+index+FK; no raw-SQL/partial-index needed, so the test db-push picks it up automatically).

## 4. Verification against doc 34 §6.14 (required tests)
| Requirement | Coverage |
|---|---|
| Status transitions; **READY-gating on supplier fields** | ✅ unit (`validateReadinessUpdate`: supplier-dependent `ready` blocked without verifier+evidence; allowed with both; non-supplier `ready` allowed) |
| Hospital scoping | ✅ integration (cross-hospital update denied) |
| RBAC + **read-only roles** | ✅ integration (admin manages; director + central viewer read-only; cashier cannot view) |
| Completeness roll-up | ✅ unit (`summarizeReadiness`: percentReady over applicable; site-ready flag) + integration |
| Component (dashboard/form) | ✅ `tests/component/readiness-forms-3c.test.tsx` |
| e2e (update readiness, view) | ✅ `tests/e2e/site-readiness-3c.spec.ts` (admin updates an item; reception denied) |
| Audit | ✅ `readiness.status_changed` recorded on update (integration) |

## 5. RBAC / audit summary
New capabilities `readiness.manage` (Hospital Admin) + `readiness.view` (Hospital Admin + Director + `superviseur_central`). All decisions are **per-hospital** (`canAtHospital` via `requireCapability`; the page gate uses `rolesByHospital[active]`). New audit `readiness.status_changed` (+ `readiness.item_updated` constant). Hospital-scoped composite-unique upsert (no update-by-id-only).

## 6. READY-gating (the core control)
`validateReadinessUpdate` (pure) rejects `status = ready` for a **supplier-dependent** category (`hardware`, `lan`, `ups`, `cybersecurity`) unless BOTH a `verifier` and an `evidenceNote` are present — otherwise the honest status is `needs_validation`. The service calls it before any write, so a hospital cannot self-attest readiness for work it did not (and cannot) perform. Unit-tested with the bypass attempts (no verifier, verifier-only, evidence-only → all rejected).

## 7. Test evidence
[`docs/qa-command-output/3C/`](../qa-command-output/3C/). `tsc`/`eslint`/`check:arch`/`check:privacy`/`smoke` clean; `npm test` **330 passed**; `test:integration` **277 passed**; `test:e2e` **45 passed** (production build). Vitest total **607** (330 + 277). Screenshots: [`docs/phase3c-screenshots/`](../phase3c-screenshots/).

## 8. Known issues
- "Local server readiness" is treated as **IT-lead-attestable** (not supplier-dependent) — the four supplier-dependent items are `hardware/lan/ups/cybersecurity`. Documented design choice (the physical server's *app readiness* is configured by the local IT lead).
- No central readiness dashboard here; the central aggregate viewer reads readiness **status** per hospital — the central aggregate **view** is 3D.

## 9. Boundary confirmation (doc 34 §2.1 + §6.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · audit on status change · **status-tracking only**, **no infrastructure execution**, **no READY without supplier-dependent evidence** · no `01_`/`02_` changes.

## 10. Files changed
- `prisma/schema.prisma` (+`SiteReadinessStatus`/`SiteReadinessItem`), migration `20260630190000_phase3c_site_readiness`.
- `lib/site-readiness.ts`; `server/db/site-readiness.ts`; `server/services/site-readiness-service.ts`; `server/actions/readiness-actions.ts`.
- `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+2 actions); db/services `index.ts` re-exports; `prisma/seed-data.ts` (reset cleanup).
- `app/(app)/administration/preparation-site/page.tsx`; `components/admin/readiness-forms.tsx`; `app/(app)/administration/page.tsx` (hub link); `messages/fr.json`/`messages/en.json` (`readinessAdmin` namespace, parity-guarded); `tests/unit/i18n-parity.test.ts`.
- `tests/unit/site-readiness.test.ts`; `tests/integration/phase3c-site-readiness.test.ts`; `tests/component/readiness-forms-3c.test.tsx`; `tests/e2e/site-readiness-3c.spec.ts`; `docs/qa-command-output/3C/`, `docs/phase3c-screenshots/`.
