# Gate 7 Readiness Evidence (synthetic) · Évidence de préparation Gate 7 (synthétique)

> **Phase 2J — cross-cutting hardening.** Synthetic / fake data only · **NOT Gate 7** · no real data · no production authorization. This document is **evidence**, not an authorization. The software CANNOT self-authorize Gate 7.

---

## EN — Readiness evidence

### 1. What this is
A readiness checklist + evidence for the V1.0 prototype, assembled by Phase 2J. It records what the **software** carries today and, separately, the **administrative / infrastructure prerequisites** that only the MINSANTE and a deployment/security party can satisfy. Nothing here grants production authorization.

### 2. Delivered by the software (status: *ready*)
- **Bilingual UI (Fr/En).** French is the base; English is a progressive overlay. The new Phase 2 modules (emergency, queue, hospitalization, lab/radiology) and the navigation are fully bilingual; an automated parity test (`tests/unit/i18n-parity.test.ts`) fails if a declared-bilingual key lacks its English translation. English is essential for **Bamenda** and **Buéa**.
- **Health / status page** (`/etat-systeme`): DB connectivity, env validity, app version, data-mode marker, and this readiness checklist.
- **Append-only audit trail** across every Phase 1 + Phase 2 action (hospital-scoped).
- **Synthetic data only**: the real-data path is fail-closed/disabled; the privacy check (`npm run check:privacy`) asserts no secrets, the prototype label, and fake `@hrb-demo.cm` accounts.
- **Draft autosave** (Phase 2J, IndexedDB) for long clinical notes ONLY — draft protection, never offline mode. A scope guard (`lib/draft-autosave.ts`, unit-tested) makes it impossible to autosave payments, stock, dispensing, refunds, or any irreversible action.

### 3. Hooks / placeholders (status: *placeholder* — infrastructure config)
- **Backup export hook**: the interface exists; **no backup target URL is configured in the software** (no hard-coded CETIC/backup URL). Encryption-before-leaving-server and key management are **infrastructure responsibilities**.
- **Local-server configuration**: deployment config is carried as a placeholder; on-prem provisioning is an infrastructure task.

### 4. Administrative prerequisites — NOT self-authorizable by the software (status: *administrative*)
Gate 7 authorization requires all of the following, none of which software can assert:
- **Signed UAT** (user acceptance testing signed off by the hospital).
- **Validated hardware deployment** (servers/network validated on-site).
- **Baseline cybersecurity assessment** (performed by a specialized party / MINSANTE process).
- **Encryption + key management** at the infrastructure layer.

### 5. UAT hardening evidence (synthetic)
- **Zero critical blockers** recorded: no data loss, no calculation errors (integer FCFA throughout; reconciliation + billing tested), no critical access-control leaks (capability RBAC + the lab/radiology result-visibility gate are adversarially reviewed and tested).
- **Automated suite (synthetic DB):** unit + component + integration (Vitest) green; Playwright e2e (production build) green; `npm run smoke` golden path; `npm run check:arch`; `npm run check:privacy`. Cumulative at end of Phase 2: **496 vitest tests**, **40 e2e specs**, all green. See `docs/phase2-implementation-logs/` per-unit logs and the consolidated review.
- **Adversarial reviews** were run for the risky Phase 2 units (stock mutations, financial flows, the emergency exception, hospitalization discharge gate, and the lab/radiology visibility gate); confirmed blockers/majors were fixed before commit.

### 6. Out of scope / deferred
Full offline mode; execution of the cybersecurity assessment; real-data pilot; production deployment. **This is not Gate 7.**

---

## FR — Évidence de préparation

### 1. Objet
Une liste de contrôle + évidence pour le prototype V1.0, constituée par la Phase 2J. Elle distingue ce que le **logiciel** porte aujourd'hui des **prérequis administratifs / d'infrastructure** que seuls le MINSANTE et une partie déploiement/sécurité peuvent satisfaire. Rien ici ne donne d'autorisation de production.

### 2. Fourni par le logiciel (*fourni*)
- **Interface bilingue (Fr/En)** — base française + surcouche anglaise progressive ; les nouveaux modules Phase 2 et la navigation sont entièrement bilingues (test de parité automatisé). L'anglais est essentiel pour **Bamenda** et **Buéa**.
- **Page d'état / santé** (`/etat-systeme`), **journal d'audit en annexe seule**, **données synthétiques uniquement** (chemin données réelles désactivé, fail-closed).
- **Autosauvegarde de brouillon** (IndexedDB) pour les **notes cliniques longues uniquement** — protection de brouillon, jamais mode hors-ligne ; un garde-fou interdit toute autosauvegarde de paiements/stock/actions irréversibles.

### 3. Crochets / réservations (*crochet — configuration d'infrastructure*)
- **Crochet d'export de sauvegarde** : interface présente ; **aucune cible configurée dans le logiciel** (pas d'URL CETIC/sauvegarde codée en dur). Chiffrement avant sortie du serveur + gestion des clés = **responsabilité d'infrastructure**.
- **Configuration serveur local** : portée comme réservation ; provisionnement sur site = tâche d'infrastructure.

### 4. Prérequis administratifs — NON auto-validables par le logiciel (*administratif*)
**UAT signée** · **matériel validé / déployé** · **évaluation cybersécurité de base** · **chiffrement + gestion des clés** (infrastructure). Le logiciel ne peut affirmer aucun de ces points.

### 5. Évidence de durcissement UAT (synthétique)
**Zéro blocage critique** (pas de perte de données, pas d'erreur de calcul — FCFA entiers ; pas de fuite d'accès critique — RBAC par capacité + barrière de visibilité des résultats labo/imagerie, revues et testées). Suite automatisée verte (vitest **496**, e2e **40**, smoke, arch, privacy). Revues adverses menées sur les unités sensibles ; blocages/majeurs corrigés avant commit.

### 6. Hors périmètre
Mode hors-ligne complet ; exécution de l'évaluation cybersécurité ; pilote données réelles ; déploiement en production. **Ce n'est pas le Gate 7.**
