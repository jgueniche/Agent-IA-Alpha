"""Providers IA auto-hébergés, gratuits et hors-cloud (souveraineté EEE).

 - LocalWhisperStt : faster-whisper (CPU, int8) — transcription FR locale.
 - LocalPiperTts   : Piper — synthèse vocale FR locale.

Les modèles sont téléchargés au premier usage dans MODELS_DIR (volume Docker)
puis réutilisés. Le chargement est paresseux et exécuté hors de la boucle
asyncio (thread executor) pour ne pas bloquer les autres appels.
"""
from __future__ import annotations

import asyncio
import io
import os
import urllib.request
import wave

from .base import SttProvider, TtsProvider

_PIPER_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def _wav_to_float32_16k(data: bytes):
    """Décode un WAV PCM16 mono et rééchantillonne en 16 kHz (numpy)."""
    import numpy as np

    with wave.open(io.BytesIO(data), "rb") as w:
        rate = w.getframerate()
        channels = w.getnchannels()
        frames = w.readframes(w.getnframes())
    audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    if rate != 16000 and len(audio) > 0:
        target_len = int(len(audio) * 16000 / rate)
        audio = np.interp(
            np.linspace(0, len(audio) - 1, target_len),
            np.arange(len(audio)),
            audio,
        ).astype(np.float32)
    return audio


class LocalWhisperStt(SttProvider):
    """faster-whisper en local (CPU int8). Modèle : WHISPER_MODEL (déf. small)."""

    def __init__(self, model_name: str, models_dir: str) -> None:
        self._model_name = model_name
        self._models_dir = models_dir
        self._model = None
        self._lock = asyncio.Lock()

    def _load(self):
        from faster_whisper import WhisperModel

        os.makedirs(self._models_dir, exist_ok=True)
        return WhisperModel(
            self._model_name,
            device="cpu",
            compute_type="int8",
            download_root=os.path.join(self._models_dir, "whisper"),
        )

    async def ensure_ready(self) -> None:
        async with self._lock:
            if self._model is None:
                loop = asyncio.get_running_loop()
                self._model = await loop.run_in_executor(None, self._load)

    async def transcribe(self, audio: bytes, *, language: str = "fr") -> str:
        await self.ensure_ready()
        audio_f32 = _wav_to_float32_16k(audio)
        if len(audio_f32) < 1600:  # < 0,1 s : rien d'exploitable
            return ""

        def _run() -> str:
            segments, _info = self._model.transcribe(
                audio_f32, language=language, beam_size=1, vad_filter=True
            )
            return " ".join(s.text.strip() for s in segments).strip()

        loop = asyncio.get_running_loop()
        async with self._lock:
            return await loop.run_in_executor(None, _run)


class LocalPiperTts(TtsProvider):
    """Piper en local. Voix : PIPER_VOICE (déf. fr_FR-siwis-medium)."""

    def __init__(self, voice_name: str, models_dir: str) -> None:
        self._voice_name = voice_name
        self._models_dir = models_dir
        self._voice = None
        self._lock = asyncio.Lock()

    def _voice_paths(self) -> tuple[str, str]:
        d = os.path.join(self._models_dir, "piper")
        os.makedirs(d, exist_ok=True)
        onnx = os.path.join(d, f"{self._voice_name}.onnx")
        return onnx, onnx + ".json"

    def _download(self) -> None:
        # fr_FR-siwis-medium -> fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
        locale, name, quality = self._voice_name.split("-", 2)
        lang = locale.split("_")[0]
        base = f"{_PIPER_BASE_URL}/{lang}/{locale}/{name}/{quality}"
        onnx, meta = self._voice_paths()
        for url, dest in (
            (f"{base}/{self._voice_name}.onnx", onnx),
            (f"{base}/{self._voice_name}.onnx.json", meta),
        ):
            if not os.path.exists(dest):
                tmp = dest + ".part"
                urllib.request.urlretrieve(url, tmp)
                os.replace(tmp, dest)

    def _load(self):
        from piper import PiperVoice

        self._download()
        onnx, _ = self._voice_paths()
        return PiperVoice.load(onnx)

    async def ensure_ready(self) -> None:
        async with self._lock:
            if self._voice is None:
                loop = asyncio.get_running_loop()
                self._voice = await loop.run_in_executor(None, self._load)

    async def synthesize(self, text: str, *, voice: str) -> bytes:
        await self.ensure_ready()

        def _run() -> bytes:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                self._voice.synthesize_wav(text, w)
            return buf.getvalue()

        loop = asyncio.get_running_loop()
        async with self._lock:
            return await loop.run_in_executor(None, _run)
