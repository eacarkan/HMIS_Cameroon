# Phase 5B — UX / Workflow Polish and Role Dashboard Cleanup

**Batch:** 5B · **Branch:** `feature/phase5b-ux-polish` (from the 5G tip) · **Commit message:** `Phase 5B: polish workflows and role dashboards`

> **Synthetic data only · NOT Gate 7 · no RBAC weakening · no control/status indicator hidden · no schema.** Doc 41 §6 (5B), §5.

## 1. Objective
Reduce navigation clutter and show only role-relevant modules **without weakening RBAC and without hiding any financial / clinical / emergency / stock / validation / authorization / mock-sandbox control or status indicator**.

## 2. What changed (UI organisation only — no behaviour/RBAC/schema change)
- **Navigation grouped into ordered sections.** `NAV_ITEMS` gained a `section` field (`main / clinical / pharmacy / billing / reports / admin / account`) and `NAV_SECTIONS` defines the render order + labels. The sidebar now renders the **capability-filtered** items **grouped** under section headers, so a role with many modules sees an organised menu instead of one long flat list.
- **Decluttering hides NOTHING.** The sidebar still shows *every* item the actor's capabilities permit (`NAV_ITEMS.filter(can(roles, cap))`); grouping only re-orders + labels them. A unit test asserts the grouped set equals the filtered set for every role (no item dropped). Server-side RBAC remains the real control; UI grouping is presentation only.
- **Bilingual section labels** added (`nav.sectionMain/Clinical/Pharmacy/Billing/Reports/Admin/Account`) in fr + en (i18n parity green).

## 3. THE CONSTRAINT (verified)
No control or status indicator is hidden. Financial (billing, brouillard, refunds, cancellations, external payments, insurance), clinical (consultations, diagnostics, hospitalizations), emergency/stock (pharmacy stock, adjustments, dispensing), validation (diagnostics, external-result import), authorization/admin (administration, integration, DHIS2, analytics, patient-match, audit, UAT, system status) and the mock/sandbox notices on each Phase 4 screen all remain visible to their permitted roles — grouping changed only the *arrangement*, not visibility. RBAC is unchanged (verified by 5G's matrix + this batch's role-nav tests).

## 4. Tests + results (doc 41 §8)
- **unit** `tests/unit/nav-5b.test.ts` (5) — grouping hides nothing (grouped set == filtered set per role; every item has a known section); a clinical doctor sees clinical but not admin/finance-admin/central modules; the cashier sees billing controls (never hidden) but not clinical-only/central; the administrateur sees admin/integration but NOT central (no cross-hospital cap); the central supervisor sees a MINIMAL menu (central oversight, no patient-level modules).
- **component** `tests/component/sidebar.test.tsx` (4) — updated for the grouped nav (query items as links, since a section header may share a word with an item).
- **Suite at this tip:** unit+component **410** (+5 nav; sidebar tests updated), integration **336** (vitest **746**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓ · `check:i18n` **22** ✓. Evidence [`docs/qa-command-output/phase5/5B/`](../qa-command-output/phase5/5B/).

## 5. Boundary confirmation
No RBAC weakening · server-side authoritative · **no hiding of financial/clinical/emergency/stock/validation/authorization/mock-sandbox controls or status indicators** (grouping only) · no new modules · no new live integrations · no schema · synthetic · all golden paths green.

## 6. Files changed
- `components/layout/nav.ts` (+`section` field + `NAV_SECTIONS`); `components/layout/sidebar.tsx` (grouped render); `messages/fr.json` / `messages/en.json` (+section labels).
- `tests/unit/nav-5b.test.ts`; `tests/component/sidebar.test.tsx` (updated); `docs/phase5-implementation-logs/5B_ux-role-dashboards.md`; `docs/qa-command-output/phase5/5B/`.
