# SantéGrid — Demo Accounts and Access

**Phase 6C.** Synthetic-demo only · no real accounts · no real data · not production · not Gate 7.
All demo accounts are **entirely fictional** (`@hrb-demo.cm`). The account lockout (F-02) remains active for credential sign-in.

## 1. Demo account directory (all synthetic)

| Role | Sign-in id (synthetic) | Hospital | One-click |
|---|---|---|---|
| Central supervisor | `direction.regionale@hrb-demo.cm` | HRB-DEMO | ✅ |
| Administrator | `awa.njoya@hrb-demo.cm` | HRB-DEMO | ✅ |
| Doctor | `jeanpaul.etoa@hrb-demo.cm` | HRB-DEMO | ✅ |
| Cashier | `solange.abena@hrb-demo.cm` | HRB-DEMO | ✅ |
| Pharmacist | `georges.mballa@hrb-demo.cm` | HRB-DEMO | ✅ |
| Laboratory technician | `paul.ngono@hrb-demo.cm` | HRB-DEMO | ✅ |
| Radiology technician | `paul.ngono@hrb-demo.cm` *(shares the diagnostic-technician account)* | HRB-DEMO | ✅ |
| Reception agent | `brigitte.mbarga@hrb-demo.cm` | HRB-DEMO | Credential-only |
| Pharmacist-in-charge | `claire.fotso@hrb-demo.cm` | HRB-DEMO | Credential-only |
| Director | `emmanuel.tchoua@hrb-demo.cm` | HRB-DEMO | Credential-only |
| Diagnostic validator | `marie.eyenga@hrb-demo.cm` | HRB-DEMO | Credential-only |

The **seven selected one-click roles** are Central supervisor, Administrator, Doctor, Cashier, Pharmacist, Laboratory technician and Radiology technician (Doc 42 §5). Sensitive roles (Director, Diagnostic validator) and the reception / pharmacist-in-charge accounts stay **credential-only**.

## 2. Password handling (env-controlled — no committed password) — corrected in Phase 6.1

- **No password is committed anywhere.** The synthetic demo password is provided at runtime via the **server-side** env var **`HMIS_DEMO_SHARED_PASSWORD`** (`lib/demo-password.ts` → `getDemoSharedPassword()`), which **fails closed** (throws) if it is required but unset.
- `HMIS_DEMO_SHARED_PASSWORD` is used **server-side only** — to seed the synthetic demo users and for server-side one-click demo login. It has **no `NEXT_PUBLIC_` prefix**, so Next.js never inlines it into the client bundle.
- **Public display** uses a separate, optional, client-safe hint **`NEXT_PUBLIC_DEMO_PASSWORD_HINT`**. When set, the demo-access page shows it; when unset it shows a clearly-marked **placeholder** ("Mot de passe de démonstration fourni par l'opérateur." / "Demo password provided by the operator.").
- **Usernames may be displayed publicly. The password/hint is displayed only through operator-controlled deployment configuration** (`NEXT_PUBLIC_DEMO_PASSWORD_HINT`); the actual server-side demo password (`HMIS_DEMO_SHARED_PASSWORD`) is configured in Vercel environment variables and is **not committed**.
- Tests inject a deterministic **synthetic** value through their setup (never a committed product password). `.env.example` contains **placeholders only**.
- **Never commit a real password.** Any placeholder in this document is a placeholder only.

## 3. One-click demo login (flag-gated, stakeholder-demo only)

One-click login starts a **synthetic** demo session for a selected role **without the reviewer typing a password**. It is refused unless **both** hold:

```
HMIS_ENVIRONMENT=stakeholder-demo
HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true
```

- `.env.example` keeps `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=false`. The runbook may instruct the operator to set it `true` **only** for the controlled stakeholder-demo deployment.
- The gate is enforced **server-side** (`canStartOneClickDemo()`), independent of whether the buttons are rendered — a forged POST outside stakeholder-demo mode does nothing.
- One-click resolves the role against a **server-side allow-list** (the seven selected roles). A sensitive/unknown key is refused.
- The password never crosses the client; the sign-in uses the seeded synthetic credential **server-side** and still goes through `authenticateCredentials`, so the **F-02 account lockout is preserved** (a locked demo account is denied even via one-click).
- Each one-click session writes a `demo.session_requested` audit for the synthetic account.

## 4. Access model
- Public pages (`/accueil`, `/vitrine`, `/acces-demo`) are **read-only**, no login, no operational data, no writes.
- All workflow usage stays **access-controlled** behind the `(app)` group — a reviewer must have a demo session (credentials or, when enabled, one-click).
- RBAC and per-hospital scoping are unchanged; central stays aggregate-only.

> Synthetic-demo only · no real accounts / data · not production · not Gate 7. Passwords are never committed; placeholders are placeholders only.
