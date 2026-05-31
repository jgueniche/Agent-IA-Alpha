"""Providers IA factices (hors-ligne) pour les tests et la simulation d'appel.

Deterministes, sans reseau. En simulation, l'audio "patient" est simplement du
texte encode en UTF-8 (MockSTT le decode), ce qui permet de tester toute la
boucle sans pile audio reelle.
"""
from __future__ import annotations

from .base import LlmMessage, LlmProvider, SttProvider, TtsProvider


class MockStt(SttProvider):
    async def transcribe(self, audio: bytes, *, language: str = "fr") -> str:
        return audio.decode("utf-8", errors="replace").strip()


class MockTts(TtsProvider):
    async def synthesize(self, text: str, *, voice: str) -> bytes:
        return text.encode("utf-8")


class MockLlm(LlmProvider):
    """Reponses canoniques FR, suffisantes pour valider la boucle et les outils.

    Ne fournit JAMAIS de resultat/diagnostic : renvoie vers l'humain en cas de
    demande de resultats.
    """

    async def complete(self, *, system: str, messages: list[LlmMessage]) -> str:
        last = messages[-1].content.lower() if messages else ""
        if any(w in last for w in ("resultat", "résultat", "compte rendu", "diagnostic")):
            return (
                "Je ne peux pas communiquer de resultats ou d'interpretation "
                "medicale. Je vous mets en relation avec une secretaire."
            )
        if any(w in last for w in ("rendez-vous", "rdv", "irm", "scanner", "echographie", "mammographie", "radio")):
            return (
                "Tres bien, je peux vous aider a organiser cela. Sur quel site "
                "preferez-vous : Cergy ou Goussainville ?"
            )
        if any(w in last for w in ("prepa", "préparer", "a jeun", "jeun", "preparation")):
            return (
                "Je vous indique la preparation a suivre pour cet examen. "
                "Souhaitez-vous aussi connaitre les documents a apporter ?"
            )
        return (
            "Bonjour, vous etes au centre Alpha Imagerie. Comment puis-je vous "
            "aider : prise de rendez-vous, preparation d'examen, horaires ou acces ?"
        )
