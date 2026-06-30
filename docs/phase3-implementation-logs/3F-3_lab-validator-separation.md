# Phase 3F-3 — Lab/Radiology Validator Separation (verify + document)

**Unit:** 3F-3 · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3F-3: enforce lab/radiology validator separation (entry user cannot validate)`

> **Origin:** implemented in Phase 2 as **H1** (commit `17a9fa1`) on the 2I manual lab/radiology workflow. 3F-3 **verifies + gap-fills + documents** it against doc 34 §11 — no working logic re-implemented. Synthetic data only.

## 1. Objective
Ensure the user who **enters** a lab/radiology result **cannot validate** the same result — even when holding both capabilities — enforced server-side; and the doctor cannot see an unvalidated result (doc 34 §11).

## 2. Commit
`Phase 3F-3: enforce lab/radiology validator separation (entry user cannot validate)` — adds the 3F-3 verification suite + this log + evidence (no application-logic change; behaviour shipped in H1).

## 3. Verification against doc 34 §11.14 (required tests)
New suite `tests/integration/phase3f3-lab-validator-separation.test.ts` (4 tests), all passing:

| doc 34 §11.14 requirement | Result |
|---|---|
| Same user enters and attempts validation — **denied** | ✅ (dual-cap agent rejected with "…doit être différent…") |
| **Different validator — allowed** | ✅ |
| User with **both roles cannot validate own result** | ✅ (server-side guard `order.resultEnteredById === actor.id` + DB `NOT { resultEnteredById }`) |
| **Cross-hospital validation blocked** | ✅ (per-hospital RBAC) |
| **Doctor cannot see unvalidated result** | ✅ (visibility gate strips `resultText` until validated; staff see it; doctor sees it post-validation) |

**Gap-fill:** none required. H1's service guard (`validateDiagnosticResult` rejects self-validation) + DB guard (`validateDiagnosticResultTx` WHERE `NOT { resultEnteredById: validatedById }`) + the 2I `applyVisibility` gate (now per-hospital, 3B) already satisfy §11.14.

## 4. Test evidence
[`docs/qa-command-output/3F-3/`](../qa-command-output/3F-3/). `tsc`/`eslint`/`check:arch`/`check:privacy` clean; targeted **4 passed**; `test:integration` **263 passed**. Vitest total **581** (318 + 263). e2e unchanged at **43** (no app/UI code changed).

## 5. Schema summary
**None.** `DiagnosticOrder` already stores `resultEnteredById` + `validatedById` (2I).

## 6. RBAC / audit summary
No new capability. `diagnostic.result.enter` (technician), `diagnostic.validate` (validator); a user holding both still cannot validate their own entry (4-eyes). Visibility gate (`isDiagnosticStaff`) resolves per-hospital roles (3B). Audit `diagnostic.result_entered` / `diagnostic.validated`.

## 7. Known issues
None for this unit. (A finer biologiste/radiologue split by modality remains a documented future refinement, not a §11 requirement.)

## 8. Boundary confirmation (doc 34 §2.1 + §11.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · text-only · **no HL7**, **no analyzer**, **no PACS/DICOM**, **no image storage** · no `01_`/`02_` changes.

## 9. Files changed
- `tests/integration/phase3f3-lab-validator-separation.test.ts` — the 3F-3 verification suite.
- `docs/qa-command-output/3F-3/` — evidence.
- (No application-logic files changed; behaviour originates in H1 `17a9fa1`.)
