# Phase 2 — QA Patch #2 (server-side encounter enforcement, before Phase 2C)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2-qa-before-2c` (follow-up commit on the same branch)
**This is NOT Phase 2C.** No billing/cashier/refund, pharmacy/prescription, queue, hospitalization, emergency, lab/radiology, DHIS2, offline, or real-data work. No schema change, no migration.

## 1. Objective
Close the one remaining blocker from the QA-patch evaluation: the **server-side** encounter path could still resolve *any* active service by label/code, so a tampered or manual submit could link a visit to a cashier/pharmacy/lab/imaging/inpatient service even though the UI no longer offers them. This patch moves the rule from the UI into the service layer (UI hiding is not security) and adds service/action-level tests proving it.

## 2. Mentor findings addressed (the four required fixes)
1. **Enforce OUTPATIENT + acceptsConsultation at encounter creation (server-side).** `openEncounter` now resolves the service through a restricted resolver and **rejects** anything that is not an active outpatient consultation service.
2. **Enforce the same rule at re-assignment (server-side).** `assignEncounterService` uses the same restricted resolver and rejects before any write or audit.
3. **Stop swallowing service-query errors into the fallback.** The new-visit page no longer wraps the service read in a `try/catch` that collapses every error to the hardcoded list. Errors now propagate to the route error boundary; a *successful but empty* result blocks visit creation with a configuration message.
4. **Add service/action-level tests** for tampered/non-outpatient `serviceLabel` (not only UI/read-path level).

Plus the two sub-points you called out: the fallback list now contains **only outpatient services** (removed **“Médecine interne”**, an inpatient ward), and the re-assignment control is a **restricted dropdown** instead of a free-text field.

## 3. Behavior changed (exact)
### 3.1 Restricted server-side resolver (replaces the broad one)
`server/db/config.ts` — the earlier broad `findActiveServiceUnitByLabel` was **removed** and replaced by:

```
findActiveOutpatientConsultationServiceByLabel(hospitalId, label)
  where: hospitalId, deletedAt = null, isActive = true,
         type = "OUTPATIENT", acceptsConsultation = true,
         OR [ nameFr = label, name = label, code = label ]  (trimmed)
```

It is the only by-label resolver the encounter service can reach, so the broad path no longer exists in code.

### 3.2 `openEncounter` (server/services/encounter-service.ts)
- Resolves the submitted `serviceLabel` (name **or** code) through the restricted resolver.
- If it does **not** resolve to an eligible outpatient consultation service → throws **`Service de consultation externe invalide.`** No encounter row is created.
- On success, links `serviceUnitId` and stores the **canonical** service name as `serviceLabel` (so a record created by submitting a raw code like `SRV-MED-GEN` still reads “Médecine générale”). `serviceUnitId` is never silently set to `null` for a new Phase 2 outpatient encounter.

### 3.3 `assignEncounterService` (re-assignment)
- Same restricted resolver and same rejection (`Service de consultation externe invalide.`), evaluated **before** `updateEncounterService` and **before** the audit write.
- A rejected re-assignment therefore leaves `serviceUnitId` / `serviceLabel` unchanged and records **no** `encounter.assign` audit. A successful one stores the canonical name and audits once.

### 3.4 New-visit page (`app/(app)/patients/[id]/visite/nouvelle/page.tsx`)
- Removed the `try { … } catch { services = [] }` block. The service read is no longer guarded into a fallback.
- **Success + zero outpatient services** → the form is not rendered; a configuration message is shown (`encounter.noOutpatientService`), blocking visit creation.
- **Read throws** (auth/DB) → propagates to the route error boundary (a controlled error state), never a silent fallback.

### 3.5 Action error handling
`openEncounterAction` now returns `{ error: message }` for a server-side validation rejection (it previously re-threw, which would have been a 500). So a tampered POST of `serviceLabel = Caisse` returns a controlled form error and creates no encounter. `assignEncounterServiceAction` already surfaced `error.message`.

