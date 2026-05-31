"""Chargement de la configuration depuis l'environnement.

Aucun secret en dur. Les providers IA (STT/LLM/TTS) sont selectionnables par
variable d'environnement pour rester interchangeables (souverainete EEE).
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    # Liaison avec core-api (ingestion appels/transcriptions).
    core_api_url: str
    service_api_key: str

    # Selection des providers IA.
    stt_provider: str
    stt_endpoint: str | None
    llm_provider: str
    llm_endpoint: str | None
    llm_api_key: str | None
    tts_provider: str
    tts_endpoint: str | None
    tts_voice_fr: str

    port: int


def load_config() -> Config:
    return Config(
        core_api_url=os.environ.get("CORE_API_URL", "http://core-api:4000"),
        service_api_key=os.environ.get("SERVICE_API_KEY", ""),
        stt_provider=os.environ.get("STT_PROVIDER", "mock"),
        stt_endpoint=os.environ.get("STT_ENDPOINT") or None,
        llm_provider=os.environ.get("LLM_PROVIDER", "mock"),
        llm_endpoint=os.environ.get("LLM_ENDPOINT") or None,
        llm_api_key=os.environ.get("LLM_API_KEY") or None,
        tts_provider=os.environ.get("TTS_PROVIDER", "mock"),
        tts_endpoint=os.environ.get("TTS_ENDPOINT") or None,
        tts_voice_fr=os.environ.get("TTS_VOICE_FR", "fr_FR-female"),
        port=int(os.environ.get("VOICE_GATEWAY_PORT", "8080")),
    )
