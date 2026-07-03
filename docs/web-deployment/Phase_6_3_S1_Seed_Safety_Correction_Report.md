# Phase 6.3 · S1A — Demo Seed Safety Correction & Operator Note

**Date:** 2026‑07‑03 · **Branch:** `feature/phase6-3a-foundation-and-public` · **Script:** `scripts/seed-demo.ts` (`db:seed:demo`)
**Status:** safety corrections applied + validated on the TEST DB. **Live Neon enrichment still PENDING** (operator‑gated).

This note documents the mentor‑required safety corrections to the synthetic demo seed and the safe procedure for the one‑time Neon run.

---

## 1. Purpose of `db:seed:demo`
Populate the **stakeholder‑demo environment** with **date‑relative synthetic activity** so the executive dashboard, role dashboards, charts, and the central multi‑site view are not empty. It is a presentation aid only — **not** production data, **not** a real caseload.

## 2. What data it generates (HRB‑DEMO)
- Patients, visits (open + closed), consultations, invoices, payments (all four methods), a few diagnostic requests, a few pharmacy stock batches — created **through the service layer** (correct numbering, audit, financial integrity).
- KPI date fields backdated across **~30 days + today** (relative to run time). **Today IS included.**
- One **aggregate‑only** `HospitalAggregateSnapshot` per hospital (period `YYYY‑MM`, canonical ICD‑10 `topDiagnoses` only, **no patient‑level data**) so `/central` shows all 8 sites. **Central snapshots ARE refreshed.**

## 3. All data is synthetic
- Fictional identities; `@hrb-demo.cm` actors.
- **Patient contacts are `DEMO-CONTACT-000001`‑style placeholders — never real‑looking phone numbers** (Fix A). A pure guard (`lib/demo-seed-safety.ts` → `looksLikeRealPhone`) and a unit test (`tests/unit/demo-seed-safety.test.ts`) enforce this.
- No real patient data, no live integrations, no schema change.

## 4. How idempotency works (honest wording)
- **Sentinel‑based, single‑success idempotency.** A `Setting` sentinel (`demo.seed.phase63`, scoped to `hosp-hrb-demo`) is written **last**. After **one completed successful run**, a re‑run is a safe **no‑op**.
- This is **NOT** strict row‑level idempotency. If a run **fails partway** (before the sentinel is written), partial synthetic data may remain and a subsequent plain run would **top it up**, not no‑op.
- **On a failed/partial run: stop. Do not re‑run blindly.** Inspect the sanitized before/after counts and logs; consult the operator/mentor before any retry.

## 5. Why `--force` is test‑only (Fix B)
`--force` bypasses the sentinel and **duplicates** demo data. It is therefore **refused unless `--test` is also present**, and the refusal happens **before any database connection**:
- `npm run db:seed:demo -- --force` → prints *"--force is only allowed with --test. Refusing to duplicate demo data on DATABASE_URL."* and exits non‑zero **without connecting**.
- `npm run db:seed:demo -- --test --force` → allowed **only** against `TEST_DATABASE_URL` (a name that must contain "test"); intentionally re‑adds a batch on the test DB.
- **`--force` must never be used against Neon.**

## 6. Safe Neon execution procedure (operator)
Run **once**, from the repo, with the **Neon DIRECT** connection string (not the pooled URL):
1. Load `DATABASE_URL` **privately** — a gitignored local env file or a hidden terminal prompt. **Do not print it; do not paste it into chat.**
2. Verify only sanitized URL *properties* (never the value): host ends with `.neon.tech`; **not** pooled (`-pooler` absent); username present; password present; db name present.
3. Run: `npm run db:seed:demo` (no flags).
4. Capture the script's **sanitized before/after counts** (it prints row counts only — no secrets).
5. Confirm only the intended synthetic tables changed, that `app/api/health/route.ts` was not modified, and that no schema migration was introduced.
6. (Optional) Run `npm run db:seed:demo` a **second** time only to confirm the no‑op — expect *"already seeded … no‑op"*, and no count increase.
- **Never** run `npm run db:seed:demo -- --force` against Neon.
- Do **not** use the pooled URL for the seed.

## 7. What to do on partial failure
Stop. Do **not** re‑run blindly. Inspect the sanitized row counts (the script prints before/after; you can also re‑query counts). Determine whether the sentinel was written (if it was, a re‑run no‑ops; if not, a re‑run tops up). Consult the operator/mentor before retry.

---

## 8. Boundaries (unchanged)
No real data · no live integrations · no committed env changes · no Vercel/domain change · no `01_`/`02_` change · no schema change · auth/RBAC/audit/privacy intact · `db:seed`, `db:reset`, e2e/global‑setup **not** wired to `db:seed:demo` · S2 not started.
