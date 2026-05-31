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
pnpm --filter @alpha/core-api test     # crypto, audit (caviardage), auth, RBAC, calls

# Passerelle voix (Python)
cd apps/voice-gateway && python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt && python -m pytest   # garde-fous + boucle agent
```

### Supervision & test de charge (Phase 8)

- Métriques agent (responsable/admin) : `GET /api/supervision/metrics` — taux de
  résolution / transfert, **latence perçue** (cible < 800 ms), motifs, urgences.
  Dashboard : page back-office `/supervision`.
- Test de charge (sans dépendance) :

```bash
node scripts/loadtest.mjs http://localhost:4000/api/health 50 10
# /health est exempté du rate-limit ; les autres routes sont throttlées.
```

### Simuler un appel de bout en bout (Phase 1)

Avec `core-api` démarré (et `SERVICE_API_KEY` partagé) :

```bash
cd apps/voice-gateway && . .venv/bin/activate
CORE_API_URL=http://localhost:4000 SERVICE_API_KEY=<clé> python -m src.simulate_call
# => crée un `call` + un `transcript` dans core-api (numéro chiffré, audit tracé)
```

> L'intégration SIP réelle (LiveKit Agents ↔ 3CX) se branche en Phase 2 via
> `apps/voice-gateway/src/livekit_agent.py` ; la boucle métier est déjà testée.

## Avancement par phases

| Phase | Contenu | État |
|------|---------|------|
| 0 | Socle : monorepo, Docker, Postgres/Redis, schéma DB, auth/RBAC, audit | ✅ livré |
| 1 | Passerelle voix minimale (STT→LLM→TTS, garde-fous médicaux, journalisation appel + transcription) | ✅ livré |
| 2 | 3CX/SIP : worker LiveKit (agent = extension), DID→site, REFER vers file 721, doc taillée | 🟡 code + config + doc (activation infra requise) |
| 3 | Base de connaissance imagerie + RAG (prépa, contre-indications, horaires/accès), éditable + validée | ✅ livré |
| 4 | Agenda : CalendarProvider + iCal (lecture réelle) → cache, stub Doctolib partenaire, déport RDV en tâche de rappel | ✅ livré |
| 5 | File de rappel + back-office (journal d'appels, transcriptions, assignation, click-to-call) | ✅ livré |
| 6 | Relances multicanal (WhatsApp/SMS/voix) : consentement, opt-out, fenêtre horaire, BullMQ, traçabilité | ✅ livré |
| 7 | Conformité : audit immuable (trigger), purge par rétention, droits RGPD (export/effacement), filtre d'erreurs, rate-limiting | ✅ livré |
| 8 | Supervision & qualité : métriques (résolution/transfert/latence), dashboard, parcours E2E, test de charge | ✅ livré |

## Contraintes structurantes

- **Doctolib** : pas d'API publique → abstraction `CalendarProvider`, lecture iCal,
  écriture déportée en back-office. Voir `docs/doctolib.md`.
- **3CX** : intégration trunk SIP → instance **self-hosted / private-cloud** requise.
  Voir `docs/3cx-setup.md`.
- **HDS** : hébergement certifié EEE, chiffrement, audit append-only, rétention.
  Voir `docs/compliance-hds.md`.
