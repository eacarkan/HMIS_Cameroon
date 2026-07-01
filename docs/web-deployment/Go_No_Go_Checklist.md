# SantéGrid — Go / No-Go Checklist (stakeholder-demo deployment)

**Phase 6G.** Doc 42 §12. Synthetic-demo only · not production · not Gate 7 · not real data.
**Legend:** ✅ **Software-ready** (prepared + verified in Phase 6) · ⏳ **Operator action** (performed at deploy time, per `SanteGrid_Deployment_Runbook.md`).

| # | Item | Status | Evidence / how |
|---|---|---|---|
| 1 | Domain configured (SanteGrid.com) | ⏳ Operator | Register + add to Vercel (runbook §3). **Do not deploy now.** |
| 2 | HTTPS active | ⏳ Operator | Vercel-managed certificate (runbook §2–3) |
| 3 | Neon connected | ⏳ Operator | `DATABASE_URL` in Vercel (runbook §1, §4) |
| 4 | Migrations applied | ⏳ Operator | `prisma db push` in the deploy env (runbook §5) |
| 5 | Synthetic seed loaded | ⏳ Operator | `npm run db:seed` (runbook §5); reproducibility proven ✅ (`phase6e-seed-reproducibility`) |
| 6 | Demo accounts verified | ✅ + ⏳ | Ten synthetic `@hrb-demo.cm` accounts, authenticate + clean baseline (6E test); operator verifies post-deploy |
| 7 | Public landing page working (SantéGrid brand) | ✅ | `/accueil` (6A) — brand + positioning line + disclaimers; e2e |
| 8 | Feature showcase working | ✅ | `/vitrine` (6B) — modules + proof, no public writes; e2e |
| 9 | App login working | ✅ | existing credentials login (unchanged); e2e golden path |
| 10 | One-click demo login flag verified (default off; on only for stakeholder-demo) | ✅ | `canStartOneClickDemo()` gate; default off; unit + integration + e2e (6C) |
| 11 | Live integration flags off | ✅ | `HMIS_INTEGRATION_LIVE_ENABLED` / `HMIS_MPI_LIVE_ENABLED` default false; health route reports `liveIntegrations:false` (6D) |
| 12 | Synthetic banner visible | ✅ | prototype banner shown on every page (app + public) |
| 13 | QA commands green | ✅ | full block at the 6G tip → `docs/qa-command-output/web-deployment/FINAL/` |
| 14 | No real data | ✅ | synthetic only; `REAL_DATA_ENABLED=false`; check:privacy |
| 15 | No secrets committed | ✅ | `.env` gitignored; `.env.example` placeholders; check:privacy; health-route + env tests |
| 16 | Feedback channel (email) ready | ✅ + ⏳ | `/retours` email-only (6F); operator sets `NEXT_PUBLIC_FEEDBACK_EMAIL` |

## Verdict
- **Software preparation: GO** — all software-ready items (7–16 software portions) are complete and verified on the Phase 6 branch.
- **Deployment: NO-GO by design** — items 1–6 (domain, Neon, seed) are **operator actions performed only under an explicit, separate deployment instruction**. This phase **prepares** the app and **stops before deployment**.

> Not production · not Gate 7 · not real data · no live integrations. Any move to deploy is a separate, explicit decision by the operator.
