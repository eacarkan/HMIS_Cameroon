# Phase 6.2 — Stakeholder Presentation Polish — Mentor Report

**Project:** SantéGrid — HMIS / EMR (SIGH / DME) — MINSANTE Cameroon prototype
**Live demo:** https://hmis-cameroon.vercel.app (Vercel project `hmis-cameroon`, Neon PostgreSQL, seeded with synthetic data)
**Date:** 2026‑07‑02
**Deploy branch:** `deploy/santegrid-webdemo`
**Commit delivered:** `8f2460d4` — *"Phase 6.2: polish stakeholder demo presentation"* (fast‑forward on base `3684f153`)
**Status:** Complete, merged into the deploy branch, and pushed. Vercel auto‑deploys from this branch.

> **Note on verification.** Every number, file path, commit hash and "unchanged" claim in this report was independently re‑checked against the live repository by four separate verification passes (git state, a full QA re‑run, a safeguards audit, and a UI‑change audit) before the report was written. Where a value is quoted, it is the value actually observed in the repository, not an expected value.

---

## 1. Objective and boundaries

Phase 6.2 was a **bounded presentation patch** on the existing stakeholder web demo. Its goal was to raise the demo's visual and linguistic polish for stakeholder review **without** touching functionality, data, or the protective safeguards that keep the environment clearly non‑production.

It was explicitly **not** a new functional phase, **not** production hardening, and **not** Gate 7. The work was limited to user interface, internationalisation (French/English) and presentation text.

The following were treated as hard boundaries and respected in full: no real patient data; no live integrations enabled; no change to the Neon database contents; no change to environment variables, Vercel settings, or the domain; no changes to the contractual/administrative folders; no new business modules; no rewrite; and no disabling of TypeScript, ESLint, authentication, role‑based access control (RBAC), or audit controls.

---

## 2. What was changed (by scope)

### 6.2A — English now persists onto the signed‑in application
Previously, choosing English before login was not carried through to the authenticated dashboard and application shell, which still displayed in French. The root cause was **missing English translations** for the authenticated screens — *not* a cookie or session bug (the language cookie and the language‑switch action were already working correctly).

Five interface areas were given a full English translation set: the application header (`app`), the login screen (`auth`), the top bar (`topbar`), the hospital selector (`hospital`) and the dashboard (`dashboard`). These were also added to the automated French/English parity guard, so any future English gap in these areas fails the test suite.

Result: a language chosen before login now carries through to the dashboard and shell. French remains the default. The parity guard passes (32 checks).

### 6.2B — A discreet, professional "review environment" indicator
The previous prominent amber warning band ("Prototype de démonstration fonctionnelle — non destiné à la production") was replaced with a slim, neutral, professional indicator:

- **French:** *"Environnement de revue — données synthétiques"*
- **English:** *"Review environment — synthetic data"*
- **Hover note (French):** *"Cet environnement utilise uniquement des données synthétiques de démonstration. Il n'est connecté à aucun système hospitalier réel."*
- **Hover note (English):** *"This environment uses synthetic demonstration data only. It is not connected to real hospital systems."*

The two other places where the older harsh wording was still visible were also softened: the administrator's temporary‑password hint, and the public landing‑page metadata description.

**Important:** this is a *presentation* change only. The formal marker text is retained where it protects the project — see Section 3.

### 6.2C — Public pages
The public pages (`/accueil`, `/vitrine`, `/acces-demo`) were already sober, well‑structured and correctly branded from earlier Phase 6 work, and their visible wording is covered by automated tests. Their content was therefore kept as‑is; only the landing‑page metadata description was softened to remove the harsh wording. No exaggerated, production, Ministry‑deployment, or real‑data claims are made.

### 6.2D — Signed‑in dashboard first impression
A discreet **active‑hospital context chip** was added to the dashboard header, showing the hospital's **name · region · code**. This gives the dashboard a more executive feel and makes the active context obvious at a glance. It uses only data already seeded in the demo — **no invented metrics and no fabricated operational claims**.

### 6.2E — Login screen
A **pre‑login language toggle** was added so a reviewer can select English (or French) on the login screen itself and keep that choice after signing in. SantéGrid branding and the subtitle already flow from the translation files. Authentication, the account‑lockout policy, the seeded demonstration users and their passwords were **not** changed.

### 6.2F — Health endpoint and safeguards
The `/api/health` status endpoint and all synthetic‑data safeguards were left **completely unchanged** (verified as a byte‑for‑byte identical file — see Section 3).

### 6.2G — Application name
The application name reads **"SantéGrid — SIGH/DME"** in French and **"SantéGrid — HMIS/EMR"** in English, via the translation files.

---

## 3. What deliberately did **not** change (safeguards intact)

This section is the assurance that the polish did not weaken the "clearly not production" posture. All items below were independently verified.

| Safeguard | Status |
|---|---|
| Formal prototype marker retained in the top banner | **Yes** — kept in a screen‑reader‑only element (invisible on screen, present for assistive technology and the guardrail check) |
| Formal prototype marker on printed documents | **Yes** — still printed in full on all **6** print documents (receipt, consultation note, prescription, dispensing record, diagnostic report, cashier day‑book) |
| Prototype‑marker constant in code | **Unchanged** — still contains the full formal wording |
| `/api/health` route and its flags | **Unchanged** — the file is byte‑for‑byte identical to the pre‑phase version (empty diff). It still reports `service: "santegrid"`, `syntheticDataOnly`, `dataMode`, `liveIntegrations: false`, `mpiLive: false` |
| Automated privacy / fake‑data guard | **Passes** — "no secrets found; .env gitignored; prototype label present; 10 demo accounts all synthetic (@hrb-demo.cm)" |
| Remaining **visible** occurrences of the harsh wording | **None** on any screen |
| TypeScript, ESLint, authentication, RBAC, audit | **Unchanged / not disabled** |

