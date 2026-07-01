# Note de présentation — Démonstration contrôlée MINSANTE

**Projet :** SIGH/DME (HMIS/EMR) — fondation cœur-pilote Phase 1
**Destinataire :** Ministère de la Santé Publique (MINSANTE)
**Statut :** Projet pour revue du mentor · **Date :** 2026-06-28 · **Branche :** `feature/gate4-ui-workflows`
**Périmètre :** **données fictives / de démonstration uniquement — non destiné à la production — non autorisé pour des données réelles de patients**

> *Version française des documents destinés au MINSANTE. La version anglaise reste dans le dépôt pour la revue technique interne.*

## 1. Objet
Le présent prototype démontre une **fondation cœur-pilote Phase 1** d'un Système d'Information de Gestion Hospitalière (SIGH) doté d'un Dossier Médical Électronique (DME), en français, présenté à des fins de **revue technique et de démonstration contrôlée**. Tout ce qui est présenté fonctionne sur des **données fictives et préchargées**.

Cette présentation appuie une **démonstration contrôlée** et une **revue d'aptitude au pilote**. Elle **ne déclare pas** une aptitude à la production et **n'autorise pas** un usage opérationnel hospitalier.

## 2. Positionnement
Le système démontre une fondation cœur-pilote Phase 1 ; il **ne remplace pas** : l'acceptation contractuelle complète ; l'audit des processus hospitaliers ; l'approbation de l'hébergement ; un audit de cybersécurité indépendant ; ni une autorisation de traitement de données réelles de patients. Plusieurs éléments restent **à confirmer par le MINSANTE** et **à confirmer lors de l'audit hospitalier**.

## 3. Capacités démontrées (sur données fictives)
Connexion ; sélection de l'hôpital ; navigation selon le rôle ; recherche avant création de patient ; enregistrement du patient ; volet identité / contacts / identifiants / doublon (revue uniquement, **sans fusion, sans IPP national**) ; passage (visite) externe ; consultation ; observations structurées / diagnostic ; sélection de tarifs configurés en base (environnement de démonstration) ; facture / paiement / reçu (FCFA entier) ; rapport de caisse journalier ; export CSV ; tableau de bord ; journal d'audit ; contrôle d'accès basé sur les rôles (RBAC) appliqué côté serveur ; cloisonnement par hôpital ; cycle de vie des comptes utilisateurs (avec garde-fous anti-verrouillage administrateur).

## 4. Déroulé de la démonstration (≈ 60–90 minutes)
Introduction et limites → connexion et contexte hôpital → flux patient → flux clinique → facturation / reçu / caisse → administration / configuration / cycle de vie des comptes → audit / RBAC / éléments de sécurité → limites connues → décisions attendues du MINSANTE. Le script détaillé figure dans `SCRIPT_DE_DEMONSTRATION.md`.

## ⚠️ Avertissement — données fictives
Tous les hôpitaux, utilisateurs, rôles, patients, tarifs, factures et paiements sont **fictifs et préchargés**. L'hôpital de démonstration actif est **HRB-DEMO** (« Hôpital Régional de Bertoua — Démo »). **Aucune connexion** à un système, registre ou base hospitalière réels.

## ⚠️ Aucune donnée réelle de patient
La démonstration ne doit **jamais** utiliser de données réelles de patients. L'usage de données réelles requiert le **Gate 7** (autorisation écrite du MINSANTE + hébergement, sécurité, protection des données, formation et protocole d'acceptation).

## ⚠️ Aucun usage en production
Le système **n'est pas apte à un usage en production** et **n'est pas** autorisé pour l'exploitation hospitalière. La mention de prototype figure à l'écran et sur les documents imprimés : « Prototype de démonstration fonctionnelle — non destiné à la production ».

## 5. Identifiants
Les identifiants de démonstration sont fournis **séparément, par un canal contrôlé** ; ils ne figurent **pas** dans le présent dossier (voir `ROLE_BASED_DEMO_USERS_REDACTED.md`).

## 6. Distribution contrôlée / confidentialité
Ce dossier est **confidentiel** et partagé **uniquement** pour la revue technique et la démonstration. Il **ne transfère pas** la propriété intellectuelle, le code source, l'architecture technique/sécurité complète, la topologie de déploiement, le modèle financier ou la stratégie fournisseurs. Voir `NOTE_DE_PROTECTION_COMMERCIALE.md`.
