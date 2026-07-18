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

    # Modèles IA locaux (gratuits, auto-hébergés) : faster-whisper + Piper.
    whisper_model: str
    piper_voice: str
    models_dir: str

    # Telephonie / LiveKit SIP (Phase 2). Voir docs/3cx-setup.md.
    livekit_url: str | None
    livekit_api_key: str | None
    livekit_api_secret: str | None
    sip_domain: str | None          # ex. alpha-imagerie.on3cx.fr
    agent_extension: str | None     # extension de l'agent enregistree dans 3CX
    transfer_target: str            # file/extension cible du REFER (defaut 721 = RDV)
    # Mapping DID (numero appele) -> site. JSON: {"+33...": "cergy"}.
    did_site_map: str | None

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
        whisper_model=os.environ.get("WHISPER_MODEL", "small"),
        piper_voice=os.environ.get("PIPER_VOICE", "fr_FR-siwis-medium"),
        models_dir=os.environ.get("MODELS_DIR", os.path.expanduser("~/.cache/alpha-voice-models")),
        livekit_url=os.environ.get("LIVEKIT_URL") or None,
        livekit_api_key=os.environ.get("LIVEKIT_API_KEY") or None,
        livekit_api_secret=os.environ.get("LIVEKIT_API_SECRET") or None,
        sip_domain=os.environ.get("SIP_DOMAIN") or None,
        agent_extension=os.environ.get("AGENT_EXTENSION") or None,
        # 721 = file "01.RDV" (cf. relevé 3CX) ; 713 "AUTRES DEMANDES" en repli.
        transfer_target=os.environ.get("TRANSFER_TARGET_EXTENSION", "721"),
        did_site_map=os.environ.get("DID_SITE_MAP") or None,
        port=int(os.environ.get("VOICE_GATEWAY_PORT", "8080")),
    )

