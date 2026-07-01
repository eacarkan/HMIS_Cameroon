# Phase 6F — Stakeholder Feedback and Review Flow

**Batch:** 6F · **Spec:** Doc 43 §10 (+ Doc 42 §10) · **Commit message:** `Phase 6F: add stakeholder feedback and review flow`
**Boundary:** **email-based only — no DB form / `FeedbackEntry` model** · no invitation/reviewer-database module · no sensitive/patient data collected · synthetic · no public writes.

## What was implemented
- **Public `/retours` page** (no login): **email-based** feedback instructions — a published feedback email (operator-configured via `NEXT_PUBLIC_FEEDBACK_EMAIL`, placeholder until set) rendered as a `mailto:` link, issue categories, optional detail to include, a **prominent "do not submit patient or sensitive data" notice**, and how feedback is handled. **No in-app form, no inputs, no DB writes.**
- A footer link to `/retours` on every public page.
- **`docs/web-deployment/Stakeholder_Feedback_Process.md`** — the documented review workflow (channel, what to send, no-sensitive-data rule, review owner, deferred future form).

## Files changed
- **New** `app/(public)/retours/page.tsx` + `components/public/public-feedback.tsx` (client; email-only, no form).
- **Edit** `components/public/public-footer.tsx` — footer link to `/retours`.
- **Edit** `messages/fr.json` + `messages/en.json` — bilingual `feedback` namespace. **Edit** `tests/unit/i18n-parity.test.ts`.
- **Edit** `.env.example` — `NEXT_PUBLIC_FEEDBACK_EMAIL=""` placeholder.
- **New doc** `docs/web-deployment/Stakeholder_Feedback_Process.md`.
- **New tests** `tests/component/public-feedback.test.tsx` (3), `tests/unit/no-feedback-model.test.ts` (1); **Edit** `tests/e2e/public-site.spec.ts` (+/retours).

## Schema / migration
**None.** Email-based, no model. The `no-feedback-model` test guards the boundary (no `FeedbackEntry`/feedback model may be introduced without explicit approval).

## RBAC / audit
N/A for the email-based flow (no in-app submit, no DB writes, no new capabilities or audit events).

## Tests run + results (`docs/qa-command-output/web-deployment/6F/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green · `check:i18n` **27** (+1 `feedback`) · `test` **458** (+5: feedback component + no-feedback-model + i18n) · `build` green (`/retours` registered).
- Tests assert: the no-patient-data warning is shown; there is **no `<form>`, no input, no textarea, no submit button**; the schema defines **no `FeedbackEntry`/feedback model**.

## Screenshots / evidence
QA transcripts in `docs/qa-command-output/web-deployment/6F/`. The `/retours` screenshot is captured in the 6G FINAL pass.

## Known issues
- The final feedback email address is an operator decision (`NEXT_PUBLIC_FEEDBACK_EMAIL`); a placeholder is shown until set.

## Boundary confirmation
Email-based only — no DB form / `FeedbackEntry` model (unless explicitly approved later) · no invitation/reviewer-database/mailing-list module · no sensitive/patient data collected · synthetic · no public writes · no schema change · no `01_`/`02_` changes · not merged/pushed.
