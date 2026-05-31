# Déploiement (cibles HDS)

Cibles : **OVHcloud HDS**, **Scaleway HDS** (ou Outscale). Datacenters EEE,
certification HDS v2.

## Principes

- Mêmes images Docker qu'en local (`docker-compose.yml`), déployées sur infra HDS.
- Secrets injectés par le **coffre** du fournisseur (jamais dans l'image ni le repo).
- TLS terminé par un reverse-proxy/ingress géré ; mTLS pour le trunk SIP si possible.
- Volumes DB et stockage des enregistrements **chiffrés au repos** (option HDS).
- Sauvegardes chiffrées, rétention conforme à la politique du DPO.

## Variables sensibles (extrait)

Fournies par le coffre, pas par `.env` en production :

```
ENCRYPTION_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
POSTGRES_PASSWORD, DATABASE_URL, REDIS_URL
SIP_PASSWORD, LLM_API_KEY, WHATSAPP_BSP_TOKEN, SMS_GATEWAY_KEY
DOCTOLIB_PARTNER_SECRET
```

## À compléter (Phase 7)

- [ ] Manifeste Compose/Helm spécifique HDS (réseaux, secrets, TLS).
- [ ] Politique de sauvegarde/restauration testée.
- [ ] Procédure de rotation des clés.
