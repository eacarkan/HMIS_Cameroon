# Phase 2J — Bilingual / UAT Hardening / Gate 7 Readiness (cross-cutting)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2j-hardening` (stacked on 2I `40590d4`)
**Boundaries:** cross-cutting + progressive · synthetic-data UAT · **not Gate 7** · no real data · no production deployment · no full offline mode · no cybersecurity-assessment execution.

## 1. Objective
Carry the **bilingual (Fr/En)** foundation, **draft protection**, and **UAT / Gate 7 readiness evidence** across the V1.0 modules — without retranslating the whole app or claiming any authorization. **No schema change / migration.**

## 2. Bilingual i18n coverage
- The new Phase 2 UI uses **translation keys**, not hard-coded text. This unit completes the English overlay for the namespaces that were still French-only: **`emergency`**, **`queue`**, and the whole **`nav`** menu (was French in EN mode); `admission` + `diagnostic` were completed in their own units, plus the new **`draft`** + **`gate7`** namespaces. French stays the base; English is a progressive overlay (un-declared namespaces still fall back to French — intended).
- **Parity guard:** `tests/unit/i18n-parity.test.ts` declares the **fully-bilingual** namespaces (`nav, emergency, queue, admission, diagnostic, draft, gate7, serviceType, language`) and FAILS if any French key in them lacks its English counterpart (or vice-versa). This keeps the new screens bilingual for **Bamenda / Buéa** going forward.

## 3. Draft autosave (long notes only — draft protection, not offline mode)
- Pure `lib/draft-autosave.ts`: a hard **scope guard** (`isDraftAutosaveAllowed`) whose allow-list is ONLY `consultation-note` + `prescription-note`; everything financial/stock/irreversible (payments, invoices, refunds, cashier shifts, stock, dispensing, emergency debt, admissions, diagnostic orders, unknown kinds) returns **false**. Plus the deterministic IndexedDB key + the sync-state vocabulary. Exhaustively unit-tested.
- Client `components/drafts/draft-note-field.tsx`: a drop-in textarea (same `id`/`name`, so it submits exactly like before) with debounced IndexedDB autosave, SSR-safe + fully defensive (any IndexedDB failure no-ops — the form is never broken). A recovered draft is **offered via a button, never auto-filled** (no surprise overwrite, no e2e interference). Clear UI states (saving / local draft saved / failed). Wired into the consultation clinical note. **Never wired to any payment/stock/irreversible form.**

## 4. Local-server / Gate 7 readiness evidence
- Pure `lib/deployment-readiness.ts`: the `GATE7_READINESS` checklist marking software-delivered items `ready`, hooks `placeholder` (backup export hook + local-server config — **no hard-coded CETIC/backup URL**), and the prerequisites the software **cannot self-authorize** as `administrative` (signed UAT, validated hardware, baseline cybersecurity, encryption/key management = infrastructure). `getBackupStatus()` is an **INERT** placeholder (no target). `isSoftwareReadinessComplete()` ignores administrative items by construction — the software can never flip Gate 7 to authorized.
- The **system status page** (`/etat-systeme`) now shows the Gate 7 readiness card (per-item status badges + the administrative/backup notes), bilingual.
- **Evidence doc** `docs/gate7-readiness/GATE_7_READINESS_EVIDENCE.md` (Fr + En): what the software carries, the UAT evidence (zero critical blockers; full green suite), and the explicit non-authorization statement.

## 5. RBAC + audit
No new clinical powers, no new roles, no new capabilities. No new server mutations (draft autosave is client-only/local; readiness is a pure status view). Nothing to audit beyond existing flows.

## 6. Tests + results
- **Unit:** `i18n-parity` (declared-bilingual namespaces have matching Fr/En keys, no orphans); `draft-autosave` (the scope guard NEVER allows financial/stock/irreversible kinds; deterministic key; persist-only-meaningful); `deployment-readiness` (software items ready/placeholder, administrative items never self-authorized, backup inert).
- **Component:** `draft-note-2j` (renders as a plain `name`/`id` field; safe with no IndexedDB; never auto-fills a draft).
- Existing suites unaffected (the consultation note keeps its `id`/`name`; the e2e/golden path are untouched).

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · progressive bilingual (no big-bang retranslation) · draft protection scoped to long notes only (never financial/stock/irreversible) · backup is an inert hook with no hard-coded URL · administrative prerequisites explicitly NOT self-authorized · no schema change.

## 8. Review note
2J is cross-cutting and low-risk: no schema, no new server mutations, no RBAC/financial logic. The single risk surface — that draft autosave could ever touch a financial/irreversible form — is closed both by a typed allow-list union AND an exhaustive unit test, so a heavyweight adversarial workflow (reserved for stock/financial/visibility units) was not run; the full matrix (build + all suites + arch + privacy) is the gate.

## 9. Confirmation
This is Phase 2J — the final Phase 2 extension. It completes the bilingual foundation, adds draft protection for long notes, and assembles Gate 7 readiness evidence without claiming authorization. **Phase 2 (core 2A→2E + all five extensions 2F/2H/2G/2I/2J) is now complete** pending the consolidated review refresh.