### 3.6 UI consistency (re-assignment control)
`components/encounters/encounter-lifecycle.tsx` — the “Affecter au service” control changed from a free-text `<input>` to a `<select>` populated (in `app/(app)/encounters/[id]/page.tsx`) from `listActiveOutpatientConsultationServices`. The current service stays selectable as the default even if later deactivated; the server still validates on submit. The fallback list in `encounter-form.tsx` was trimmed to outpatient services only.

## 4. Files changed
- **Server enforcement:** `server/db/config.ts` (restricted resolver replaces the broad one), `server/db/index.ts` (re-export), `server/services/encounter-service.ts` (`openEncounter` + `assignEncounterService`).
- **Action:** `server/actions/encounter-actions.ts` (`openEncounterAction` controlled error).
- **UI:** `app/(app)/patients/[id]/visite/nouvelle/page.tsx` (no error-swallowing + block-on-empty), `app/(app)/encounters/[id]/page.tsx` (loads restricted services), `components/encounters/encounter-lifecycle.tsx` (restricted dropdown), `components/encounters/encounter-form.tsx` (fallback trimmed, “Médecine interne” removed), `messages/fr.json` (`encounter.noOutpatientService`).
- **Tests:** `tests/integration/outpatient-encounter-enforcement-2qa.test.ts` (new), `tests/integration/encounter.test.ts` (re-assignment now uses a valid outpatient service), `tests/component/encounter-lifecycle.test.tsx` (asserts the restricted dropdown).
- **Evidence:** `docs/qa-command-output/*.txt` refreshed. **No schema change, no migration.**

## 5. Tests added/updated + results
New integration file `outpatient-encounter-enforcement-2qa` (17 cases):
- **openEncounter** — accepts an outpatient service by **label** (links `serviceUnitId`); accepts by **code** and stores the canonical name; **rejects** Caisse / Pharmacie / Laboratoire / Imagerie médicale / Accueil by **both** name and code (and asserts **no** encounter created); **rejects an inpatient ward** (Maternité / `SRV-MED-INTERNE`) even though it has `acceptsConsultation = true` — proving the `type` guard, not just the flag; **rejects a deactivated** outpatient service; **rejects a cross-hospital** outpatient service.
- **assignEncounterService** — allows re-assignment to another outpatient service (canonical name + `serviceUnitId`); **rejects** cashier/pharmacy/lab/imaging/inpatient and asserts `serviceUnitId` / `serviceLabel` are **unchanged**; asserts an audit is recorded **only** on the successful re-assignment, not the rejected one.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **137** · integration **121** (+17) · build ✓ · e2e **22** · smoke **GOLDEN PATH** ✓ · check:arch ✓ · check:privacy ✓. (See `docs/qa-command-output/`.)

## 6. Non-blocking notes (from the evaluation)
- **Stricter `YYYY-MM-DD` DOB parsing** — acknowledged for before real-data pilot; not changed here (you marked it non-blocking, and it is outside the encounter-enforcement scope of this patch).
- **E2E hydration warnings** — kept on the technical-debt list.
- **Temporary-identity / identity-correction echo-on-error UX** — unchanged (still acceptable before 2C, noted in the 2B log).
- **Patient merge** — remains guarded / not implemented (unchanged).

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real patient data · no production authorization · **no Phase 2C billing/cashier/refund** · no pharmacy/prescription · no queue · no hospitalization · no emergency · no lab/radiology · no DHIS2/Mobile Money/external payment/offline · no schema change/migration · `01_Administratif_et_Contrat/**` and `02_Package_Contractuel_Final/**` untouched. **“Go-live” = controlled synthetic-data UAT, not real operation.**

## 8. Confirmation
**Phase 2C was NOT implemented.** Only the four mentor-required follow-up fixes (server-side creation enforcement, server-side re-assignment enforcement, stop swallowing service-query errors, service/action-level tests) plus the two requested sub-points (outpatient-only fallback without “Médecine interne”, restricted re-assignment dropdown) were made.
