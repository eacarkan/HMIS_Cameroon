# Phase 4A — Integration Framework & External-System Registry

**Batch:** 4A (first Phase 4 batch) · **Branch:** `feature/phase4a-integration` (from accepted Phase 3 tip `42e9e0f`) · **Commit message:** `Phase 4A: add integration framework and external-system registry`

> **Mock/sandbox-first · synthetic data only · NOT Gate 7 · no live external calls · no real credentials · feature flag OFF.** Doc 39 §3 (4A), §5, §7, §8, §9, Prompt 4A.

## 1. Objective
The generic integration foundation every later Phase 4 batch builds on: a hospital-scoped **external-system registry**, **connector configuration** (environment `MOCK / SANDBOX / PRODUCTION_DISABLED`), credential **REFERENCES** (never secrets), and an **idempotent, audited import/export job framework** with status / attempts / last-error tracking. **No live calls by default.**

## 2. Schema (additive — §7 decision rule: proceed + log)
Migration `prisma/migrations/20260701000000_phase4a_integration_framework/migration.sql` (additive only; **no change to existing tables**; both dev + test DBs synced via `db push` / `db:test:setup`). New enums + models, all hospital-scoped where relevant:
- **enums:** `IntegrationEnvironment` (MOCK / SANDBOX / PRODUCTION_DISABLED — deliberately no enabled "production"), `ExternalSystemStatus` (ACTIVE / INACTIVE / NEEDS_CONFIGURATION), `IntegrationJobStatus` (PENDING / RUNNING / SUCCEEDED / FAILED / CANCELLED), `IntegrationJobEventType`.
- **`ExternalSystem`** (`@@unique[hospitalId, code]`) — the registry; `Hospital` FK + back-relation.
- **`ExternalSystemConfig`** (`@@unique[externalSystemId, key]`) — non-secret config placeholders.
- **`IntegrationConnector`** (`@@unique[externalSystemId, name]`) — environment + active flag + lastError.
- **`IntegrationCredentialReference`** (`@@unique[externalSystemId, name]`) — **reference only** (`referenceKind` + `referenceValue` = an env-var NAME / vault path / description; **never a secret**).
- **`IntegrationJob`** (`@@unique[hospitalId, idempotencyKey]`, `@@index[hospitalId, status]`) — idempotent job with attempts / maxAttempts / lastError / payload / result; `Hospital` FK + back-relation.
- **`IntegrationJobEvent`** — per-job timeline.

No destructive/renaming change; nothing in this batch warranted a halt-and-propose.

## 3. Architecture (mock-first, adapter-based, egress-guarded)
- **`lib/integration/`** (pure, client-safe — no `@/server/*`/Prisma): `adapter.ts` (the `IntegrationConnectorAdapter` interface + `MockIntegrationConnector` that does NO network + `resolveConnectorAdapter` + the `HMIS_INTEGRATION_LIVE_ENABLED` flag, default OFF + `IntegrationLiveDisabledError`); `jobs.ts` (validation, the job status machine, `buildJobIdempotencyKey`, and `looksLikeSecret` / `validateCredentialReference`).
- **Egress guarantee:** `resolveConnectorAdapter` returns the in-memory mock for MOCK/SANDBOX; **`PRODUCTION_DISABLED` ALWAYS throws** (live flag off → `IntegrationLiveDisabledError`; even if a future flag were on, no production adapter is implemented). So **no live network call can originate from this framework** in Phase 4. Proven by a `vi.spyOn(globalThis, "fetch")` egress-guard test.
- **`server/db/integration.ts`** — the only Prisma caller; every read/write carries `hospitalId`; job transitions are GUARDED `updateMany` claims (`claimIntegrationJob` PENDING|FAILED → RUNNING; `completeIntegrationJob` RUNNING → terminal) so a concurrent double-run cannot double-execute; idempotent create keyed on `(hospitalId, idempotencyKey)`.
- **`server/services/integration-service.ts`** — RBAC (`requireCapability`, per-hospital) + audit; the runner is idempotent (a repeat maps to the same job; a terminal job is a no-op) and egress-safe (a PRODUCTION_DISABLED job FAILS safely, audited, no network).
- **`server/actions/integration-actions.ts`** → **`app/(app)/administration/integration/page.tsx`** + **`components/admin/integration-admin.tsx`** (forms; prominent "MOCK / sandbox — no live calls" notice; Fr/En).