---

## 4. Deferred (documented) — English coverage of the deep clinical workflows

English was extended to the shell and dashboard (Section 6.2A). The **deep operational workflow screens remain French‑only** and fall back to French by design. This is expected progressive translation, not a defect — but it is the genuine remaining task before an English‑language site (e.g. Bamenda / Buéa) goes live.

- **Bilingual (French + English) interface areas:** 31 of 66
- **French‑only interface areas (fall back to French):** 35 of 66

The 35 French‑only areas are: `actions`, `sex`, `encounterStatus`, `consultationStatus`, `invoiceStatus`, `paymentMethod`, `patient`, `encounter`, `consultationNote`, `timeline`, `consultation`, `billing`, `receipt`, `auditLog`, `systemStatus`, `errors`, `account`, `comingSoon`, `admin`, `patientIdentity`, `clinical`, `cashierReport`, `cancellation`, `refund`, `brouillard`, `medication`, `prescription`, `prescriptionStatus`, `stock`, `dispense`, `fefo`, `stockAdjustment`, `pharmacyReport`, `operationalReport`, `userAdmin`.

---

## 5. Files changed

10 files changed, **+116 / −20** lines, relative to base `3684f153`:

**Application / interface (6)**
- `app/(app)/page.tsx` — dashboard active‑hospital context chip
- `app/(public)/accueil/page.tsx` — softened landing‑page metadata
- `app/connexion/page.tsx` — pre‑login language toggle
- `components/layout/prototype-banner.tsx` — discreet review‑environment badge (formal marker kept screen‑reader‑only)
- `messages/fr.json` — new badge/note strings; softened admin hint
- `messages/en.json` — English translations for the shell + dashboard (5 areas)

**Tests (4)**
- `tests/unit/i18n-parity.test.ts` — the 5 shell areas added to the French/English parity guard
- `tests/component/prototype-banner.test.tsx` — asserts the new badge and the retained marker
- `tests/e2e/golden-path.spec.ts` — assertions retargeted to the new visible badge
- `tests/e2e/public-site.spec.ts` — assertion retargeted to the new visible badge

---

## 6. Quality checks (all passing — independently re‑run)

| Check | Result |
|---|---|
| Prisma client generation | **pass** |
| TypeScript type‑check (`tsc --noEmit`) | **pass** — no errors |
| ESLint | **pass** — 0 errors / 0 warnings |
| Production build (`next build`) | **pass** — compiled successfully, 49/49 pages generated |
| French/English parity guard (`check:i18n`) | **pass** — 32 tests |
| Privacy / fake‑data guard (`check:privacy`) | **pass** |
| Unit tests | **348 passed** |
| Component tests | **116 passed** |

Total automated tests confirmed passing across unit + component + parity: **496**, 0 failed.

The end‑to‑end (browser) test assertions were updated to the new wording, but the end‑to‑end suite was **not executed in this working environment** because it requires the provisioned test database. This is noted transparently in Section 8.

---

## 7. Git and deployment status (verified)

- **Branch:** `deploy/santegrid-webdemo`
- **Delivered commit (HEAD):** `8f2460d4` — *"Phase 6.2: polish stakeholder demo presentation"*
- **Base:** `3684f153` (the merge was a clean fast‑forward; linear history)
- **Remote:** `origin/deploy/santegrid-webdemo` is at `8f2460d4` — **local and remote are in sync**; working tree clean
- **`main`:** untouched at `87f32f09`
- **Push scope:** only the deploy branch was pushed, as instructed. The domain (santegrid.com) was **not** connected.

Pushing the deploy branch triggers a Vercel build/deploy on the existing project URL.

---

## 8. Honest caveats (full disclosure)

1. **End‑to‑end tests not run locally.** The Playwright assertions were updated to match the new badge wording, but the E2E suite was not executed here (it needs the seeded test database). All other suites (unit, component, parity, build, type‑check, lint, privacy) were run and pass.

2. **One orphaned legacy translation key remains.** An older, **never‑displayed** translation key (`app.prototypeLabel`) still exists in the French and English translation files and still contains the old wording. It is not referenced anywhere in the application code (confirmed: zero references), so it is never shown to any user — the visible banner uses the new neutral strings. It is harmless, but it can be removed on request for tidiness; it was left untouched to keep this phase strictly to the agreed scope and to avoid an additional deploy.

---

## 9. What is intentionally out of scope / next steps

- **Not done (by design):** any functional change, any real‑data path, any live integration, any production or Ministry‑deployment claim, connecting the custom domain.
- **Recommended next task (deferred, documented):** translate the 35 French‑only clinical/pharmacy/billing workflow areas listed in Section 4 before offering an English‑language site to English‑speaking regions.
- **Optional tidy‑up:** remove the orphaned legacy translation key noted in Section 8.

---

*Prepared for mentor review. This environment uses synthetic demonstration data only and is not connected to any real hospital system.*
