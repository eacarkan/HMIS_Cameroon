# Phase 5G — App-Level Security Hardening and Access Review

**Batch:** 5G · **Branch:** `feature/phase5g-security-review` (from the 5A tip) · **Commit message:** `Phase 5G: harden app-level security and access review`

> **Synthetic data only · NOT Gate 7 · app-level review only (not an external cybersecurity audit) · no new features · no schema.** Doc 41 §6 (5G), §5.

## 1. Objective
App-level access review: review capabilities, confirm the **central aggregate-only** rule, confirm **no real secrets / no live external calls**, review **audit coverage**, and **test unauthorized role access** — locked in as regression guards.

## 2. What changed (verification + guards — no behaviour/schema change)
- **Capability↔role matrix documented.** New `docs/security/CAPABILITY_ROLE_MATRIX.md`, **generated from `lib/rbac`** (10 roles, 90 capabilities) via `npm run docs:capability-matrix` (`scripts/capability-matrix.ts`) — so the matrix cannot drift from the source of truth. It lists the security invariants, the privileged-capability holders, and each role's capabilities.
- **Access-review invariants locked in** (`tests/unit/rbac-matrix-5g.test.ts`): `central.aggregate.view` is the **only** cross-hospital capability and is held **only** by `superviseur_central`; **no** clinical/reception role ({medecin, agent_accueil, technicien_diagnostic, validateur_diagnostic, pharmacien, pharmacien_chef}) holds any privileged manage/admin capability; every privileged capability is held only by `administrateur`/`caissier` (finance); the integration + MPI **live flags fail closed** (only the exact string `"true"` enables them — verified off by default).
- **Consolidated unauthorized-access sweep** (`tests/integration/phase5g-access-review.test.ts`): a clinical doctor is denied every non-clinical surface (insurance 4E, analytics 4F, patient-match 4G, central 3D); the **central supervisor sees only aggregate oversight** and is denied patient-level (4G) + finance (4E) surfaces; the hospital admin has **no** cross-hospital reach (central denied). Server-side RBAC is authoritative.
- **No real secrets / no live calls confirmed.** `check:privacy` (no committed secrets; real-data path disabled) + the flags-off unit assertions + the existing per-batch network-egress guards (4A/4B/4D/4G) all pass. Adapters remain mock-only; credential references only.
- **Audit coverage confirmed.** Every sensitive/central/config/finance/patient-match action records an audit entry (per-phase tests); central access is audited; audit payloads stay minimal.

## 3. Boundary confirmation
App-level only · central aggregate-only · no real secrets · no live calls (flags off) · RBAC server-side authoritative (per-hospital; central cross-hospital = aggregate-view only) · no new features · no schema · synthetic · all golden paths green.

## 4. Tests + results (doc 41 §8)
Full §8 block + i18n, all green: `typecheck` clean · `lint` **0/0** · `test` **405** (unit+component; +4 `rbac-matrix-5g`) · `test:integration` **336** (+3 `phase5g-access-review`; vitest **741**) · `build` ✓ · `smoke` ✓ · `check:arch` ✓ · `check:privacy` ✓ · `check:i18n` **22** ✓ · `test:e2e` **65**. Evidence [`docs/qa-command-output/phase5/5G/`](../qa-command-output/phase5/5G/).

## 5. Known issues
None new. (The `pg` deprecation warning remains tracked for 5D.)

## 6. Files changed
- `scripts/capability-matrix.ts` (+`docs:capability-matrix` script in `package.json`); `docs/security/CAPABILITY_ROLE_MATRIX.md` (generated).
- `tests/unit/rbac-matrix-5g.test.ts`; `tests/integration/phase5g-access-review.test.ts`; `docs/phase5-implementation-logs/5G_security-access-review.md`; `docs/qa-command-output/phase5/5G/`.
