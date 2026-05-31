"""Providers IA via endpoints HTTP auto-heberges / EEE.

- STT : serveur faster-whisper / whisper.cpp (POST audio -> texte).
- LLM : endpoint compatible "chat completions" (Mistral EU auto-heberge p.ex.).
- TTS : serveur Piper / XTTS (POST texte -> audio).

Les schemas exacts dependent du deploiement : ces classes posent le contrat et
sont a ajuster au branchement reel (Phase 1/2). Aucun envoi hors EEE par defaut.
"""
from __future__ import annotations

import aiohttp

from .base import LlmMessage, LlmProvider, SttProvider, TtsProvider


class HttpStt(SttProvider):
    def __init__(self, endpoint: str) -> None:
        self._endpoint = endpoint

    async def transcribe(self, audio: bytes, *, language: str = "fr") -> str:
        async with aiohttp.ClientSession() as s:
            data = aiohttp.FormData()
            data.add_field("language", language)
            data.add_field("audio", audio, filename="audio.wav")
            async with s.post(self._endpoint, data=data) as r:
                r.raise_for_status()
                body = await r.json()
                return body.get("text", "")


class HttpLlm(LlmProvider):
    def __init__(self, endpoint: str, api_key: str | None) -> None:
        self._endpoint = endpoint
        self._api_key = api_key

    async def complete(self, *, system: str, messages: list[LlmMessage]) -> str:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        payload = {
            "messages": [
                {"role": "system", "content": system},
                *[{"role": m.role, "content": m.content} for m in messages],
            ],
            "temperature": 0.2,
        }
        async with aiohttp.ClientSession(headers=headers) as s:
            async with s.post(self._endpoint, json=payload) as r:
                r.raise_for_status()
                body = await r.json()
                return body["choices"][0]["message"]["content"]


class HttpTts(TtsProvider):
    def __init__(self, endpoint: str) -> None:
        self._endpoint = endpoint

    async def synthesize(self, text: str, *, voice: str) -> bytes:
        async with aiohttp.ClientSession() as s:
            async with s.post(
                self._endpoint, json={"text": text, "voice": voice}
            ) as r:
                r.raise_for_status()
                return await r.read()
