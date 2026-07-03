# Phase 6.3 · S3 (Opus 4.8) — Report & Handoff to S4

**Scope:** mentor-required wording remediation (A–D) → full QA gate → ff-merge → push → live verify.
**Model:** Opus 4.8 (QA / correctness step following the Fable S2 public-UI work).

---

## 1. Commits

| | Commit | Subject |
|---|---|---|
| Deploy branch **before** | `7bb16bd6` | Phase 6.2C: complete live dashboard English rendering |
| Deploy branch **after** | `573ee973` | Phase 6.3 S3: wording remediation (A–D) + QA gate + public evidence |

The fast-forward brought the following feature-branch commits onto `deploy/santegrid-webdemo`:

- `76027ba9` P1: synthetic date-relative demo seed (`db:seed:demo`)
- `41c4aed8` S1A: harden demo seed safety
- `b95bfd33` S1B: record Neon demo seed execution
- `377c8c32` S2: design foundation + public pages + login (Fable, hybrid direction)
- `121fa46b` S2: record mentor review handoff
- `573ee973` **S3: wording remediation (A–D) + QA gate + public evidence** (this step)

Merge was a clean **`--ff-only`** (no merge commit). Push updated **only** `deploy/santegrid-webdemo`
(`7bb16bd6..573ee973`); local `HEAD` == `origin/deploy/santegrid-webdemo` == `573ee973`.

---

## 2. Step 0 — mentor-required wording remediation (done before the gate)

All four items are **code-side**; no Vercel / Neon / env / domain settings were touched.

### A — `/connexion`: remove the official Ministry header
- Removed the `OFFICIAL_HEADER` (RÉPUBLIQUE DU CAMEROUN · MINISTÈRE DE LA SANTÉ PUBLIQUE) from
  both the desktop brand panel and the mobile header.
