# Conformité HDS / RGPD — checklist

Dès qu'un tiers héberge des données de santé, la **certification HDS**
(référentiel HDS v2, hébergement physique dans l'EEE) est **obligatoire**. Cette
checklist suit l'avancement ; l'implémentation complète est consolidée en
**Phase 7**.

## Hébergement

- [ ] Infra **certifiée HDS** (OVHcloud HDS / Scaleway HDS / Outscale), datacenters EEE.
- [ ] Aucune donnée de santé envoyée vers un service **hors EEE** non conforme.
- [ ] STT / LLM / TTS **auto-hébergés ou hébergés en EEE** (pas d'API US par défaut).
- [x] Architecture conçue pour STT/LLM/TTS interchangeables (interfaces `providers`).

## Chiffrement

- [x] **En transit** : TLS sur les API (helmet + reverse-proxy TLS en prod), SRTP/mTLS pour SIP (Phase 2).
- [x] **Au repos applicatif** : champs sensibles chiffrés AES-256-GCM (`CryptoService`).
- [ ] **Au repos disque** : chiffrement volume DB + stockage enregistrements (infra/déploiement HDS).
- [x] Clé de chiffrement hors code (`ENCRYPTION_KEY` via env/coffre) ; rotation prévue.

## Journal d'audit

- [x] `audit_log` **append-only** garanti par **trigger PostgreSQL** (UPDATE/DELETE
  rejetés ; DELETE uniquement via purge de rétention contrôlée — Phase 7).
- [x] Tous les accès/échecs d'auth tracés (`AuthService` audite login / login_failed).
- [x] **Consultation de donnée patient** tracée : lecture d'appels/transcriptions,
  numéro déchiffré (`caller_number`), file de rappel et click-to-call audités (Phase 5).
- [x] **Aucune donnée de santé** dans l'audit : caviardage des clés sensibles (`AuditService.sanitize`).

## Données patient

- [x] Données d'identité **séparées** des données opérationnelles (modèle `Patient` isolé).
- [x] Identité chiffrée ; recherche par téléphone via **HMAC** (`phoneHash`) sans déchiffrer.
- [ ] Registre des traitements, base légale documentée (DPO — organisationnel).
- [x] **Droit d'accès** (`GET /patients/:id/export`) et **droit à l'effacement**
  (`DELETE /patients/:id`, cascade consentements) — audités (Phase 7).

## Consentement

- [x] Modèle `Consent` avec types **distincts** (enregistrement, relance transactionnelle, marketing, traitement).
- [ ] Message d'accueil légal + recueil du consentement à l'enregistrement (Phase 1/2).
- [x] Opt-out relances respecté (`Followup.optOut`) + consentement distinct
  transactionnel/marketing vérifié avant envoi ; fenêtre horaire autorisée (Phase 6).
- [x] Enregistrement des consentements patient (`POST /patients/:id/consents`, Phase 6).

## Rétention & purge

- [x] Durées configurables (`DATA_RETENTION_DAYS`, `AUDIT_LOG_RETENTION_DAYS`).
- [x] **Purge automatique** : `RetentionService` (appels/transcriptions, relances,
  tâches, créneaux passés, audit expiré) ; job BullMQ répétable
  (`RETENTION_QUEUE_ENABLED`) + déclenchement manuel admin (Phase 7).

## Logs & secrets

- [x] Logs applicatifs sans donnée de santé en clair (logger restreint, audit caviardé).
- [x] Secrets via variables d'environnement / coffre, **jamais** en dur.
- [x] `.env` exclu du dépôt (`.gitignore`) ; seul `.env.example` (sans secret) est versionné.
- [x] Principe du **moindre privilège** : matrice RBAC par rôle (secrétaire/responsable/admin).
- [x] **Filtre d'erreurs global** : aucune fuite de détail interne / donnée patient
  dans les réponses d'erreur (message générique hors HttpException maîtrisée).
- [x] **Limitation de débit** (throttler) globale + stricte sur le login (anti brute-force).

## Test automatisé « zéro donnée de santé »

- [x] `AuditService.sanitize` couvert par test (caviardage des clés sensibles).
- [x] Filtre d'erreurs couvert par test (message générique, pas de fuite).
- [ ] Test transverse scannant logs/erreurs/télémétrie en continu (Phase 8).
