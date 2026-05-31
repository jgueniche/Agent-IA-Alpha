# Base de connaissance imagerie + RAG (Phase 3)

## Objectif

Donner à l'agent des réponses **fiables et validées** sur la préparation des
examens, les contre-indications, les documents, les horaires et l'accès — sans
laisser le LLM improviser sur des sujets médicaux/logistiques.

## Modèle

`knowledge_items` (cf. schéma Prisma) : `key` (clé métier stable), `modality`,
`type` (prep / contre_indication / doc / acces / horaires), `title`, `content`,
`siteSlug`, `version`, `isActive`, `validatedById` / `validatedAt`.

- **Versioning** : toute modification de `content` incrémente `version` et
  **invalide la validation** précédente (`validatedById` repassé à null).
- **Validation** : un responsable/radiologue valide (`POST /knowledge/:id/validate`),
  ce qui trace le « validé par » + la date. Contenu de seed = **non validé** par
  défaut (à faire relire par un radiologue avant mise en service).

## RAG — étape « retrieval »

L'agent appelle `POST /api/knowledge/search` (clé de service) — c'est l'outil
`lookup_exam_prep`. Le scoring est **lexical** (overlap de tokens normalisés +
boosts modalité/type/site), 100 % souverain et déterministe
(`apps/core-api/src/knowledge/text-score.ts`).

> **Évolution sans réécriture** : ce retriever peut être remplacé par un
> retriever **vectoriel** (pgvector + embeddings hébergés en EEE) en gardant le
> même endpoint `search()`. L'agent (voice-gateway) n'a pas à changer : il
> consomme un `KnowledgeRetriever` (HTTP en prod, en-mémoire en test).

## Garde-fous (rappel)

Le retrieval n'intervient que pour des questions d'**information**. Les demandes
de **résultats / diagnostic** sont refusées et transférées ; les **urgences**
déclenchent la consigne d'appeler le 15 + transfert (cf. `agent/guardrails.py`).

## Édition (back-office)

- API : `GET /knowledge`, `GET /knowledge/:id`, `POST /knowledge`,
  `PATCH /knowledge/:id`, `POST /knowledge/:id/validate` — sous RBAC
  (`knowledge:read` / `knowledge:write` / `knowledge:validate`).
- UI : page `/knowledge` (liste, édition de contenu, validation).

## Validé par les tests

- core-api : scoring (accents/mots vides), versioning, invalidation, validation.
- voice-gateway : **10 scénarios métier** répondus depuis la base
  (`tests/test_knowledge_scenarios.py`) + détection d'intention/modalité.
- E2E : appel simulé multi-tours répondant « à jeun / IRM » depuis la base ;
  édition + validation + RBAC vérifiés via l'API.
