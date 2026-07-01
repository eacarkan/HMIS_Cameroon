# Script de démonstration contrôlée MINSANTE (par rôle)

**Projet :** SIGH/DME (HMIS/EMR) — fondation cœur-pilote Phase 1
**Public :** MINSANTE (démonstration contrôlée) · **Durée :** ≈ 60–90 minutes
**Données :** fictives / de démonstration uniquement (HRB-DEMO) · **Statut :** Projet pour revue du mentor · **Date :** 2026-06-28

> Ton : sobre, administratif. Présenter des faits, sans langage commercial. Lorsqu'un élément n'est pas construit ou pas autorisé, le dire clairement.

---

## Déclaration d'ouverture (à lire, ≈ 2 minutes)
« Ceci est une **démonstration contrôlée** d'une **fondation cœur-pilote Phase 1** d'un Système d'Information de Gestion Hospitalière (SIGH) doté d'un Dossier Médical Électronique (DME), présentée pour revue technique. Tout ce que vous verrez fonctionne sur des **données fictives et préchargées** dans un hôpital de démonstration. Le système est un **prototype de démonstration fonctionnelle** — il **n'est pas apte à un usage en production**, il **n'est pas autorisé pour des données réelles de patients**, et il **n'est pas autorisé pour l'exploitation hospitalière**. Son objet aujourd'hui est de valider l'orientation avant l'audit hospitalier et la conception détaillée, et d'identifier les décisions attendues du Ministère. »

## Limites et avertissements (à lire, ≈ 2 minutes)
- L'écran et chaque document imprimé portent la mention : **« Prototype de démonstration fonctionnelle — non destiné à la production »**.
- Tous les hôpitaux, utilisateurs, patients, tarifs et montants sont **fictifs**. Aucun système réel n'est connecté.
- L'usage de données réelles et l'exploitation requièrent une autorisation organisationnelle distincte (**Gate 7**) : autorisation écrite du MINSANTE, hébergement approuvé, sauvegarde/restauration, référentiel et audit indépendant de cybersécurité, validation de protection des données, formation et protocole d'acceptation.
- La démonstration **ne constitue pas** une acceptation, une autorisation de production, ni une attribution de marché.
- Les identifiants de démonstration sont fournis **séparément, par un canal contrôlé** ; ils ne sont pas montrés ici.

---

## Déroulé pas à pas

> Légende — **Rôle** = le compte de démonstration utilisé · **Preuve** = la capture d'écran ou le contrôle qui corrobore l'étape.

### Segment 1 — Connexion, contexte hôpital, navigation selon le rôle (≈ 5–10 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 1.1 | administrateur | Se connecter ; afficher l'accueil | « L'accès requiert une authentification. Noter la mention prototype, en haut à droite l'hôpital actif, et que le menu reflète le rôle. » | en direct ; `docs/gate4-screenshots/01-administration-config.png` |
| 1.2 | administrateur | Montrer la sélection d'hôpital | « Toutes les données sont **cloisonnées à l'hôpital sélectionné**. Seul l'hôpital de démonstration HRB-DEMO est actif ; les autres sont listés mais inactifs. » | en direct (`/selection-hopital`) |
| 1.3 | administrateur | Souligner la navigation selon le rôle | « L'interface est **en français**. Le menu et les actions changent selon le rôle ; l'accès est appliqué côté serveur, pas seulement masqué. » | en direct |

### Segment 2 — Flux patient (≈ 10–15 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 2.1 | agent_accueil | Rechercher d'abord le patient | « L'enregistrement commence par une **recherche avant création** pour réduire les doublons. » | en direct (`/patients`) |
| 2.2 | agent_accueil | Enregistrer la patiente *Aïssatou BELLO* | « Identité de base, fictive. Le système attribue un numéro de patient par hôpital, ex. `HRB-DEMO-P-2026-000001`. » | en direct ; `03-patient-identite.png` |
| 2.3 | agent_accueil | Ouvrir le volet identité / contacts | « Contacts et identifiants peuvent être saisis. Un **avis de doublon** déterministe est affiché pour revue — **aucune fusion automatique, aucun index patient national** dans cette phase. » | `03-patient-identite.png` |

### Segment 3 — Flux clinique (≈ 10–15 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 3.1 | agent_accueil | Ouvrir un passage externe | « Une visite est ouverte et rattachée au patient et à l'hôpital, ex. `HRB-DEMO-V-2026-000001` — motif « Fièvre et céphalées ». » | en direct |
| 3.2 | medecin | Saisir une consultation | « Le clinicien saisit la consultation rattachée à cette visite. L'agent d'accueil ne peut pas le faire — séparation des tâches. » | en direct ; `04-consultation-clinique.png` |
| 3.3 | medecin | Saisir observations structurées et diagnostic | « Constantes/observations et diagnostic codé à côté du texte libre. La saisie d'ordonnance/prescription n'est prévue **que si confirmée lors de l'audit** et n'est pas démontrée comme circuit exécuté. » | `04-consultation-clinique.png` |