- Brand panel now leads with the review-environment badge + **`app.name`** ("SantéGrid — SIGH/DME" /
  "SantéGrid — HMIS/EMR") and a new subtitle **`app.reviewScope`** ("Environnement de revue pour
  hôpitaux régionaux" / "Review environment for regional hospitals").
- `OFFICIAL_HEADER` import dropped from `app/connexion/page.tsx` (kept `DEMO_ACCOUNTS`).

### B — `/vitrine`: proof title
- `showcase.proof.title`: "Une plateforme réelle, déployée et vérifiée" →
  **"Environnement de revue en ligne et vérifié"** / **"Verified online review environment"**.
- Pinned assertions updated: `tests/component/public-showcase.test.tsx`, `tests/e2e/public-site.spec.ts`.

### C — footer `RELEASE_LABEL`
- `lib/constants/index.ts`: `RELEASE_LABEL` →
  **"Environnement de revue — données synthétiques · hors Gate 7 · aucune intégration directe"** /
  EN via `publicSite.footer.release`. The visible literal **"non production" is gone**.
- Footer renders `t("release")` (was the raw `RELEASE_LABEL` constant); import removed.
- Guardrails retargeted to the governance wording (NOT weakened):
  - `scripts/check-release.ts` now requires `/environnement de revue/i` + `/synth[ée]tiques/i` +
    `/hors Gate 7/i` **and forbids** `/\bproduction\b/i`.
  - `tests/unit/release-5f.test.ts` asserts the same; `PROTOTYPE_LABEL` unchanged.

### D — `/acces-demo` (+ `/connexion`): never render the env placeholder
- New pure helper `lib/public-demo-hint.ts`:
  `isPlaceholderHint()` treats unset / blank / `<…>` / `placeholder|optional-public-demo|tbd`-like
  values as unusable; `resolvePublicDemoPasswordHint(raw, fallback)` substitutes a controlled fallback.
- Fallback keys `demoAccess.passwordHintFallback` ("Mot de passe communiqué séparément aux
  participants autorisés." / "Password shared separately with authorized reviewers.").
- **No env variable changed** — the deployed `NEXT_PUBLIC_DEMO_PASSWORD_HINT` may literally hold the
  placeholder; the resolver detects it at render time and shows the fallback.
- Covered by `tests/unit/public-demo-hint.test.ts`.

---

## 3. Files changed in the S3 commit (`573ee973`)

Code / config (9): `app/(public)/acces-demo/page.tsx`, `app/connexion/page.tsx`,
`components/public/public-footer.tsx`, `lib/constants/index.ts`, `lib/public-demo-hint.ts` (new),
`messages/fr.json`, `messages/en.json`, `scripts/check-release.ts`, `scripts/capture-6_3-public.mjs` (new).

Tests (4): `tests/component/public-showcase.test.tsx`, `tests/e2e/public-site.spec.ts`,
`tests/unit/release-5f.test.ts`, `tests/unit/public-demo-hint.test.ts` (new).

Evidence (7 PNG): `docs/qa-command-output/web-deployment/6_3/01-accueil-fr … 07-mobile-accueil-fr`.

_Total: 20 files, +355 / −27._ The auto-generated `next-env.d.ts` dev/build-path churn was reverted
(not committed). Local `.claude/launch.json` (preview tooling) was intentionally left uncommitted.

---

## 4. i18n

- FR is the base, EN the overlay; parity guard `tests/unit/i18n-parity.test.ts` passes (33 tests).
- New / changed keys, present in **both** locales:
  `app.reviewScope`, `publicSite.footer.release`, `demoAccess.passwordHintFallback`,
  and the changed `showcase.proof.title`. (`app.reviewEnvironmentBadge` / `…Note` from S2 verified present.)

---

## 5. QA gate — all green

| Check | Result |
|---|---|
| `npx prisma generate` | ok |
| `npm run typecheck` (`tsc --noEmit`) | ✓ pass |
| `npm run build` (**hard gate**) | ✓ Compiled successfully (3.7s), all routes rendered |
| `npm run lint` (`eslint`) | ✓ clean |
| `npm run check:i18n` | ✓ 33/33 |
| `npm run check:privacy` | ✓ no secrets; 10 demo accounts all `@hrb-demo.cm` (fake) |
| `npm run check:release` | ✓ v0.5.0-rc.1; label = review-environment wording, no "production" |
| Unit + component (`vitest run tests/unit tests/component`) | ✓ **480/480** (97 files) |

**Grep sweep (public surfaces):** no `RÉPUBLIQUE DU CAMEROUN`, no old "Une plateforme réelle…",
no visible "non production", no `<optional-public-demo-password-or-hint>`. The FR
"Ministère de la Santé Publique" string remains **only** inside the intended *negating* disclaimer
("Ce n'est pas un site officiel du Ministère…"), which the mentor requires.

**Layout stability (6.2B):** FR and EN `/accueil` both anchor the first post-hero heading at **y=827**
(hero-bottom proxy y=589) — identical; desktop + mobile home verified in-browser.

**`/api/health`:** unchanged (git-clean); returns `synthetic-only`, `liveIntegrations:false`,
`releaseCandidate:v0.5.0-rc.1`. Review badge present on all public pages.

---

## 6. Evidence

`docs/qa-command-output/web-deployment/6_3/` — captured against a running server by
`scripts/capture-6_3-public.mjs`, which **validates every page before saving** (forbidden-token
check + expected-wording check), so a broken/regressed page cannot produce a screenshot:
`01-accueil-fr`, `02-accueil-en`, `03-vitrine-fr`, `04-acces-demo-fr`, `05-connexion-fr`,
`06-connexion-en`, `07-mobile-accueil-fr`.

---

## 7. Live verification — www.santegrid.com

**Result: VERIFIED LIVE (2026‑07‑04).** After the push, Vercel built `573ee973` successfully but produced only a **Preview** deployment; it did **not** auto‑promote for ~50 min. The operator then **manually promoted it to Production** in the `hmis-cameroon` Vercel dashboard. GitHub now shows a **`Production`** deployment for `573ee973`; www.santegrid.com serves the new build (`x-vercel-cache: MISS`, `age: 0` — fresh origin, not stale edge). Hard‑refresh checks:

| Surface | Live result |
|---|---|
| A `/connexion` FR | « SantéGrid — SIGH/DME » + « Environnement de revue pour hôpitaux régionaux »; **0** official‑header occurrences |
| A `/connexion` EN | « SantéGrid — HMIS/EMR » + « Review environment for regional hospitals »; **0** official‑header occurrences |
| B `/vitrine` | « Environnement de revue en ligne et vérifié » (old title absent) |
| C footer | « … hors Gate 7 · aucune intégration directe » (« non production » absent) |
| D `/acces-demo` | « Mot de passe communiqué séparément aux participants autorisés. » (placeholder token absent) |
| `/accueil` FR/EN | review badge « Environnement de revue — données synthétiques » present |
| `/api/health` | `syntheticDataOnly:true`, `liveIntegrations:false`, `releaseCandidate:v0.5.0-rc.1` |

Live production evidence PNGs (re‑captured against www.santegrid.com, each validated before saving):
`docs/qa-command-output/web-deployment/6_3/live/`.

**One‑click login:** currently **disabled** on the live instance (« La connexion en un clic est désactivée sur cette instance ») — controlled by the env flag `HMIS_PUBLIC_DEMO_LOGIN_ENABLED`, which S3 did not touch and which is outside this scope. Stakeholders sign in on `/connexion` with the shared demo credentials. A full authenticated session could not be exercised from here (one‑click off; the credentials password is a Vercel‑only secret not available to this session), and auth/lockout/RBAC were **unchanged** by S3 — the authenticated‑English dashboard flow was already verified on a production build in Phase 6.2C.

---

## 8. Remaining observations (out of A–D scope — for S4)

These are **authenticated-shell** surfaces, deliberately left untouched under the S3 constraint
"do not modify the dashboard / S4–S5 areas". They are not on the four stakeholder-facing public pages.

1. **Authenticated sidebar** (`components/layout/sidebar.tsx`) still renders `app.ministry`
   ("Ministère de la Santé Publique") + `app.longName`. Post-login only. **Candidate for S4** if the
   review-environment framing is to extend into the app shell.
2. **`/selection-hopital`** (`app/selection-hopital/page.tsx`) still renders `OFFICIAL_HEADER`
   (country · ministry). Post-login only. **Candidate for S4.**
3. **Print documents** (receipt, prescription, dispense, consultation note, brouillard, diagnostic
   report) intentionally carry the official header **with `PROTOTYPE_LABEL`** — they mimic official
   Cameroon forms with a prototype watermark. Recommend leaving as-is unless the mentor asks otherwise.

No functional defects found. No known failing tests.

---

## 9. Handoff to S4 (Fable)

- Deploy branch `deploy/santegrid-webdemo` @ `573ee973`, live on www.santegrid.com.
- Public-facing wording is now sober / review-environment framed; the four mentor items A–D are closed
  and evidenced.
- If S4 continues the design pass, the two authenticated-shell items above are the natural next targets;
  keep the guardrails green (`check:release` forbids the word "production"; `check:i18n` requires FR/EN
  parity) and re-run the QA gate + `scripts/capture-6_3-public.mjs` before any further merge.
- Constraints still in force: ff-merge only into `deploy/santegrid-webdemo`; push only that branch;
  do not change Vercel / Neon / env / domain settings; item-D behavior must stay code-side.
