# Configuration 3CX — débordement vers l'agent IA (instance `alpha-imagerie.on3cx.fr`)

> Ce document est **taillé pour l'instance réelle** relevée dans l'admin 3CX
> (v20, **3CX-hosted** infogéré DSTNY, un seul site **CERGY**).

## 1. Réalité de l'instance & choix d'intégration

- **Hébergement 3CX-hosted** (`.on3cx.fr`). Y ajouter un *trunk SIP générique* vers
  une passerelle externe est **possible dans l'UI** mais **fragile** (SBC/anti-fraude/
  NAT gérés par 3CX). On retient donc la **voie 1, plus robuste** :
  **l'agent IA est une extension SIP enregistrée** (comme un softphone distant),
  vers laquelle les files renvoient sur non-réponse.
- **Rôle Owner/Admin requis.** Le compte Manager (ext. 600) ne peut configurer ni
  trunk, ni SBC, ni règles entrantes. Les étapes ci-dessous supposent l'accès Owner.
- **Un seul site dans 3CX : CERGY.** Goussainville est géré **logiquement** par
  l'agent (connaissance / agenda / RDV) ; aucun routage 3CX pour ce site tant qu'un
  DID Goussainville n'est pas ajouté (voir `DID_SITE_MAP`).

## 2. Topologie existante (relevée)

```
DSTNY (trunk PSTN)  ──▶  SVI 710 "1.SVI ACCUEIL CERGY"
                           ├─ Touche 1 ─▶ File 721 "01.RDV"        (sonn. 10s, attente max 60s ─▶ ext. 0187430171)
                           ├─ Touche 2 ─▶ File 713 "02.AUTRES"      (attente max 120s)
                           └─ Touche 3 ─▶ File 714 "03.PROFESSIONNEL"
Hors horaires ─▶ File 722 "01.RDV HORS HORAIRES" / SVI 730 "FIN APPEL"
Renvoi non-réponse extension : 30 s   ·   Cible transfert principal : 728 GROUPEMENT
```

- File **721 (RDV)** déborde **déjà** vers un **numéro externe** après 60 s — c'est
  le mécanisme de débordement qu'on réutilise.
- **Horaires (Europe/Paris)** : Lun–Ven 08:00–19:00 (Jeu jusqu'à 21:45), Sam
  08:00–18:30, Dim 08:30–18:30. (Déjà gérés par 3CX ; l'agent applique aussi ses
  propres fenêtres pour les relances.)

## 3. Intégration voie 1 — l'agent comme extension SIP

1. **Créer une extension** dédiée (ex. `190 AGENT IA`), rôle utilisateur standard,
   avec identifiant d'authentification SIP + mot de passe (→ coffre, pas le repo).
2. **Enregistrer la passerelle LiveKit SIP** sur `alpha-imagerie.on3cx.fr` en
   **TLS (5061)** avec ces identifiants (extension distante). Codecs **G.711
   (PCMU/PCMA)** + **Opus** ; DTMF **RFC2833**.
3. **Router le débordement vers l'agent** : sur les files **721 (RDV)** et
   **713 (AUTRES)**, régler la **destination de non-réponse / attente max** vers
   l'extension `190 AGENT IA` (en complément ou remplacement du renvoi externe
   actuel `0187430171`). Hors horaires : router **722** vers l'agent.
4. **Transfert retour (SIP REFER)** : l'agent transfère vers la **file 721**
   (`TRANSFER_TARGET_EXTENSION=721`) quand un humain est requis (incertitude,
   demande patient, cas sensible/urgence).

> Alternative (voie 2) si DSTNY ne permet pas l'enregistrement depuis l'IP de la
> passerelle : faire pointer le débordement vers un **DID EEE** qui termine
> directement sur LiveKit SIP (comme l'actuel `0187430171`).

## 4. Côté passerelle (LiveKit SIP)

- Serveur **LiveKit + LiveKit SIP** hébergé **EEE/HDS**.
- **Inbound trunk** + **dispatch rule** routant l'appel SIP vers une room où le
  worker `python -m src.livekit_agent start` rejoint (cf. `apps/voice-gateway/`).
- Le worker lit le **DID appelé** (`sip.trunkPhoneNumber`) → `resolve_site()` →
  site ; journalise l'appel + la transcription via core-api ; transfère par REFER.
- Plugins **STT/LLM/TTS EEE / auto-hébergés** (Whisper, Mistral EU, Piper/XTTS).
- Dépendances : `pip install -r requirements-livekit.txt`.

## 5. Variables d'environnement

```
SIP_DOMAIN=alpha-imagerie.on3cx.fr
AGENT_EXTENSION=190
SIP_USERNAME=…            # auth ID de l'extension agent (coffre)
SIP_PASSWORD=…            # mot de passe SIP (coffre)
TRANSFER_TARGET_EXTENSION=721      # file RDV (repli : 713)
DID_SITE_MAP={"0187430171":"cergy"}   # ajouter un DID Goussainville le moment venu

LIVEKIT_URL=wss://…           # serveur LiveKit (EEE/HDS)
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
RECORDING_ENABLED=false       # enregistrement conditionné au consentement (message légal)
```

## 6. À obtenir / décider (côté exploitant)

- [ ] **Accès Owner/Admin** 3CX (création extension, routage, lecture transport/DTMF/DID).
- [ ] Confirmer avec **DSTNY** l'enregistrement d'une extension depuis l'IP de la
      passerelle (voie 1) **ou** la fourniture d'un **DID** dédié (voie 2).
- [ ] **Transport/DTMF** exacts du trunk (réservés au rôle Owner).
- [ ] Passerelle **LiveKit SIP** déployée (EEE/HDS) + certificat TLS.
- [ ] Message d'accueil **légal** (consentement enregistrement) avant mise en service.
