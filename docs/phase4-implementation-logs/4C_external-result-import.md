# Phase 4C — External Lab/Radiology Result Import Framework

**Batch:** 4C · **Branch:** `feature/phase4c-result-import` (stacked on 4B) · **Commit message:** `Phase 4C: add external diagnostic result import framework`

> **Synthetic data only · NOT Gate 7 · staging (never auto-clinical) · no analyzer/PACS/DICOM · no live connection.** Doc 39 §3 (4C), §5, §8, Prompt 4C; builds on 4A + Phase 2I manual lab/radiology + Phase 3 validator separation.

## 1. Objective
A generic **external diagnostic result import** framework: CSV/manual structured import → **staging** + a **review/validation queue**; duplicate detection + patient/order matching **warnings**; an **adapter interface** for a future HL7/LIS/analyzer/PACS source (mock only). **No live connection; no image storage.**

## 2. Schema (additive — §7 rule: proceed + log)
Migration `20260701020000_phase4c_external_result_import` (additive; no existing-table change):
- **`ExternalResultImport`** (`@@unique[hospitalId, source, externalRef]` = dedupe; `@@index[hospitalId, status]`) — a STAGING record: source/externalRef/patientRef/orderRef/modality/testCode/resultText + `status` (`NEEDS_REVIEW | PROMOTED | REJECTED | DUPLICATE`) + candidate `matchedPatientId`/`matchedOrderId`/`matchWarning` + `importedById`/`reviewedById`/`promotedOrderId`. `Hospital` FK + back-relation. **This is NOT the clinical record.**

## 3. THE #1 GUARANTEE — imported data never clinical until reviewed + validated
- **Staging is separate from the clinical `DiagnosticOrder`.** Import only creates staging rows; it **never** writes a clinical result.
- **Promotion** (by an authorized reviewer) enters the result onto a matched, **in-progress** order **through the EXISTING Phase 2I `enterDiagnosticResultTx`** (guarded `in_progress → result_entered`, `resultEnteredById = reviewer`). The result is now *entered* but **still hidden from the doctor** — the Phase 2I/3 visibility gate (`isResultVisible`/`applyVisibility`) strips `resultText` for non-diagnostics viewers until the order is **validated**.
- **Separation of duties (three-way):** the **importer** (admin) ≠ the **reviewer/enterer** (diagnostics technician; a `importedById === reviewer` guard blocks self-review) ≠ the **validator** (the existing Phase 3 `enter ≠ validate` guard blocks the enterer from validating). So an imported result reaches a doctor only after import → promote(enter) → **separate** validate.
- Matching is **warning-only** (`matchWarning`) — never an automatic clinical link. No analyzer/PACS/DICOM.

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `external_result.import` → **`administrateur`** (the import/integration side); `external_result.review` → **`technicien_diagnostic`** (reviews the queue + promotes/rejects). Deliberately held by **different roles** (importer ≠ reviewer); per-hospital; cross-hospital denied.
- **Audit**: `external_result.imported`, `external_result.match_warning`, `external_result.promoted`, `external_result.rejected`.

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/external-result.test.ts` (4) — CSV parse (valid/missing-column/missing-field), review guard.
- **integration** `tests/integration/phase4c-external-result.test.ts` (7) — import → STAGING + dedupe + audit; unmatched → **warning** (no auto-link); **THE #1 GUARANTEE** (imported result NOT doctor-visible before promote AND validate — verified via `getDiagnosticOrder` returning null, then the text only after a separate validator validates); **importer(admin) cannot review** + clinical role + cross-hospital denied; reviewer **reject** + no re-review of a decided import; reviewer queue visibility; **wrong-patient mismatch is never a promotion candidate** (review fix).
- **component** `tests/component/external-result-import-4c.test.tsx` (3) — import + review forms.
- **e2e** `tests/e2e/integration-import-4c.spec.ts` (3, serial) — admin imports to staging; a **different** reviewer works the queue + rejects; clinical doctor redirected (RBAC).
- **Suite at this tip:** unit+component **366**, integration **315** (vitest **681**), Playwright **e2e 57** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase4/4C/`](../qa-command-output/phase4/4C/); screenshot [`docs/phase4c-screenshots/`](../phase4c-screenshots/).

## 6. Adversarial review (run before commit) — 1 data-integrity fix
A focused adversarial review of the clinical-safety invariant ran before commit. It **confirmed the core invariant HOLDS**: no imported/promoted result reaches a doctor without a **separate** validation — promotion only ever writes `result_entered` through the guarded Phase 2I `enterDiagnosticResultTx`; `isResultVisible` gates non-staff (doctor) visibility on `validated` alone; `applyVisibility` strips `resultText` otherwise; the `enter ≠ validate` DB guard (`NOT enteredById`) blocks the promoter from self-validating; and the importer-self-review guard is present and effective. It surfaced one **data-integrity** gap and one defense-in-depth note:
- **FIXED — wrong-patient promotion.** A patient/order **mismatch** was downgraded to a warning while still setting `matchedOrderId`, so a reviewer could promote patient A's result text onto patient B's in-progress order (wrong-patient data — still hidden until validated, but incorrect). **Fix:** a mismatched or unverified `(patient, order)` pair is now **never stored as `matchedOrderId`** at import, and promotion **re-verifies** `order.patientId === matchedPatientId` — so a mismatched order can never be a promotion target. Regression test added (`(review fix) a patient/order MISMATCH is never a promotion candidate`).
- **Tracked (defense-in-depth, not an active bypass).** Importer ≠ reviewer rests on the runtime `importedById === actor.id` guard (present + correct) with no DB-level backstop; the roles (`administrateur` import vs `technicien_diagnostic` review) are structurally separate today. Noted for a future hardening pass.

## 7. Known issues
None. Pre-existing non-blocking `phase3f1` lint warning.

## 8. Boundary confirmation
Synthetic only · **imported results remain non-clinical STAGING until reviewed + promoted + separately validated; imported data never appears in the doctor-visible validated-result area before validation** · importer ≠ reviewer ≠ validator (validator separation preserved) · matching is warning-only · **no analyzer/PACS/DICOM; no image storage; no live connection** · hospital-scoped (service + DB) · server-side RBAC · audited · additive schema (§7) · Phase 1A/2/3 golden paths preserved · not Gate 7.

## 9. Files changed
- `prisma/schema.prisma` (+1 enum, +1 model, Hospital back-relation), `prisma/migrations/20260701020000_phase4c_external_result_import/migration.sql`.
- `lib/external-result.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+4 actions).
- `server/db/external-result.ts` + `server/db/index.ts`; `server/services/external-result-service.ts` + `server/services/index.ts`; `server/actions/external-result-actions.ts`.
- `app/(app)/laboratoire/import/page.tsx`; `components/admin/external-result-import.tsx`; `components/layout/nav.ts` (+nav item); `messages/fr.json` / `messages/en.json` (`externalResult` ns + nav); `tests/unit/i18n-parity.test.ts` (+`externalResult`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4C/`, `docs/phase4c-screenshots/`.
