# voice-gateway (Python)

Passerelle media temps reel (SIP/RTP) de l'agent vocal IA.

- **Phase 0 (actuelle) :** squelette uniquement. Un petit serveur de sante permet
  de valider l'orchestration Docker. Aucune logique voix.
- **Phase 1 :** LiveKit Agents (ou Pipecat) — boucle VAD -> STT (FR) -> LLM -> TTS,
  barge-in, journalisation de l'appel + transcription via core-api.
- **Phase 2 :** enregistrement comme extension/trunk 3CX, REFER de transfert.

## Pourquoi Python ici (et TypeScript ailleurs)

LiveKit Agents / Pipecat et l'ecosysteme STT (faster-whisper) sont matures en
Python. Ce service est isole et communique avec `core-api` en HTTP/REST. Le reste
du produit (CRUD, audit, agenda, relances, back-office) reste en TypeScript.

## Lancer en local (Phase 0)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main
```
