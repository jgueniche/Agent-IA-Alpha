"""Contrats des briques IA (STT / LLM / TTS).

Interchangeables (cf. §4). Contrainte HDS (§2.3) : par defaut aucune donnee
vocale/transcription patient n'est envoyee hors EEE. Cibles : modeles
auto-heberges (faster-whisper, Piper/XTTS) ou heberges en EEE (Mistral).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LlmMessage:
    role: str  # "user" | "assistant"
    content: str


class SttProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio: bytes, *, language: str = "fr") -> str:
        """Transcrit un segment audio en texte FR."""


class LlmProvider(ABC):
    @abstractmethod
    async def complete(
        self, *, system: str, messages: list[LlmMessage]
    ) -> str:
        """Genere la reponse de l'agent a partir du contexte."""


class TtsProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, *, voice: str) -> bytes:
        """Synthetise un texte FR en audio."""
