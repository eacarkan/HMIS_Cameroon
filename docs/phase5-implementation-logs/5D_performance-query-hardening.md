# Phase 5D — Performance and Query Hardening

**Batch:** 5D · **Branch:** `feature/phase5d-performance` (from the 5C tip) · **Commit message:** `Phase 5D: harden performance and query behavior`

> **Synthetic data only · NOT Gate 7 · hospital scoping preserved · no unsafe patient-level caching · no schema.** Doc 41 §6 (5D), §5.

## 1. Objective
Improve query behaviour (remove the pg deprecation warning, keep list reads bounded, avoid unsafe caching) **while preserving hospital scoping and privacy**.

## 2. What changed
- **Removed the actionable `pg` `client.query()` deprecation cause.** `applyTemplateToHospital` (`server/db/configuration-templates.ts`) issued four reads via `Promise.all([tx.*…])` **inside an interactive `$transaction`**. Inside a transaction every query runs on the ONE transaction connection, so the parallelism gave no speed-up and tripped pg's *"Calling client.query() when the client is already executing a query"* deprecation. The reads are now **sequential `await`s** — correct and warning-free for that path (the 3A config suite runs with no deprecation output). A full-tree audit confirmed this was the **only** application-level parallel-query-in-transaction; every other `$transaction` (dispensing, reservations, emergency, cancellations, diagnostics, hospitalization, stock-adjustments) already awaits its `tx.*` calls sequentially. The service-level `Promise.all` blocks (dashboard, integration overview, central snapshot) use **pooled** `prisma.*` (each query its own connection) — correct concurrency, left as-is.
- **No unsafe caching guard.** `scripts/check-privacy.ts` now fails if any `server/` `app/` `components/` `features/` file wraps a read in Next's `unstable_cache` — request/hospital-scoped data must never be cached across requests. (None exists today; this locks it in.)
- **List reads stay bounded.** Confirmed the audit-log list is bounded (`take: limit ?? 100`); the per-entity audit trail is naturally bounded by one entity's events. No unbounded high-growth list ships.

## 3. Residual (documented, non-blocking — library level)
A single per-process `pg` deprecation warning can still appear in the e2e `[WebServer]` log (Node prints each deprecation once). Its stack shows **only the `pg` `Client.query` frame — no application frame** — i.e. it originates in the `@prisma/adapter-pg` / `pg` driver layer during interactive transactions, not in our code (which no longer issues parallel in-transaction queries). It is **non-blocking**: all suites pass, no functional control is affected. Fully removing it would require a `pg` / driver-adapter upgrade (out of scope for a synthetic RC-hardening batch). This matches the mentor's classification of the item as runtime/library-related.

## 4. Tests + results (doc 41 §8)
- **integration** `tests/integration/phase5d-performance.test.ts` (1) — the dashboard aggregate (several counts run in **parallel** on pooled connections) reflects **only** the active hospital's data: after seeding at HRB and inserting a same-day patient in another hospital, `patientsToday` counts exactly the HRB patient (scoping preserved through the optimised parallel path).
- **Suite at this tip:** unit+component **410**, integration **339** (+1; vitest **749**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓ (incl. the new no-`unstable_cache` guard) · `check:i18n` **22** ✓. Evidence [`docs/qa-command-output/phase5/5D/`](../qa-command-output/phase5/5D/).

## 5. Boundary confirmation
Hospital scoping preserved on every optimised path · no unsafe patient-level caching (guarded) · no denormalisation bypassing scoping · no new infra · no schema · synthetic · all golden paths green.

## 6. Files changed
- `server/db/configuration-templates.ts` (serialise in-tx reads); `scripts/check-privacy.ts` (+no-`unstable_cache` guard).
- `tests/integration/phase5d-performance.test.ts`; `docs/phase5-implementation-logs/5D_performance-query-hardening.md`; `docs/qa-command-output/phase5/5D/`.