## 4. RBAC / audit
- **Capabilities** (`lib/rbac`): `integration.system.manage`, `integration.job.view`, `integration.job.retry`. Assigned to **`administrateur`** (the INTEGRATION admin — already non-clinical) for all three; **`directeur`** gets `integration.job.view` (oversight). **Deliberately NOT granted to any clinical role.** Per-hospital; cross-hospital denied.
- **Audit** (`AUDIT_ACTIONS`): `integration.system_created`, `integration.system_updated`, `integration.connector_configured`, `integration.job_created/started/succeeded/failed/retried`. Every external-system action + every job state change audited (config + job metadata only, never patient data).

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/integration.test.ts` (9) — validation, secret detection, adapter resolution (mock-only; PRODUCTION refused), live-flag fail-closed, job state machine, idempotency key.
- **integration** `tests/integration/phase4a-integration-framework.test.ts` (9) — registry CRUD hospital-scoped + audited; clinical role DENIED; director view-only; **cross-hospital denied**; mock job SUCCEEDED + **idempotent (a repeat creates no 2nd job)**; **PRODUCTION_DISABLED job FAILS safely (no live call)** + bounded retry; **no-real-credential** (secret rejected, only a reference stored); **network-egress guard** (`fetch` spy → 0 calls).
- **component** `tests/component/integration-admin-4a.test.tsx` (2) — forms render; the connector offers only MOCK/SANDBOX/PRODUCTION_DISABLED (no live PRODUCTION).
- **e2e** `tests/e2e/integration-4a.spec.ts` (2) — admin registers a mock system → configures a mock connector → runs a mock job → SUCCEEDED; clinical role redirected (RBAC).
- **Suite at this tip:** unit+component **350**, integration **303** (vitest **653**), Playwright **e2e 52** · `build` ✓ · golden-path `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓. Evidence: [`docs/qa-command-output/phase4/4A/`](../qa-command-output/phase4/4A/); screenshots [`docs/phase4a-screenshots/`](../phase4a-screenshots/).

## 6. Known issues
None. Pre-existing non-blocking lint warning in `phase3f1` test (tracked since Phase 3, optional 3F-1 area).

## 7. Boundary confirmation
Synthetic data only · mock/sandbox-first · **no live calls** (flag OFF; PRODUCTION_DISABLED cannot run) · **credential REFERENCES only** (no secrets; `.env` gitignored) · hospital-scoped (service + DB) · server-side per-hospital RBAC (integration-admin separate from clinical) · every action audited · additive schema (§7: proceeded + logged) · Phase 1A/2/3 golden paths preserved (smoke + full suite green) · no `01_`/`02_` changes · not Gate 7 · not production.

## 8. Files changed
- `prisma/schema.prisma` (+4 enums, +6 models, Hospital back-relations), `prisma/migrations/20260701000000_phase4a_integration_framework/migration.sql`.
- `lib/integration/{adapter,jobs,index}.ts`; `lib/rbac/index.ts` (+3 caps); `server/services/audit-service.ts` (+8 actions).
- `server/db/integration.ts` + `server/db/index.ts`; `server/services/integration-service.ts` + `server/services/index.ts`; `server/actions/integration-actions.ts`.
- `app/(app)/administration/integration/page.tsx`; `components/admin/integration-admin.tsx`; `components/layout/nav.ts` (+nav item); `messages/fr.json` / `messages/en.json` (`integration` ns + `nav.integration`); `tests/unit/i18n-parity.test.ts` (+`integration`).
- `prisma/seed-data.ts` (reset cleanup for the new tables).
- `tests/unit/integration.test.ts`; `tests/integration/phase4a-integration-framework.test.ts`; `tests/component/integration-admin-4a.test.tsx`; `tests/e2e/integration-4a.spec.ts`; `docs/qa-command-output/phase4/4A/`, `docs/phase4a-screenshots/`.
