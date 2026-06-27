# Phase 0 — Demo operator note (internal)

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**
> **Internal use only.** Fake data only. Not production-ready.

## 1. Purpose
Demonstrate the Phase 0 **walking skeleton** of the SIGH/DME for MINSANTE: one clean,
reproducible patient journey (login → hospital → patient → encounter → consultation →
invoice/payment → official receipt → dashboard → audit log) on a single demo hospital
(**HRB-DEMO**). ~10–15 minutes. It shows the shape, the French-first UI, RBAC and a
reconciling 3 000 FCFA story — not a finished product.

## 2. Warning — read before demoing
- **Fake data only.** No real patient, no real national ID, no real hospital record.
- **Not production-ready.** The prototype label is always on screen and on the receipt — leave it visible.

## 3. Screenshots to use externally (stakeholders)
`docs/stakeholder-demo-screenshots/` — the approved **one-patient** golden path; dashboard
reconciles to **1 / 1 / 3 000 FCFA**; **no demo-account/password block**. Use these in
slides/handouts for stakeholders.

## 4. Screenshots that are technical/internal only
`docs/review-screenshots/` — two-patient set that also shows empty consultation/billing
forms and RBAC evidence; the login demo-account hint is visible. **Internal review only —
do not put these in front of stakeholders.**

## 5. Demo path (live)
login → **dashboard** → **patient search** (Aïssatou BELLO) → **patient record** →
**visit** (open encounter) → **invoice / payment** (2 000 + 1 000 = **3 000 FCFA**, espèces)
→ **receipt** (Imprimer le reçu) → **audit log** (actions reconcile with the dashboard).
For RBAC, optionally switch to the receptionist and show the blocked payment action.

## 6. Demo credentials — internal operator use only (fake accounts)
Password for all: **`demo1234`**

| Persona | Rôle | Identifiant |
|---|---|---|
| Awa NJOYA | Administrateur | `awa.njoya@hrb-demo.cm` |
| Brigitte MBARGA | Agent d'accueil | `brigitte.mbarga@hrb-demo.cm` |
| Dr Jean-Paul ETOA | Médecin | `jeanpaul.etoa@hrb-demo.cm` |
| Solange ABENA | Caissier | `solange.abena@hrb-demo.cm` |
| Dr Emmanuel TCHOUA | Directeur (lecture seule) | `emmanuel.tchoua@hrb-demo.cm` |

The journey uses receptionist → clinician → cashier; the director shows the read-only
dashboard/audit. Keep this table in the operator's notes — **not** on the projected screen.

## 7. Do NOT show the demo-account/password block on screen
The login demo-account + password hint is **hidden by default**
(`NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` is off). **Do not set it to `true`** for any
stakeholder-facing run. Type credentials from this note; never display the hint block.

## 8. Running the app for the demo
Prerequisite: local PostgreSQL running; `.env` configured (see `.env.example`).

- Reset to the known demo state first: `npm run db:reset`
- Cleanest stakeholder run (production mode — no dev indicator, hint hidden by default):
  `npm run build && npm run start` → http://localhost:3000
- Quick internal run: `npm run dev` → http://localhost:3000
- Reproduce the screenshot sets if needed: `npm run screenshots:demo` (stakeholder) /
  `npm run screenshots:review` (technical).

(See also `docs/DEMO.md` and `docs/testing/UAT_PHASE_0_WALKING_SKELETON.md`.)

## 9. Known caveats
- **Mobile navigation is not implemented** — narrow layout stacks, but there is no mobile drawer/menu. Demo on a desktop/laptop.
- **Print dialog / PDF should be checked manually** — the receipt *preview* is shown in-app; the browser print/PDF step is not automated.
- **Fake data only**; **not production-ready**; **no real patient data**.

## 10. What NOT to claim
- Not production.
- Not pilot-ready.
- Not mobile-ready.
- Not cybersecurity-certified.
- Not connected to DHIS2.
- Does not handle insurance / mutuelle yet.

Keep narration honest: this is a Phase 0 prototype demonstrating the end-to-end skeleton.
