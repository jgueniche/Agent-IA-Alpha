# voice-gateway (Python)

Passerelle media temps reel (SIP/RTP) de l'agent vocal IA.

- **Phase 1 (actuelle) :** boucle métier STT -> garde-fous -> LLM -> TTS dans
  `agent/pipeline.py`, providers interchangeables (`providers/`, mock + HTTP),
  journalisation appel + transcription via `core_client.py`, détection d'urgence
  et refus des résultats médicaux (`agent/guardrails.py`). Testée hors téléphonie
  (`tests/`, `simulate_call.py`).
- **Phase 2 :** brancher LiveKit Agents (`livekit_agent.py`) sur le trunk SIP 3CX —
  VAD, barge-in, REFER de transfert.

## Pourquoi Python ici (et TypeScript ailleurs)

LiveKit Agents / Pipecat et l'ecosysteme STT (faster-whisper) sont matures en
Python. Ce service est isole et communique avec `core-api` en HTTP/REST. Le reste
du produit (CRUD, audit, agenda, relances, back-office) reste en TypeScript.

## Lancer en local (Phase 1)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Tests (garde-fous + boucle agent, hors réseau)
python -m pytest

# Simuler un appel de bout en bout contre un core-api démarré
CORE_API_URL=http://localhost:4000 SERVICE_API_KEY=<clé> python -m src.simulate_call

# Serveur de santé (orchestration Docker)
python -m src.main
```
