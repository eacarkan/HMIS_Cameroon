# Phase 5E — Error Handling, Validation, and Bilingual/i18n Polish

**Batch:** 5E · **Branch:** `feature/phase5e-validation-i18n` (from the 5D tip) · **Commit message:** `Phase 5E: improve validation errors and bilingual polish`

> **Synthetic data only · NOT Gate 7 · no validation-rule weakening · no sensitive data in user errors · no schema.** Doc 41 §6 (5E), §5.

## 1. Objective
Improve user-facing error handling so **no technical detail leaks** to the UI, standardise the safe-message pattern across all server actions, and keep the bilingual catalogs consistent — without weakening any validation rule.

## 2. What changed
- **User-facing error sanitiser** `lib/errors.ts` — `userFacingMessage(error)` (pure): our services throw **clean French validation messages**, which pass through unchanged; anything that looks technical (Prisma internals, SQL, stack frames, file paths, connection errors, secrets/tokens) or is empty / over-long collapses to a safe generic French fallback (*"Une erreur inattendue s'est produite. Veuillez réessayer."*). Server logs still hold the full error; only the surfaced UI text is sanitised.
- **Adopted across ALL 31 server-action files.** Every action's `fail()` helper now returns `userFacingMessage(error)` instead of the raw `error.message`, so a stray Prisma/technical error can never reach a form's error banner. `AuthorizationError` still maps to the existing "Vous n'êtes pas autorisé." No validation logic changed — the services' rules and messages are untouched; only the *rendering* of unexpected errors is made safe.

## 3. THE GUARANTEE (verified)
No user-facing error leaks sensitive/technical detail; clean validation messages are preserved verbatim. Validation rules are unchanged (the existing service/integration message-assertion tests all still pass, because clean French messages pass through the sanitiser untouched).

## 4. Tests + results (doc 41 §8)
- **unit** `tests/unit/errors-5e.test.ts` (4) — clean French validation messages pass through; technical/leaky messages (Prisma invocation, `pg` stack frame, SQL, `ECONNREFUSED`, `P2002`, secret/token) collapse to the generic fallback; empty / over-long / non-Error throwables → fallback; custom fallback honoured.
- **i18n** `check:i18n` **22** bilingual namespaces in parity; e2e shows **0** `MISSING_MESSAGE`.
- **Suite at this tip:** unit+component **414** (+4), integration **339** (vitest **753**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase5/5E/`](../qa-command-output/phase5/5E/). No existing message-assertion test regressed (clean messages preserved).

## 5. Boundary confirmation
No validation-rule weakening · no sensitive/technical data in user-facing errors (sanitised) · bilingual parity preserved · no schema · synthetic · all golden paths green.

## 6. Files changed
- `lib/errors.ts` (new sanitiser); all 31 `server/actions/*.ts` (`fail()` → `userFacingMessage`).
- `tests/unit/errors-5e.test.ts`; `docs/phase5-implementation-logs/5E_validation-error-i18n.md`; `docs/qa-command-output/phase5/5E/`.
