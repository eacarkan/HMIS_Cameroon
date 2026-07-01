# SantéGrid — Stakeholder Feedback Process

**Phase 6F.** **Email-based feedback only** for the first deployment. **No in-app form · no `FeedbackEntry` model · no public feedback database writes · no invitation / reviewer-database / mailing-list module.**

> Boundary (Doc 42 §10): a published feedback contact email + instructions; issue categories; a prominent "no patient/sensitive data" notice; a feedback review owner. Deferred (needs explicit operator approval): any DB-backed feedback form.

## 1. Channel
- Feedback is collected **by email only**. The public `/retours` page publishes the feedback email (operator-configured via `NEXT_PUBLIC_FEEDBACK_EMAIL`; a placeholder is shown until set) and the instructions below.
- There is **no online form**, no inputs, and **no database write** — the page is read-only guidance with a `mailto:` link.
- The operator shares the demo URL personally; **no invitation workflow, reviewer database, or mailing list** is used.

## 2. What to send
Reviewers are asked to email, optionally including:
- their name / organization (optional),
- the **page** concerned,
- **steps** to reproduce,
- the **expected** behaviour,
and to pick a **category**: defect/bug · user experience · feature suggestion · content/translation · other.

## 3. No patient or sensitive data
The page shows a prominent notice: **"Do not include any real or sensitive patient data in your feedback."** The demonstration is synthetic; feedback must remain non-sensitive.

## 4. Handling / review owner
- Feedback emails are received and triaged by the **review owner** (the software/architecture lead or a delegate).
- Items are logged **outside the application** (e.g. the team's issue tracker) — not in the demo database.
- No sensitive data is stored; anything mistakenly sent that looks like real data is discarded.

## 5. Future (deferred, requires explicit approval)
A DB-backed feedback form could be added later. If approved, it must: store only **non-sensitive** fields with an explicit "no patient data" notice, add basic spam/abuse protection, add an additive `FeedbackEntry` model (proposed then), and gate any review UI behind a defined reviewer capability. **Not implemented in this phase.**

## 6. Boundaries
Email-based only · no in-app form / `FeedbackEntry` model (unless explicitly approved later) · no invitation/reviewer-database/mailing-list module · no sensitive/patient data collected · synthetic · no public writes.
