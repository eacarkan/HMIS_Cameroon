# Phase 1A — QA Patch (mentor-review fixes)

**For:** mentor review · **Data:** fake/demo only · **Branch:** `feature/gate4-ui-workflows`
**Scope:** the three required fixes from the mentor verdict, plus supporting tests and one documented pre-pilot limitation. No Phase 2 work; no new features; no Prisma schema change or migration.

## Required fixes (blockers)

### Fix 1 — `check:privacy` works without `.git` (extracted mentor bundle)
**File:** `scripts/check-privacy.ts`.
The privacy check verified that `.env` is excluded by running `git check-ignore .env`. In an extracted bundle (which intentionally omits `.git`) that command fails with *“not a git repository”*, so the bundle’s own privacy check could spuriously fail — contradicting the README’s “self-contained / runnable without the repo” claim.
**Change:** the check now detects whether it is inside a working tree (`existsSync(".git")`). If so it uses `git check-ignore` (authoritative). Otherwise it **parses `.gitignore` directly** with a minimal last-match-wins matcher and asserts both that `.env` **is** excluded and that `.env.example` is **not**. Verified: with `.git` hidden, `git check-ignore .env` fails but `npm run check:privacy` now passes (exit 0).

### Fix 2 — duplicate-warning override is bound to the exact warned data
**Files:** `lib/patient-matching.ts`, `server/actions/patient-actions.ts`, `components/patients/patient-form.tsx`.
Previously the override treated *any* second submit as confirmed (`alreadyWarned = _prev.duplicates?.length > 0`). A user could see a warning, **edit the identifying fields**, resubmit, and the server would still treat it as confirmed — weakening the “warn before save” rule.
**Change:** new pure helpers `registrationFingerprint(...)` (normalized family/given name + DOB + phone + sex) and `isDuplicateOverrideConfirmed(...)`. The action returns the `warnedFingerprint` with the warning; on the next submit it recomputes the fingerprint from the **current** data and honours the override **only** when (a) the user explicitly chose “Créer quand même” *and* (b) the fingerprint matches. Editing any identifying field changes the fingerprint → detection re-runs → a **fresh** warning is shown. The form remounts on the fingerprint so the re-warned values display correctly.

### Fix 4 — role assignment requires existing hospital membership
**File:** `server/services/user-admin-service.ts` (`assignRoleForActor`).
The service checked capability + assignable-role + role-exists, then assigned the role in the active hospital **without** confirming the target user already belonged to that hospital — so a known/guessed global `userId` could be pulled into the hospital’s scope via assignment.
**Change (Option A, strict):** before assigning, require `findUserRoleInHospital(userId, ctx.hospitalId)`; otherwise throw *“Utilisateur introuvable dans cet hôpital.”* (consistent with `setUserActive` / `resetUserPassword` / `removeRoleForActor`). Initial onboarding still happens via `createUserForActor`, which assigns the first role atomically.

## Tests added
- **Unit** (`tests/unit/patient-matching.test.ts`, +6): `registrationFingerprint` is stable across case/diacritics/phone formatting and changes when any identifying field changes; `isDuplicateOverrideConfirmed` confirms only on intent + matching fingerprint, and specifically **rejects the edited-after-warning case** and the first-submit case.
- **Integration** (`tests/integration/gate5b-reports-users.test.ts`, +1): assigning a role to a user who belongs only to another hospital is refused, and no HRB assignment is created (the other-hospital assignment is untouched).

## Verification (cumulative, after patch)
`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run build` ✓
unit + component **110** (was 104) · integration **86** (was 85) · e2e **17**
`npm run smoke:test` ✓ GOLDEN PATH · `npm run check:arch` ✓ · `npm run check:privacy` ✓ (incl. the no-`.git` path)

## Documented limitation (pre-pilot, not a fake-data blocker)
**Administrator RBAC breadth (mentor Fix 3).** `administrateur` still holds the Phase 0 baseline capabilities (patient/encounter/consultation/invoice/payment/receipt) in addition to user/config management. This is acceptable for a fake-data demo but conflicts with least-privilege for any pilot/real-data use. It is **deliberately not changed now** (role re-partitioning is a behavioural change better done with the hospital audit). Proposed split before pilot/Gate 7: `administrateur_hopital` (config/users only), an explicit `system_admin`/`super_admin_demo` for broad demo/system access, `directeur` read-only, `agent_accueil` patient/encounter, `medecin` clinical, `caissier` billing/payment. Tracked here so it is not lost.

## Boundaries respected
Fake/demo data only; no real-data/production authorization (Gate 7 untouched); no Phase 2 modules; no Prisma schema change or migration; architecture + privacy guardrails intact (privacy guardrail strengthened); `01_Administratif_et_Contrat/**` and `02_Package_Contractuel_Final/**` untouched.
