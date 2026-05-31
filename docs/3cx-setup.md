# Configuration 3CX — débordement vers l'agent IA

> ⚠️ **Prérequis bloquant (§2.2).** L'intégration d'un agent vocal externe via
> **trunk SIP personnalisé** n'est **pas** supportée sur le **cloud 3CX hébergé**.
> Il faut une instance 3CX **self-hosted** ou **private-cloud**. Ce document
> suppose cette configuration.

## Parcours d'appel cible

```
Appel entrant
   └─▶ File des secrétaires (ring group)
         └─(pas de réponse après 20–30 s OU hors horaires)─▶ Extension AGENT IA
                                                                  └─(incertitude /
                                                                     demande patient /
                                                                     cas sensible)─▶ SIP REFER ─▶ secrétaire / file
```

## 1. Trunk SIP entre 3CX et la voice-gateway

- Créer un **trunk SIP générique** pointant vers la passerelle de l'agent
  (`SIP_TRUNK_HOST`), authentification par identifiants (`SIP_USERNAME` /
  `SIP_PASSWORD`), codecs **G.711 (a/u-law)** et **Opus**.
- L'agent IA est vu comme une **extension** (`AGENT_EXTENSION`).
- Activer **TLS/SRTP** (et mTLS si possible) — flux vocaux sensibles.

## 2. File des secrétaires + renvoi sur non-réponse

- Créer une **Queue** (ou Ring Group) regroupant les postes des secrétaires.
- Stratégie de sonnerie + **timeout** (paramétrable, ex. 20–30 s).
- **Destination en cas de non-réponse / file vide / hors horaires** → extension
  `AGENT_EXTENSION`.
- Définir les **horaires d'ouverture** par bureau (Office Hours) ; hors horaires,
  router directement vers l'agent.

## 3. Distinction des sites (Cergy vs Goussainville)

- Utiliser le **DID** / numéro appelé pour router et étiqueter l'appel
  (le `site` est déduit du DID côté voice-gateway puis enregistré sur le `call`).

## 4. Transfert retour vers un humain (SIP REFER)

- L'agent déclenche un **SIP REFER** vers `TRANSFER_TARGET_EXTENSION` (secrétaire
  ou file) en cas d'incertitude, de demande explicite du patient, ou de cas
  sensible / urgence.
- Vérifier que le trunk autorise le REFER (transfert supervisé/aveugle).

## 5. Appels sortants (relances vocales)

- Réutiliser le trunk (ou un trunk dédié sortant) pour les **relances vocales**
  et le **click-to-call** depuis le back-office.

## Variables d'environnement associées

```
SIP_TRUNK_HOST, SIP_USERNAME, SIP_PASSWORD
AGENT_EXTENSION, TRANSFER_TARGET_EXTENSION
RECORDING_ENABLED   # enregistrement conditionné au consentement (message légal)
```

> Implémentation effective de l'enregistrement SIP, du REFER et du routage : **Phase 2**.
