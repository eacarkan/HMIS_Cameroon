# Demo guide — first walking skeleton

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

A rehearsed 10–15 minute live demo of the golden path (07 §12). All data is fake.

## Before the demo

```bash
npm run db:reset     # known starting state: HRB-DEMO + 5 users, no patient/visit/invoice
npm run dev          # http://localhost:3000
```

Optional: `npm run smoke:test` replays the whole journey headless on the **test**
database and asserts every acceptance-critical outcome (reconciliation, numbering,
audit, RBAC, scoping). (`npm run smoke:dev` targets the dev DB — manual/dev-only.)

Demo users (password `HMIS_DEMO_SHARED_PASSWORD` for all):

| Nom | Rôle | Identifiant |
|---|---|---|
| Awa NJOYA | Administrateur | awa.njoya@hrb-demo.cm |
| Brigitte MBARGA | Agent d'accueil | brigitte.mbarga@hrb-demo.cm |
| Dr Jean-Paul ETOA | Médecin | jeanpaul.etoa@hrb-demo.cm |
| Solange ABENA | Caissier | solange.abena@hrb-demo.cm |
| Dr Emmanuel TCHOUA | Directeur (lecture seule) | emmanuel.tchoua@hrb-demo.cm |

## Golden path (the rehearsed story)

1. **Login** as **Brigitte MBARGA** (Agent d'accueil) → select **HRB-DEMO**. Note the
   sidebar shows only *Tableau de bord* + *Patients* (RBAC).
2. **Patients → Rechercher un patient** ("BELLO") → no match → **Créer un patient**.
3. Fill *Informations principales* (Aïssatou BELLO, Féminin, 14/03/1990) → **Enregistrer**.
   Patient `HRB-DEMO-P-2026-000001`; the patient banner appears.
4. **Ouvrir une visite** (Médecine générale, motif « Fièvre et céphalées… ») →
   `HRB-DEMO-V-2026-000001`.
5. **Sign out**, login as **Dr ETOA** (Médecin). Open the visit →
   **Enregistrer la consultation** (motif, note, constantes, diagnostic, conduite).
6. **Sign out**, login as **Solange ABENA** (Caissier). Sidebar now shows *Facturation*.
7. Open the visit → **Créer la facture** (Consultation 2 000 + Ouverture de dossier
   1 000 = **3 000 FCFA**) → `HRB-DEMO-F-2026-000001`.
8. **Encaisser** (3 000 FCFA, Espèces) → statut **Payée**; receipt `HRB-DEMO-R-2026-000001`.
9. **Imprimer le reçu** → official receipt (République du Cameroun · MINSANTE · hospital,
   numbers, total, prototype label) → print / save as PDF.
10. *(Optional RBAC moment)* as Brigitte, attempting to encaisser is **refused server-side**
    and logged as `authz.denied`.
11. Login as **Dr TCHOUA** (Directeur). **Tableau de bord** reads **1 / 1 / 3 000 FCFA**;
    **Journal d'audit** lists every action with actor + time.

The receipt, the dashboard and the audit log all reconcile on **3 000 FCFA**.

## Reset between runs

`npm run db:reset` returns to the known starting state. Numbers are deterministic, so
every run reproduces the same journey.
