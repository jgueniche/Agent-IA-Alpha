"""Fabrique de providers IA selon la configuration (interchangeables).

Résolution, par brique :
 1. un endpoint HTTP est renseigné  -> provider HTTP (service dédié) ;
 2. provider local connu            -> modèle auto-hébergé gratuit
    (STT "faster-whisper" -> faster-whisper local, TTS "piper" -> Piper local) ;
 3. sinon                           -> mock hors-ligne (tests / simulation).
"""
from __future__ import annotations

from ..config import Config
from .base import LlmProvider, SttProvider, TtsProvider
from .http_providers import HttpLlm, HttpStt, HttpTts
from .mock import MockLlm, MockStt, MockTts

# Les providers locaux chargent des modèles lourds : instances partagées
# entre tous les appels (mémoïsées par configuration).
_local_cache: dict[tuple, object] = {}


def build_stt(cfg: Config) -> SttProvider:
    if cfg.stt_provider == "mock":
        return MockStt()
    if cfg.stt_endpoint:
        # faster-whisper / whisper auto-heberge derriere un endpoint HTTP.
        return HttpStt(cfg.stt_endpoint)
    if cfg.stt_provider in ("faster-whisper", "whisper", "local"):
        from .local_ai import LocalWhisperStt

        key = ("stt", cfg.whisper_model, cfg.models_dir)
        if key not in _local_cache:
            _local_cache[key] = LocalWhisperStt(cfg.whisper_model, cfg.models_dir)
        return _local_cache[key]  # type: ignore[return-value]
    return MockStt()


def build_llm(cfg: Config) -> LlmProvider:
    if cfg.llm_provider == "mock" or not cfg.llm_endpoint:
        # Sans endpoint LLM (mode gratuit), la conversation ouverte est scriptée ;
        # les vraies réponses viennent des garde-fous, du RAG et de l'agenda.
        return MockLlm()
    return HttpLlm(cfg.llm_endpoint, cfg.llm_api_key)


def build_tts(cfg: Config) -> TtsProvider:
    if cfg.tts_provider == "mock":
        return MockTts()
    if cfg.tts_endpoint:
        return HttpTts(cfg.tts_endpoint)
    if cfg.tts_provider in ("piper", "local"):
        from .local_ai import LocalPiperTts

        key = ("tts", cfg.piper_voice, cfg.models_dir)
        if key not in _local_cache:
            _local_cache[key] = LocalPiperTts(cfg.piper_voice, cfg.models_dir)
        return _local_cache[key]  # type: ignore[return-value]
    return MockTts()
