# Phase 4E — Insurance / Mutuelle Workflow Foundation

**Batch:** 4E · **Branch:** `feature/phase4e-insurance` (stacked on 4D) · **Commit message:** `Phase 4E: add insurance and mutuelle workflow foundation`

> **Synthetic data only · NOT Gate 7 · MANUAL only · no insurer API · no auto-adjudication · no automatic claim submission · no production.** Doc 39 §3 (4E), §5, §8, Prompt 4E; builds on Phase 2C billing (manual modes preserved).

## 1. Objective
Model insurance / mutuelle readiness as a **manual, billing-linked** workflow: a **payer registry** + **coverage profiles**, a **patient coverage link** with an **eligibility PLACEHOLDER** (no real insurer verification), **pre-authorization** requests, and **claim drafts** driven through an explicit **manual state machine**. There is **no insurer API, no auto-adjudication, and no automatic claim submission** — `SUBMITTED_PLACEHOLDER` is a manual status a human sets, never a network call.

## 2. Schema (additive — §7 rule: proceed + log)
Migration `20260701040000_phase4e_insurance` (additive; integer FCFA; no existing-table change; Hospital back-relations only):
- **`Payer`** (`@@unique[hospitalId, code]`) — mutuelle / state / private payer registry.
- **`CoverageProfile`** (`@@unique[hospitalId, code]` → Payer cascade) — named benefit with `coveragePercent` (0–100 **placeholder**, no real adjudication).
- **`PatientCoverage`** (→ Hospital + Payer; `patientId`; `eligibilityStatus` default `UNKNOWN`) — a patient's membership; eligibility is a manual placeholder.
- **`PreAuthorizationRequest`** (→ PatientCoverage cascade; `status` default `REQUESTED`) — `REQUESTED → APPROVED / REJECTED`.
- **`ClaimDraft`** (`@@unique[hospitalId, claimNumber]` → PatientCoverage cascade; `amountClaimed` Int FCFA; optional `invoiceId`) — the manual claim.
- Enums: `PatientCoverageStatus`, `EligibilityStatus`, `PreAuthStatus`, `ClaimStatus`.

## 3. THE GUARANTEE — manual only, no auto-submission, no silent state jumps
- **The claim state machine is manual and forward-only:** `DRAFT → SUBMITTED_PLACEHOLDER → UNDER_REVIEW → ACCEPTED / REJECTED`. Skipping is rejected (`DRAFT → ACCEPTED` throws), terminals are terminal. `SUBMITTED_PLACEHOLDER` is a **human-set status, never an insurer call**. Transitions are guarded `updateMany` claims (from → to) so a concurrent double-move loses.
- **Pre-authorization is manual:** `REQUESTED → APPROVED / REJECTED` only, guarded; a second decision loses (`count === 0`).
- **Eligibility is a placeholder:** `setEligibilityPlaceholder` only writes a status label and the audit note explicitly records *"aucune vérification assureur réelle"*. No insurer is contacted.
- **Billing-linked with patient integrity:** a claim may reference an invoice, but the invoice **must belong to the same patient as the coverage** (checked via `invoice.encounter.patientId === coverage.patientId`) — a claim can never bind patient A's coverage to patient B's invoice. 4E writes **no** invoice/payment rows; it only references an existing invoice id.

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `payer.manage` (**administrateur** — non-clinical registry admin) and `claim.manage` (**administrateur** + **caissier** — finance). The screen is gated on `payer.manage OR claim.manage`; each section is gated independently. No clinical access; per-hospital; cross-hospital denied.
- **Audit**: `payer.created`, `payer.updated` (profiles), `coverage.linked` (+ eligibility), `preauth.requested`, `preauth.decided`, `claim.draft_created`, `claim.status_changed`.

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/insurance.test.ts` (5) — payer / coverage-profile (0–100 %) / coverage-link validation + the manual claim and pre-auth state machines (no skipping, terminals terminal).
- **integration** `tests/integration/phase4e-insurance.test.ts` (5) — admin creates a payer + profile (hospital-scoped, audited); coverage link + eligibility placeholder + a **billing-linked claim through the MANUAL machine** (no skipping; 3 audited transitions); pre-auth request + decide; **wrong-patient guard** (a claim cannot link an invoice of a different patient — 0 claims created); RBAC (clinical denied; a non-`payer.manage` cashier cannot create a payer; cross-hospital denied).
- **component** `tests/component/insurance-admin-4e.test.tsx` (3) — payer / coverage-link forms + claim actions render the manual next-states.
- **e2e** `tests/e2e/integration-assurance-4e.spec.ts` (2) — admin registers a payer + coverage profile (manual); clinical doctor redirected (RBAC).
- **Suite at this tip:** unit+component **382**, integration **324** (vitest **706**), Playwright **e2e 61** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase4/4E/`](../qa-command-output/phase4/4E/); screenshot [`docs/phase4e-screenshots/`](../phase4e-screenshots/).

## 6. Adversarial pass (findings fixed before commit)
A targeted review of the service/DB layer surfaced two cross-entity integrity gaps — both fixed and regression-covered:
1. **Cross-payer coverage profile** — `linkPatientCoverage` passed `coverageProfileId` through unvalidated; a profile from another payer/hospital could be attached. **Fixed:** the profile must belong to the linked payer in this hospital.
2. **Wrong-patient claim** (the 4C class) — a claim validated the invoice was in-hospital but not that it belonged to the coverage's patient. **Fixed:** `invoice.encounter.patientId === coverage.patientId` enforced; regression test added.
All other reads/writes were confirmed hospital-scoped (`findFirst { id, hospitalId }`) and all status changes guarded (`updateMany { id, hospitalId, status: from }`).

## 7. Known issues
None. Pre-existing non-blocking `phase3f1` lint warning.

## 8. Boundary confirmation
Synthetic only · **MANUAL only — no insurer API, no auto-adjudication, no automatic claim submission** · eligibility is a placeholder (no real verification) · billing-linked but writes no invoice/payment rows and enforces patient integrity · integer FCFA · finance/registry-gated · hospital-scoped (service + DB) · server-side RBAC · audited · additive schema (§7) · Phase 1A/2/3 golden paths preserved · not Gate 7.

## 9. Files changed
- `prisma/schema.prisma` (+4 enums, +5 models, Hospital back-relations), `prisma/migrations/20260701040000_phase4e_insurance/migration.sql`.
- `lib/insurance.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+7 actions).
- `server/db/insurance.ts` + `server/db/index.ts`; `server/services/insurance-service.ts` + `server/services/index.ts`; `server/actions/insurance-actions.ts`.
- `app/(app)/facturation/assurance/page.tsx`; `components/admin/insurance-admin.tsx`; `components/layout/nav.ts` (+nav item); `messages/fr.json` / `messages/en.json` (`insurance` ns + nav); `tests/unit/i18n-parity.test.ts` (+`insurance`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4E/`, `docs/phase4e-screenshots/`.
