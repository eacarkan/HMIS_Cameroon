# Expert Review — Final Report
## MinSANTE HMIS / SIGH-DME prototype · Phase 1A → Phase 5 (all phases)

**Prepared by:** independent senior healthcare-IT reviewer (architecture · security/privacy · clinical workflow · financial controls · public-sector HMIS deployment).
**Date:** 2026-07-01 · **Baseline inspected:** Phase 5 tip **`cee1557`** (from the Phase 4A–4F accepted tip `2e37994`), branch `feature/phase5h-pilot-readiness`, working tree clean.
**Method:** read-only inspection of code, migrations, tests, QA logs, implementation logs and package docs, **plus independent re-execution of the full QA suite**. No application code, tests, or migrations were modified.

> **Boundary (read first).** This is an **internal engineering assessment**. It is **not** a Ministry authorization, **not** Gate 7, and does **not** approve real patient data, production deployment, hospital operational use, live integrations, or source-code transfer. The project remains **synthetic data only · mock/sandbox-first · not production**.

---

## 1. Executive verdict

The MinSANTE HMIS/SIGH-DME prototype is a **credible, honestly-evidenced synthetic release candidate** — assessed **4 / 5 for its current non-production scope**. Across 1A→5 it delivers ~20 end-to-end clinical/financial/pharmacy/lab/reporting workflows on a clean layered architecture with server-side, per-hospital RBAC, aggregate-only central oversight, disciplined mock/sandbox integration boundaries, and QA evidence that **survives independent re-execution**.

- **No Critical findings.** Two **High** findings (payment atomicity; login lockout enforcement) gate *real cash / real data / production* — **not** synthetic demo or UAT.
- It is **ready** for internal closure, controlled synthetic demonstration, a DOSTS technical-readiness presentation, and controlled synthetic UAT.
- It is **not ready** — and correctly so — for real patient data, Gate 7, production, or any live integration. Those depend on a small software patch **plus** the entire administrative + infrastructure + cybersecurity programme, which is outside software scope.

**Recommended next step:** apply one small bounded stabilisation patch (F-01 mandatory; F-02 fix-or-formally-defer), tag the synthetic RC baseline, and hold for the DOSTS presentation. **Do not open another feature/coding phase.**

---

## 2. Independent QA verification (re-run at `cee1557`)

Every gate was re-executed by the reviewer; the reported numbers reproduced **exactly**:

| Gate | Claimed | Verified | Gate | Claimed | Verified |
|---|---|---|---|---|---|
| typecheck | clean | ✅ | check:privacy | green (10 fake `@hrb-demo.cm`) | ✅ |
| lint | 0 err / 0 warn | ✅ **0/0** | check:i18n | 22 | ✅ **22** |
| test (unit+component) | 419 | ✅ **419** | check:release | green | ✅ |
| test:integration | 339 (55 files) | ✅ **339** | test:e2e | 65 · 0 MISSING_MESSAGE | ✅ **65 · 0** |
| build | green | ✅ | residual `pg` warning | 1 (documented) | ✅ exactly **1** |
| smoke | GOLDEN PATH | ✅ | check:arch | green | ✅ |

**Conclusion: the QA package is materially honest** — the claims are not README-only; they stand up to re-running the whole suite.

### Code cross-checks (not documentation)
- **Server-side RBAC is real and broad:** 250 `requireCapability` calls across `server/services/*`.
- **Central oversight is aggregate-only:** `getCentralOversight` reads **only** hospital snapshots (no patient/encounter/invoice query in the central read path).
- **4G never mutates patient records:** no `prisma.patient.{update,create,delete,upsert}` in the 4G layer — only a `findMany` read.
- **Mock connectors make no network call:** no `fetch`/HTTP in the integration or MPI adapters; egress-guard tests confirm 0 calls.
- **Migrations are additive:** 32 folders; no `DROP TABLE/COLUMN` or `ALTER … DROP`.

---

## 3. Dimension scores (1–5; not inflated)

| Dimension | Score | Dimension | Score |
|---|:--:|---|:--:|
| Architecture | **4** | Lab / radiology | **4** |
| Workflow coverage | **4** | Integration framework | **4** |
| RBAC / hospital scoping | **4** | Patient matching / MPI readiness | **4** |
| Privacy / patient safety | **4** | Release-candidate quality | **4** |
| Financial controls | **3** | QA evidence | **4** |
| Clinical workflow controls | **4** | Documentation quality | **4** |
| Pharmacy / stock | **4** | Operational readiness | **2** |
| — | — | Commercial / technical defensibility | **4** |
| | | **Overall (non-production scope)** | **4** |

