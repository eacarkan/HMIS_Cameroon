# Phase 6.3 · S2 → S3 Handoff — Mentor decisions & mandatory remediation

**Date:** 2026‑07‑03 · **Branch:** `feature/phase6-3a-foundation-and-public` · **S2 tip:** `377c8c32`
**Status:** S2 is **CLOSED** (conditionally accepted). **Nothing is merged, pushed, or live** — the deploy
branch `deploy/santegrid-webdemo` remains untouched at `7bb16bd6`. **S3 (Opus) must run next** on this
branch and MUST perform the wording remediation below **before** the QA gate, ff‑merge, push, and live
verification. S3 is **not** QA‑only.

---

## 1. Mentor review outcomes (recorded)

1. **S1A (seed safety correction): ACCEPTED.**
2. **S1B (Neon demo seed execution): ACCEPTED.**
3. **S2 hybrid visual direction: ACCEPTED** — B « Réseau » hero for the `/accueil` top section;
   A « Registre » disciplined public‑administration cards for the hospital grid, capability cards,
   patient journey, guided‑demo cards and lower‑page structure. Keep sober, credible,
   Ministry/public‑sector appropriate; avoid excessive SaaS‑marketing feel; no fake production claims.
4. **S2 implementation: CONDITIONALLY ACCEPTED** — conditions are the remediation items in §2.
5. **S3: GREEN‑LIT** strictly as: wording remediation → full QA gate → evidence capture → ff‑merge →
   push → live verification.
6. **No further S2 visual work is requested** unless S3 finds a build/test issue.

## 2. MANDATORY S3 remediation (patch BEFORE merge/push)

### A. `/connexion` — official‑Ministry wording risk
`app/connexion/page.tsx` currently renders `OFFICIAL_HEADER.country · OFFICIAL_HEADER.ministry`
(“RÉPUBLIQUE DU CAMEROUN · MINISTÈRE DE LA SANTÉ PUBLIQUE”) in the brand panel **and** in the mobile
compact header. This can imply official government authorization. **Replace with** (bilingual keys):
- FR: `SantéGrid — SIGH/DME` + `Environnement de revue pour hôpitaux régionaux`
- EN: `SantéGrid — HMIS/EMR` + `Review environment for regional hospitals`
Do not use official‑government header wording anywhere on the login page. (Note: `app.name` already
supplies the first line; add a bilingual key for the second line, e.g. `app.reviewScope`.)

### B. `/vitrine` — deployment wording risk
`showcase.proof.title` currently reads FR « Une plateforme réelle, déployée et vérifiée » — too close
to an official production‑deployment claim. **Replace with:**
- FR: `Environnement de revue en ligne et vérifié`
- EN: `Verified online review environment`
Body copy may still say the app is deployed online for stakeholder review and that automated tests are
used — but avoid « plateforme réelle » and anything sounding like official operational deployment.
⚠ Update the assertions that pin the old string: `tests/component/public-showcase.test.tsx` (line ~25)
and any e2e text checks.

### C. Footer `RELEASE_LABEL` — “non production” must go (mentor‑approved governance change)
Replace the visible RC line with:
- FR: `Environnement de revue — données synthétiques · hors Gate 7 · aucune intégration directe`
- EN: `Review environment — synthetic data · outside Gate 7 · no live integrations`
This REQUIRES coordinated guardrail updates (this is a wording governance update, NOT a weakening):
- `lib/constants/index.ts` → `RELEASE_LABEL` (fr) — and decide how the EN variant renders
  (the footer is i18n‑capable; consider moving the visible line to bilingual keys while keeping the
  constant for archival/guardrail use, or update the constant + add an EN key).
- `scripts/check-release.ts` lines ~16‑20 — currently REQUIRES the literal `non production`; retarget
  to require `environnement de revue` + `synthétiques` + `hors Gate 7`, and keep the
  “must not claim production” negative check.
- `tests/unit/release-5f.test.ts` lines ~15‑19 — same retargeting.
- Sweep for any other assertion pinning `non production` (e2e/component/docs).

### D. `/acces-demo` — visible password placeholder
The page can display the literal `<optional-public-demo-password-or-hint>` (the deployed
`NEXT_PUBLIC_DEMO_PASSWORD_HINT` env value is the placeholder itself; `app/(public)/acces-demo/page.tsx`
falls back to `demoAccess.passwordPlaceholder` only when the env var is EMPTY, not when it holds the
placeholder). **Required behavior:** if the env var is missing, empty, OR looks like the placeholder
(e.g. starts with `<`), hide the line or show the controlled fallback:
- FR: `Mot de passe communiqué séparément aux participants autorisés.`
- EN: `Password shared separately with authorized reviewers.`
Implement as a code‑side guard (do NOT change env vars); add the fallback as bilingual keys; check
`components/public/demo-account-directory.tsx` for the same hint rendering; update
`tests/component/demo-access.test.tsx` (PLACEHOLDER assertion at line ~32) accordingly.

## 3. S2 state the S3 model inherits

- Commits on this branch: `76027ba9` (S1 seed) → `41c4aed8` (S1A safety) → `b95bfd33` (S1B record) →
  `377c8c32` (S2 UI) → this handoff commit.
- S2 light gate was green at `377c8c32`: typecheck ✓ · lint 0/0 · build exit 0 · component 117 ✓ ·
  check:privacy ✓ · check:i18n 33 ✓. FR/EN post‑hero stability verified (desktop 845 px = 845 px;
  mobile 1063 px = 1063 px).
- e2e `tests/e2e/public-site.spec.ts` was updated for the new hero title/CTAs/acces‑demo header but has
  NOT been executed (needs the test‑DB production‑build harness) — S3 runs it in the full gate.
- New reusable components live in `components/public/` + `components/ui/sparkline.tsx`; new bilingual
  namespaces/keys: `landing.{hero.title,stats,network,journey,modules}`, `publicSite.guided`,
  `demoAccess.{groupsTitle,groups.*}`.
- Neon demo data is seeded (S1B); the e2e test DB stays on the base seed.

## 4. Boundaries (unchanged, re‑confirmed)
No real data · no live integrations · no schema change · no committed env changes · Vercel/Neon/domain
settings untouched · `01_`/`02_` untouched · auth/RBAC/audit/privacy untouched · S4/S5 scope untouched.

> **S3 must perform wording remediation before QA, merge, push, and live verification.**
