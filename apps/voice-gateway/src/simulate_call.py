"""Simulation d'un appel de bout en bout (sans telephonie).

Joue une conversation scriptee a travers VoiceAgent et journalise l'appel +
la transcription dans core-api. Sert de critere d'acceptation Phase 1 :
"un appel test produit un `call` + un `transcript`".

Usage :
    CORE_API_URL=http://localhost:4000 SERVICE_API_KEY=... \
      python -m src.simulate_call

Les "audios" patient sont du texte encode en UTF-8 (MockSTT les decode).
"""
from __future__ import annotations

import asyncio
import sys

from .config import load_config
from .core_client import CoreApiClient
from .providers.factory import build_llm, build_stt, build_tts
from .agent.pipeline import VoiceAgent

# Conversation patient scriptee (cas nominal : prise de RDV IRM).
SCRIPT_NOMINAL = [
    "Bonjour, je voudrais prendre un rendez-vous pour une IRM.",
    "A Cergy si possible.",
    "Faut-il etre a jeun pour cet examen ?",
    "Tres bien, merci.",
]


async def run(script: list[str], *, site: str | None = "cergy") -> str:
    cfg = load_config()
    agent = VoiceAgent(
        stt=build_stt(cfg),
        llm=build_llm(cfg),
        tts=build_tts(cfg),
        core=CoreApiClient(cfg.core_api_url, cfg.service_api_key),
        site=site,
        caller_number="0612345678",
    )
    call_id = await agent.start()
    ts = 0.0
    for utterance in script:
        reply_audio = await agent.handle_user_audio(utterance.encode("utf-8"), ts=ts)
        print(f"[patient] {utterance}")
        print(f"[agent  ] {reply_audio.decode('utf-8')}\n")
        ts += 4.0
    await agent.end()
    print(f"Appel journalise : call_id={call_id}")
    return call_id


if __name__ == "__main__":
    cid = asyncio.run(run(SCRIPT_NOMINAL))
    sys.exit(0 if cid else 1)