**Why not higher:** Financial controls scored **3** because the core `recordPayment` path is non-transactional (F-01) — the single flow that missed the otherwise-excellent H2/3F-1 transactional hardening. Operational readiness scored **2** not as a software defect but because hardware/network/hosting/backup/cyber/training/Gate-7 are genuinely pending and outside software (the software's *signalling* of this is strong: `authorized:false`, readiness panel). QA scored **4** not **5** because coverage is unmeasured (F-04).

Full per-dimension justification: `00_All_Phases_Expert_Evaluation.md`.

---

## 4. Findings (no Critical)

| ID | Sev | Finding | Blocks |
|---|---|---|---|
| **F-01** | **High** | `recordPayment` is not transactional (separate `createPayment`→`updateInvoiceStatus`) with a stale-read balance check → over-payment under concurrency; the one financial path missing the H2/3F-1 hardening. | Real cash / pilot / prod |
| **F-02** | **High** | Account lockout is policy-only — no persisted counter, not enforced at login (no brute-force protection). | Real data / prod |
| **F-03** | Medium | Page/nav gating uses the cross-hospital role **union** (~91 sites) vs per-hospital service checks (cosmetic; service authoritative). | Extended UAT |
| **F-04** | Medium | No test-coverage instrumentation (large green suite, unmeasured coverage). | Real pilot |
| **F-05** | Medium | No load / concurrency-at-scale testing (5D was query review, not benchmarks). | Real pilot |
| **F-06** | Medium | No external threat model / pen-test (5G is app-level only, by design). | Production / Gate 7 |
| **F-07** | Low | 4G cross-hospital pairing blocked at service layer, not by a DB constraint (tested). | — |
| **F-08** | Low | Error sanitiser is heuristic (rare mis-classification possible). | — |
| **F-09** | Low | Residual `pg` driver-adapter deprecation warning (library-level, documented). | — |
| **F-10–F-14** | Advisory | English i18n progressive; no a11y pass; placeholder emergency-debt pricing; exact-match-only matching; lightweight privacy scanner. | — |

Full register with evidence, risk, recommendation, owner, timing, and per-track blocking flags: `01_Findings_Register.md`.

---

## 5. Readiness decision summary

| Track | Decision |
|---|---|
| Internal technical closure | **Ready** — close & tag the RC baseline |
| Synthetic demo | **Ready** |
| DOSTS technical-readiness presentation | **Ready** (synthetic-readiness framing) |
| Controlled synthetic UAT | **Ready** |
| Extended synthetic UAT | **Conditionally ready** — schedule F-03, F-04 |
| **Real-data pilot / Gate 7** | **Not ready** — close F-01/F-02; complete UAT-sign-off + hardware + cyber (F-06) + backup/restore + training + SOPs + co-signed Director + MINSANTE decision |
| **Production deployment** | **Not ready** — all of the above + production infra + O&M |
| Live DHIS2 / payment / insurer / analyzer-PACS / MPI | **Not ready — by design** (mock/flag-off; no production connector ships) |

Full matrix (software readiness vs non-software dependencies vs required-before-proceeding): `02_Readiness_Decision_Matrix.md`.

---

## 6. Answers to the three key questions

1. **Acceptable as a synthetic release-candidate package?** **Yes.** Credible, honestly-evidenced 4/5 synthetic RC; no Critical finding; QA reproducible.
2. **Acceptable for real-data pilot or production?** **No** — and correctly so. Two High software items must close, plus the full administrative/infrastructure/cybersecurity programme and the co-signed Gate 7 decision. Software is `authorized:false` by design.
3. **Recommended next step?** A small **5.1 stabilisation patch** (F-01 mandatory; F-02 fix-or-document) + tag the RC baseline + hold for DOSTS. **No new coding phase.** Do not enable live integrations, transfer source code, or claim production/Gate-7 readiness.

Ordered action plan (immediate → before-DOSTS → before-UAT → before-pilot → before-prod → deferred): `03_Recommended_Next_Actions.md`.

---

## 7. Commercial / technical defensibility (brief)

The technical package credibly supports the broader framing: a **full implementation project requiring suppliers** (hardware, network, hosting, backup, cybersecurity, training, supervision) with the user positioned as **Software & Digital-Architecture Lead**. The strict synthetic-only, mock/sandbox, `authorized:false` boundaries protect against premature production, source-code-handover, or five-year-O&M claims. Nothing in the software evidence overstates readiness.

---

## 8. Reviewer's bottom line

This is a **well-engineered, disciplined, and honestly-documented synthetic HMIS/EMR prototype** — comfortably strong enough for controlled demonstration, DOSTS technical-readiness presentation, and synthetic UAT. The team's transactional/financial and privacy hardening is a genuine strength; the two High findings are narrow, well-precedented in this very codebase, and cheap to close. The decisive risk is **not** technical maturity — it is **process discipline**: keeping the real-data/production/live-integration line firmly administrative and infrastructure-gated, exactly as the current package does.

---

*Supporting documents (same folder): `00_All_Phases_Expert_Evaluation.md` · `01_Findings_Register.md` · `02_Readiness_Decision_Matrix.md` · `03_Recommended_Next_Actions.md`. Internal review only — not Gate 7, not a Ministry authorization; does not approve real data or production; does not transfer source code; does not modify the implementation.*
