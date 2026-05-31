# Alpha Imagerie — Agent IA vocal

Agent vocal IA pour le centre d'imagerie médicale **Alpha Imagerie** (sites de
Cergy et Goussainville). Il répond aux appels patients en **débordement** de
l'accueil humain, qualifie les demandes (RDV, préparation d'examen, horaires,
accès), transfère vers une secrétaire si besoin (SIP REFER) et alimente une
**file de rappel** + des **relances multicanal** dans un back-office.

> Application de production conforme **RGPD/HDS**. Aucune donnée de santé en
> dur, aucun secret en clair. Voir `docs/compliance-hds.md`.

## Architecture (monorepo)

```
/apps
  /voice-gateway   # Passerelle média temps réel (Python, LiveKit/Pipecat) — Phase 1+
  /core-api        # Backend NestJS : auth/RBAC, audit, appels, agenda, relances
  /back-office     # Next.js : dashboard secrétaires
/packages
  /domain          # Types métier, enums, matrice RBAC (TS partagé)
  /providers       # CalendarProvider (abstraction Doctolib) + contrats IA
  /telephony       # Helpers SIP/3CX, REFER, click-to-call (Phase 2)
  /messaging       # WhatsApp/SMS/voix sortante (Phase 6)
/infra
  /docker          # init Postgres, etc.
  /deploy          # cibles OVHcloud/Scaleway HDS
/docs              # 3cx-setup, doctolib, compliance-hds
```

**Choix de stack (Phase 0)** : `core-api` et `back-office` en **TypeScript**
(NestJS + Next.js, code et types partagés) ; `voice-gateway` en **Python**
(écosystème LiveKit/Pipecat + faster-whisper), communiquant avec `core-api` en
HTTP/REST. Persistance **PostgreSQL** (Prisma), files **Redis**.

## Démarrage rapide (Phase 0)

```bash
# 1. Configuration
cp .env.example .env
# Générer la clé de chiffrement (32 octets base64) et la coller dans ENCRYPTION_KEY :
openssl rand -base64 32

# 2. Tout démarrer (Postgres, Redis, core-api [migrate+seed], back-office, voice-gateway)
docker compose up --build

# 3. Accès
#   - Back-office : http://localhost:3000  (login : SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
#   - API santé   : http://localhost:4000/api/health
```

### Développement hors Docker

```bash
pnpm install
pnpm --filter @alpha/domain build      # build des types partagés d'abord
pnpm --filter @alpha/core-api prisma:generate
pnpm --filter @alpha/core-api start:dev
pnpm --filter @alpha/back-office dev
```

### Tests

```bash
pnpm --filter @alpha/core-api test     # crypto, audit (caviardage), auth, RBAC
```

## Avancement par phases

| Phase | Contenu | État |
|------|---------|------|
| 0 | Socle : monorepo, Docker, Postgres/Redis, schéma DB, auth/RBAC, audit | ✅ livré |
| 1 | Passerelle voix minimale (STT→LLM→TTS, journalisation appel) | à venir |
| 2 | 3CX (trunk SIP, débordement, REFER) | à venir |
| 3 | Base de connaissance imagerie + RAG | à venir |
| 4 | Agenda (CalendarProvider + iCal + stub Doctolib partenaire) | à venir |
| 5 | File de rappel + back-office complet | à venir |
| 6 | Relances multicanal (WhatsApp/SMS/voix) | à venir |
| 7 | Conformité (chiffrement, rétention/purge, consentements) | à venir |
| 8 | Supervision & qualité (métriques, charge, E2E) | à venir |

## Contraintes structurantes

- **Doctolib** : pas d'API publique → abstraction `CalendarProvider`, lecture iCal,
  écriture déportée en back-office. Voir `docs/doctolib.md`.
- **3CX** : intégration trunk SIP → instance **self-hosted / private-cloud** requise.
  Voir `docs/3cx-setup.md`.
- **HDS** : hébergement certifié EEE, chiffrement, audit append-only, rétention.
  Voir `docs/compliance-hds.md`.