### Segment 4 — Flux facturation / reçu / caisse (≈ 10–15 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 4.1 | caissier | Créer une facture à partir des tarifs en base | « Les tarifs proviennent des **tarifs de démonstration configurés en base** (aucun prix codé en dur). Deux lignes : consultation 2 000 + ouverture de dossier 1 000 = **3 000 FCFA**. La facture fige un instantané des prix. La validation des tarifs réels reste à confirmer par le MINSANTE. » | `05-facturation-tarifs.png` |
| 4.2 | caissier | Enregistrer le paiement | « Paiement en espèces, FCFA entier, format français. La facture passe à « Payée ». » | en direct (`/encounters/[id]/facturation`) |
| 4.3 | caissier | Imprimer le reçu | « Un **prototype de reçu** avec en-tête **institutionnel simulé** — République / MINSANTE / hôpital — **à valider par le MINSANTE**, le montant, un numéro de document `HRB-DEMO-R-2026-000001`, et la mention prototype. Le format officiel du reçu est une décision du MINSANTE. » | `06-recu.png` |
| 4.4 | caissier | Ouvrir le rapport de caisse journalier | « Une liste par jour et par hôpital des paiements enregistrés, avec nombre et total — ici 1 reçu / 3 000 FCFA. » | `docs/gate5b-screenshots/01-rapport-caisse.png` |
| 4.5 | caissier | Exporter le rapport en CSV | « Le rapport peut être exporté en CSV pour revue. L'export est lui-même journalisé dans l'audit. » | en direct (`/rapports-caisse/export`) |

### Segment 5 — Administration / configuration / cycle de vie des comptes (≈ 5–10 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 5.1 | administrateur | Montrer la configuration (départements, unités, tarifs) | « Les données de référence — départements, unités de service, paramètres, tarifs — sont configurables. Les tarifs réels requièrent une validation — **à confirmer lors de l'audit hospitalier**. » | `01-administration-config.png`, `02-tarifs.png` |
| 5.2 | administrateur | Montrer le cycle de vie des comptes | « Les administrateurs peuvent créer des comptes, activer/désactiver, attribuer ou retirer des rôles, cloisonnés à l'hôpital et journalisés. » | `docs/gate5b-screenshots/02-utilisateurs.png` |
| 5.3 | administrateur | Signaler le garde-fou anti-verrouillage | « Le système empêche de retirer ou désactiver le dernier administrateur, et un administrateur ne peut pas se verrouiller lui-même. La **procédure** complète de cycle de vie des comptes reste à approuver par le MINSANTE. » | en direct (message de refus) |

### Segment 6 — Audit / RBAC / éléments de sécurité (≈ 5–10 min)
| Étape | Rôle | Action | Note de présentation | Preuve |
|---|---|---|---|---|
| 6.1 | administrateur | Ouvrir le journal d'audit | « Chaque action significative est enregistrée — qui, quoi, quand — dans un journal en ajout seul, avec libellés français. » | `07-journal-audit.png` |
| 6.2 | agent_accueil | Tenter une action de caisse (refusée) | « Un utilisateur sans l'habilitation est **bloqué côté serveur**, et le refus est enregistré (`authz.denied`) — pas seulement masqué dans le menu. » | en direct ; contrôle smoke « RBAC block » |
| 6.3 | directeur | Montrer la consultation en lecture seule | « Le rôle directeur est en **lecture seule** : tableaux de bord, patients, rapports, audit — aucune création ni modification. » | en direct |

### Segment 7 — Limites connues (≈ 5 min)
Parcourir `DEMO_SCOPE_AND_LIMITATIONS.md` : pas de données réelles ; pas de production/hébergement ; sauvegarde/restauration, audit de cybersécurité, formation, règles légales DME, rétention des données en attente ; modules Phase 2 (pharmacie, laboratoire, radiologie, hospitalisation, urgences, soins infirmiers, file d'attente) et intégrations Phase 4 (IPP, DHIS2, mode hors-ligne, assurance/mutuelle, paiements externes) non implémentés ; aucune revendication d'aptitude mobile.

### Segment 8 — Décisions attendues du MINSANTE (≈ 5–10 min)
Parcourir `DECISIONS_ATTENDUES_DU_MINSANTE.md`. Insister sur : mandat écrit de poursuite ; protection de confidentialité / rémunération avant divulgation approfondie ; autorisation de la démonstration contrôlée ; confirmation des hôpitaux cibles ; autorisation d'audit hospitalier ; et les conditions du Gate 7 pour tout usage de données réelles.

---

## Clôture — décisions attendues du MINSANTE (à lire, ≈ 2 minutes)
« En résumé : la démonstration de ce jour présente une **fondation cœur-pilote Phase 1** sur données fictives — enregistrement du patient, passage, consultation, facturation et reçu, rapport de caisse, configuration, cycle de vie des comptes, audit et contrôle d'accès basé sur les rôles. Ce n'est **pas** la production, et **pas** une autorisation de données réelles. Les décisions que nous sollicitons du Ministère sont : un **mandat écrit et une protection de confidentialité** avant toute divulgation technique ou financière approfondie ; une **autorisation de démonstration contrôlée** ; la **confirmation des hôpitaux cibles et d'un audit hospitalier** ; et les **conditions du Gate 7** — l'autorisation organisationnelle requise avant tout usage de données réelles de patients. La maintenance et l'exploitation, si elles sont requises ultérieurement, feraient l'objet d'un **contrat de service optionnel distinct**. »
