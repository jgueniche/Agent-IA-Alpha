"""Fabrique de providers IA selon la configuration (interchangeables)."""
from __future__ import annotations

from ..config import Config
from .base import LlmProvider, SttProvider, TtsProvider
from .http_providers import HttpLlm, HttpStt, HttpTts
from .mock import MockLlm, MockStt, MockTts


def build_stt(cfg: Config) -> SttProvider:
    if cfg.stt_provider == "mock" or not cfg.stt_endpoint:
        return MockStt()
    # faster-whisper / whisper auto-heberge derriere un endpoint HTTP.
    return HttpStt(cfg.stt_endpoint)


def build_llm(cfg: Config) -> LlmProvider:
    if cfg.llm_provider == "mock" or not cfg.llm_endpoint:
        return MockLlm()
    return HttpLlm(cfg.llm_endpoint, cfg.llm_api_key)


def build_tts(cfg: Config) -> TtsProvider:
    if cfg.tts_provider == "mock" or not cfg.tts_endpoint:
        return MockTts()
    return HttpTts(cfg.tts_endpoint)
