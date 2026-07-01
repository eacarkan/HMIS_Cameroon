# Phase 1A — Batch 1B Implementation Log — Encounter lifecycle strengthening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed)
**Branch:** `feature/phase1a-batch-1b-encounter-lifecycle` · **Commit:** `5481ea2` (parent `726b52b` Batch 1A)

## 1. Objective
Give encounters defined states, traceable status history, and service/department context, plus a read-only patient timeline.

## 2. Schema / migration decision — **STOP-AND-PROPOSE item, resolved without a table**
The prompt required deciding whether encounter status history needs a new `EncounterStatusHistory` table. **Decision: NO new table.** The append-only `AuditLog` (action / entityType / entityId / summary / actor / timestamp) fully represents status history; a new `encounter.status_change` audit action records each transition and the history is reconstructed by querying audit entries for the encounter. **No schema change, no migration.** Service/department assignment reuses the existing `Encounter.serviceLabel` column.

## 3. Files changed
- **New:** `lib/encounter-status.ts` (transition rules), `lib/patient-timeline.ts` (compose), `components/encounters/encounter-lifecycle.tsx`, `components/patients/patient-timeline.tsx`, tests (`tests/unit/encounter-status.test.ts`, `tests/unit/patient-timeline.test.ts`, `tests/component/encounter-lifecycle.test.tsx`, `tests/e2e/lifecycle-encounter.spec.ts`), `docs/batch1b-screenshots/`.
- **Modified:** `server/db/encounters.ts` (+`updateEncounterStatus`, `updateEncounterService`, `findPatientTimelineData`), `server/db/audit.ts` (+`findEntityAuditTrail`), `server/db/index.ts`, `server/services/encounter-service.ts` (+`changeEncounterStatus`, `assignEncounterService`, `getEncounterStatusHistory`, `getPatientTimeline`), `server/services/audit-service.ts`, `server/services/index.ts`, `server/actions/encounter-actions.ts`, `lib/constants/index.ts`, `app/(app)/encounters/[id]/page.tsx`, `app/(app)/patients/[id]/page.tsx`, `messages/fr.json`, `tests/integration/encounter.test.ts`.

## 4. Services changed
`changeEncounterStatus` validates transitions (open→closed / open→cancelled; terminal states rejected) server-side; `assignEncounterService` records the service/department; `getEncounterStatusHistory` reconstructs history from audit; `getPatientTimeline` composes a read-only chronology.

## 5. UI changed
Encounter detail: "Cycle de vie" card (close/cancel controls, service assignment, status history). Patient detail: read-only "Chronologie du patient" timeline.

## 6. RBAC changes
None added — status change/assignment reuse `encounter.create`; history/timeline reuse `encounter.read` / `patient.read`. Director remains read-only (cannot change status). Hospital-scoped throughout.

## 7. Audit changes
New actions `encounter.status_change` ("Changement de statut de visite") and `encounter.assign` ("Affectation de visite"), with French labels.

## 8. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **68** (+13); integration **67** (+5); e2e **12**; smoke GOLDEN PATH PASSED; check:arch ✓; check:privacy ✓. Invalid transitions rejected and unchanged-status verified.

## 9. Screenshots (fake data)
`docs/batch1b-screenshots/`: `01-timeline.png`, `02-lifecycle-controls.png`, `03-status-history.png`.

## 10. Known issues / notes
The e2e spec was named `lifecycle-encounter.spec.ts` so it sorts AFTER `golden-path.spec.ts` (the golden path hard-codes patient #000001 and must run first on the shared test DB). Department assignment is stored in `serviceLabel` (free text) — DB-driven department selection deferred (clinician/reception lack `config.read`).

## 11. Boundaries respected
Fake data only; no real-data/production authorization; no inpatient/emergency types, no queue (Phase 2); **no new persistence model** (status history via audit); no migration; layering + arch/privacy guardrails intact; contract/admin folders untouched.
