# SantéGrid — Deployment Runbook (Vercel Pro + Neon + SanteGrid.com)

**Phase 6D.** Web-deployment **preparation** — this runbook describes how the operator would deploy the SantéGrid **synthetic stakeholder-demo** environment. It is **not** an instruction to deploy now.

> **Boundaries:** synthetic data only · not production · not Gate 7 · not real patient data · no live integrations · **not an official government website**. No domain is purchased, no Vercel/Neon resources are created, and no secrets are committed by this preparation.

## 0. Prerequisites
- A GitHub repository containing this branch (`feature/phase6-santegrid-web-deployment`).
- A **Vercel Pro** account and a **Neon** account (operator-owned).
- The domain **SanteGrid.com** available to register (if unavailable, **do not auto-pick another** — record fallbacks and ask the owner).
- Node 20+, `npm`, and the Prisma CLI available in the deploy build.

## 1. Neon PostgreSQL (managed database)
1. Create a Neon project (region close to the reviewers).
2. Create a database, e.g. `santegrid_demo`.
3. Copy the **pooled** connection string → this becomes `DATABASE_URL`. If migrations need a direct connection, copy the **direct** string → `DIRECT_DATABASE_URL`.
4. Enable Neon's automated backups (default). Restore/backup detail is in `Demo_Reset_and_Backup_Runbook.md` (6E).
5. **Never commit these strings.** They are set only in Vercel env settings.

## 2. Vercel Pro (hosting / CI-CD)
1. Import the GitHub repo into a new Vercel project.
2. Framework preset: **Next.js**. Build command: `npm run build`. Install: `npm install`.
3. Set the environment variables (§4) in **Project → Settings → Environment Variables** (Production + Preview as needed). **Secrets live only here.**
4. Add a **Post-build / one-off** step (or run locally against Neon) to apply the schema and seed synthetic data (§5).
5. Deploy. Vercel provides HTTPS automatically.

## 3. Domain (SanteGrid.com)
1. Register **SanteGrid.com** (operator).
2. In Vercel → Project → Domains, add `SanteGrid.com` (+ `www`) and follow the DNS instructions.
3. Confirm HTTPS is active (Vercel-managed certificate).
4. The public front door is `/accueil`; with `HMIS_PUBLIC_SITE_ENABLED=true`, an unauthenticated visitor to `/` is sent there.

## 4. Environment variables (placeholders only — set real values in Vercel/Neon)

| Variable | Stakeholder-demo value | Notes |
|---|---|---|
| `DATABASE_URL` | *(Neon pooled string)* | secret — Vercel only |
| `DIRECT_DATABASE_URL` | *(Neon direct string, if needed)* | secret — Vercel only, migrations |
| `AUTH_SECRET` | *(generate: `npx auth secret`)* | secret — Vercel only |
| `AUTH_URL` / `NEXTAUTH_URL` | `https://SanteGrid.com` | public URL |
| `AUTH_TRUST_HOST` | `true` | |
| `HMIS_ENVIRONMENT` | `stakeholder-demo` | unlocks the demo surface (fails closed otherwise) |
| `HMIS_PUBLIC_SITE_ENABLED` | `true` | enables the public site + front door |
| `HMIS_PUBLIC_DEMO_LOGIN_ENABLED` | `true` **(demo only)** | **`.env.example` keeps this `false`** — set `true` here ONLY for the controlled stakeholder demo |
| `HMIS_SYNTHETIC_DATA_ONLY` | `true` | marker |
| `HMIS_SHOW_SYNTHETIC_BANNER` | `true` | marker |
| `HMIS_INTEGRATION_LIVE_ENABLED` | `false` | live integrations OFF |
| `HMIS_MPI_LIVE_ENABLED` | `false` | live MPI OFF |
| `HMIS_DEMO_SHARED_PASSWORD` | *(synthetic value)* | **server-side only** — seeds the demo users + one-click sign-in; **never committed**; fails closed if unset |
| `NEXT_PUBLIC_DEMO_PASSWORD_HINT` | *(synthetic hint, optional)* | client-safe **display** hint on the demo-access page; never a real password |
| `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` | `false` | keep the login-screen hint off for stakeholders |

> The app **fails closed**: with the flags unset it behaves as a private local instance. One-click demo login requires **both** `HMIS_ENVIRONMENT=stakeholder-demo` **and** `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true`.

## 5. Schema + synthetic seed (run in the deploy environment)
```bash
# Apply the schema to Neon (no destructive migration is required for Phase 6):
DATABASE_URL="<neon>" npx prisma db push
# Seed synthetic demo data. HMIS_DEMO_SHARED_PASSWORD MUST be set (fails closed otherwise):
DATABASE_URL="<neon>" HMIS_DEMO_SHARED_PASSWORD="<synthetic-demo-password>" npm run db:seed
```
- Seeding is **idempotent** and restores the demo accounts (password + active status + cleared lockout) on reseed.
- The shared synthetic demo password comes from **`HMIS_DEMO_SHARED_PASSWORD`** (Vercel env / seed env) — **never committed**; the seed fails closed if it is unset. Optionally set `NEXT_PUBLIC_DEMO_PASSWORD_HINT` to display the same value to reviewers.

## 6. Smoke + verification
- **Health route:** `GET https://SanteGrid.com/api/health` → `{"status":"ok","service":"santegrid","environment":"stakeholder-demo","syntheticDataOnly":true,"liveIntegrations":false,...}` (no secrets).
- **Public site:** `/accueil` (landing), `/vitrine` (showcase), `/acces-demo` (directory + one-click when enabled) render with the synthetic banner + disclaimers.
- **Sign-in:** a demo account (or one-click, if enabled) reaches the dashboard.
- **Golden path:** optionally run `npm run smoke` against a **test** database (never the demo DB) to confirm numbering, reconciliation, RBAC and audit.
- **Demo-account verification:** see `Demo_Accounts_and_Access.md` + `Demo_Reset_and_Backup_Runbook.md`.

## 7. Reset / backup / rollback
- **Manual demo reset + Neon backup/restore:** `Demo_Reset_and_Backup_Runbook.md` (6E). **Manual only — no automatic destructive scheduled reset.**
- **Rollback:** Vercel keeps prior deployments — use **Instant Rollback** to the last good deployment. Database rollback uses Neon's point-in-time restore (6E).

## 8. Stakeholder handoff
- The operator shares the URL (`https://SanteGrid.com`) **personally** with the intended reviewers. **No invitation workflow, reviewer database, or mailing list** is used.
- Feedback is **email-based** — see `Stakeholder_Feedback_Process.md` (6F).
- Before sharing, complete `Go_No_Go_Checklist.md` (6G).

## 9. Boundaries (restated)
Synthetic data only · not production · not Gate 7 · not real patient data · no live integrations (flags off) · no secrets in the repo · SantéGrid brand (no MINSANTE in domain/brand) · not an official government website. Any move to real data / production / live integrations is a separate, explicit, administrative (Gate 7) decision outside this runbook.
