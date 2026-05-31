"""Point d'entree LiveKit Agents — integration media temps reel (SIP/RTP).

C'est ici que se branche la pile imposee (LiveKit Agents) : reception de l'appel
SIP (via le trunk 3CX, Phase 2), VAD, barge-in, turn-taking, puis delegation de
la logique metier a `agent.pipeline.VoiceAgent`.

LiveKit Agents est volontairement PAS dans requirements.txt en Phase 1 (lourd,
necessite un serveur LiveKit + SIP). Pour activer le temps reel :

    pip install "livekit-agents[silero,openai]"  # adapter aux plugins EEE retenus

puis lancer ce worker. La boucle metier (STT->LLM->TTS, garde-fous,
journalisation) est deja testee hors telephonie via `simulate_call.py`.
"""
from __future__ import annotations

from .config import load_config
from .core_client import CoreApiClient
from .providers.factory import build_llm, build_stt, build_tts
from .agent.pipeline import VoiceAgent


def build_agent(site: str | None, caller_number: str | None) -> VoiceAgent:
    """Construit un VoiceAgent cable sur les providers configures."""
    cfg = load_config()
    return VoiceAgent(
        stt=build_stt(cfg),
        llm=build_llm(cfg),
        tts=build_tts(cfg),
        core=CoreApiClient(cfg.core_api_url, cfg.service_api_key),
        site=site,
        caller_number=caller_number,
    )


async def entrypoint(ctx) -> None:  # pragma: no cover - necessite le runtime LiveKit
    """Entree LiveKit : a cabler en Phase 2 avec le SIP 3CX.

    Schema cible :
      - lire le DID/numero appele -> deduire le site (Cergy/Goussainville)
      - VAD + STT streaming -> VoiceAgent.handle_user_audio(frame)
      - jouer l'audio TTS retourne, gerer le barge-in
      - sur incertitude/demande -> agent.request_transfer() puis SIP REFER
      - a la fin -> agent.end()
    """
    raise NotImplementedError(
        "Integration LiveKit/SIP a finaliser en Phase 2 (voir docs/3cx-setup.md)."
    )
