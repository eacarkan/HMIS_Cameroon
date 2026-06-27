# UAT — Phase 0 Walking Skeleton

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Manual user-acceptance checklist for a human reviewer. All data is **fake**. The app is
**French-first**. Mark each case **Pass / Fail** and add notes.

## Preconditions

- Local PostgreSQL running; app started with `npm run dev` (http://localhost:3000).
- Demo data reset/seeded: `npm run db:reset` (known starting state — no patient/visit/invoice).
- Browser: latest Chrome/Firefox/Safari.
- **No real patient data** anywhere.

Demo users — password **`demo1234`** for all:

| Persona | Rôle | Identifiant |
|---|---|---|
| Awa NJOYA | Administrateur | awa.njoya@hrb-demo.cm |
| Brigitte MBARGA | Agent d'accueil | brigitte.mbarga@hrb-demo.cm |
| Dr Jean-Paul ETOA | Médecin | jeanpaul.etoa@hrb-demo.cm |
| Solange ABENA | Caissier | solange.abena@hrb-demo.cm |
| Dr Emmanuel TCHOUA | Directeur (lecture seule) | emmanuel.tchoua@hrb-demo.cm |

## Test cases

| # | Objective | Actor | Steps | Expected result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| 1 | Login | Agent d'accueil | Open app → redirected to `/connexion` → enter identifiant + `demo1234` → Se connecter | Authenticated; lands on hospital selection or dashboard | | |
| 2 | Hospital selection | Agent d'accueil | Choose « Hôpital Régional de Bertoua — Démo » | Active hospital set; dashboard shown; top bar shows HRB-DEMO | | |
| 3 | French-first navigation | Any | Inspect sidebar + pages | All labels/menus/messages in French (Tableau de bord, Patients, …) | | |
| 4 | Prototype label visible | Any | Look at every screen + the receipt | « Prototype de démonstration… » band always visible; also on the receipt | | |
| 5 | Patient search-before-create | Agent d'accueil | Patients → search « BELLO » before creating | No match shown; « Créer un patient » offered only after search | | |
| 6 | Patient creation | Agent d'accueil | Créer un patient → Aïssatou BELLO, Féminin, 14/03/1990 → Enregistrer | Patient saved, number **HRB-DEMO-P-2026-000001**, redirected to detail | | |
| 7 | Patient banner | Agent d'accueil | View patient detail | Sticky banner shows name, N° patient, âge/sexe (36 ans · Féminin), hôpital, visite en cours | | |
| 8 | Encounter creation | Agent d'accueil | Ouvrir une visite (Médecine générale, motif) | Visit opened, number **HRB-DEMO-V-2026-000001**, statut Ouverte | | |
| 9 | Consultation | Médecin | Login as doctor → open the visit → Enregistrer la consultation (motif, note, constantes…) | Consultation recorded, statut Finalisée, appears in the encounter | | |
| 10 | Invoice creation | Caissier | Login as cashier → open the visit → Créer la facture (Consultation 2 000 + Ouverture 1 000) | Invoice **HRB-DEMO-F-2026-000001**, total **3 000 FCFA** | | |
| 11 | Payment | Caissier | Encaisser (3 000 FCFA, Espèces) | Statut **Payée**; receipt **HRB-DEMO-R-2026-000001** | | |
| 12 | Receipt preview/print | Caissier | Imprimer le reçu → preview → print/save PDF | Official receipt: République du Cameroun / Ministère / hôpital, N° reçu, patient, N° facture, lignes, Total, Montant payé 3 000 FCFA, Caissier, prototype label | | |
| 13 | Dashboard KPIs | Directeur | Login as director → Tableau de bord | Patients aujourd'hui **1**, Visites ouvertes **1**, Encaissements **3 000 FCFA**; Activité récente lists actions | | |
| 14 | Audit log | Directeur | Journal d'audit → review + filter « Paiement » | Entries show acteur / action / entité / heure / résumé; filter narrows to payment | | |
| 15 | RBAC denied action | Agent d'accueil | Confirm sidebar has no Facturation/Audit; navigate directly to `/journal-audit` | Nav filtered by role; direct route redirects to dashboard (guarded server-side) | | |
| 16 | Logout | Any | User menu → Se déconnecter | Session ends; redirected to `/connexion` | | |
| 17 | Narrow screen | Any | Resize to ~390px / mobile | Top bar + content remain usable; banner + prototype label visible (sidebar may hide) | | |
| 18 | No real data | Reviewer | Inspect seed + UI | Only fake Cameroonian-style demo data; no real national ID; HRB-DEMO marked « Démo » | | |

## Sign-off

- [ ] All P0 cases pass (1–16, 18).
- [ ] Receipt prints cleanly in monochrome.
- [ ] No real patient data observed.
- Reviewer: ______________  Date: ____________
