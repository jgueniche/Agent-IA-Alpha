"""Boucle de l'agent vocal : STT -> (garde-fous) -> LLM -> TTS.

Accumule la transcription et la journalise dans core-api a la fin de l'appel.
La pile temps reel (VAD, barge-in, SIP) est branchee par-dessus cette logique
dans `livekit_agent.py` ; ici on traite des "tours de parole" deja segmentes,
ce qui rend la boucle metier testable sans telephonie.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from ..core_client import CoreApiClient
from ..knowledge import KnowledgeRetriever
from ..providers.base import LlmMessage, LlmProvider, SttProvider, TtsProvider
from . import guardrails, intents


@dataclass
class VoiceAgent:
    stt: SttProvider
    llm: LlmProvider
    tts: TtsProvider
    core: CoreApiClient
    retriever: KnowledgeRetriever | None = None
    site: str | None = None
    caller_number: str | None = None
    transfer_target: str | None = None

    call_id: str | None = None
    _segments: list[dict] = field(default_factory=list)
    _history: list[LlmMessage] = field(default_factory=list)
    _urgency: str = guardrails.URGENCY_NONE
    _transfer_requested: bool = False
    _start_ts: float = 0.0
    _last_modality: str | None = None

    async def start(self) -> str:
        """Demarre l'appel cote core-api. Retourne l'identifiant d'appel."""
        self._start_ts = time.monotonic()
        self.call_id = await self.core.create_call(
            site=self.site,
            caller_number=self.caller_number,
            direction="inbound",
        )
        return self.call_id

    async def handle_user_audio(self, audio: bytes, ts: float | None = None) -> bytes:
        """Traite un tour de parole patient et renvoie l'audio de la reponse."""
        offset = ts if ts is not None else (time.monotonic() - self._start_ts)
        text = await self.stt.transcribe(audio, language="fr")
        self._segments.append({"speaker": "patient", "ts": round(offset, 2), "text": text})

        reply = await self._decide_reply(text)

        self._segments.append(
            {"speaker": "agent", "ts": round(offset, 2), "text": reply}
        )
        self._history.append(LlmMessage(role="user", content=text))
        self._history.append(LlmMessage(role="assistant", content=reply))
        return await self.tts.synthesize(reply, voice="fr_FR-female")

    async def _decide_reply(self, text: str) -> str:
        """Applique les garde-fous avant de solliciter le LLM."""
        # Mémorise la dernière modalité évoquée (contexte conversationnel).
        modality = intents.detect_modality(text)
        if modality:
            self._last_modality = modality

        urgency = guardrails.detect_urgency(text)
        self._urgency = guardrails.max_urgency(self._urgency, urgency)

        if urgency == guardrails.URGENCY_CRITICAL:
            self._transfer_requested = True
            return guardrails.URGENCY_REPLY

        if guardrails.is_results_request(text):
            self._transfer_requested = True
            return guardrails.RESULTS_REPLY

        # RAG : si la demande relève d'une info de connaissance (préparation,
        # contre-indication, documents, horaires, accès), on répond à partir de
        # la base validée plutôt que de laisser le LLM improviser.
        grounded = await self._lookup_knowledge(text)
        if grounded is not None:
            return grounded

        return await self.llm.complete(
            system=guardrails.SYSTEM_PROMPT_FR, messages=self._history + [LlmMessage("user", text)]
        )

    async def _lookup_knowledge(self, text: str) -> str | None:
        """Outil lookup_exam_prep : interroge la base de connaissance (retrieval)."""
        if self.retriever is None:
            return None
        ktype = intents.detect_knowledge_type(text)
        # On ne déclenche le RAG que pour une vraie question d'information ;
        # une demande de RDV (sans type de connaissance) reste gérée par le LLM.
        if ktype is None:
            return None
        modality = intents.detect_modality(text) or self._last_modality
        site = intents.detect_site(text) or self.site
        results = await self.retriever.search(
            text, modality=modality, type=ktype, site=site, limit=1
        )
        if not results:
            return None
        return results[0]["content"]

    def request_transfer(self) -> None:
        """Marque l'appel pour transfert humain (incertitude / demande patient)."""
        self._transfer_requested = True

    async def end(self) -> None:
        """Journalise transcription + cloture l'appel dans core-api."""
        if not self.call_id:
            return
        duration = int(time.monotonic() - self._start_ts)
        intent = self._qualify_intent()
        summary = self._build_summary()

        await self.core.upsert_transcript(
            self.call_id,
            segments=self._segments,
            summary=summary,
            intent=intent,
            urgency=self._urgency,
        )

        if self._transfer_requested:
            outcome = "transferred_to_human"
            agent_resolved = False
        else:
            outcome = "resolved_by_agent"
            agent_resolved = True

        await self.core.end_call(
            self.call_id,
            outcome=outcome,
            duration_seconds=duration,
            agent_resolved=agent_resolved,
            transferred_to=self.transfer_target if self._transfer_requested else None,
        )

    # --- qualification simple (sera affinee en Phase 3 avec le LLM/RAG) ------

    def _qualify_intent(self) -> str:
        joined = " ".join(
            s["text"].lower() for s in self._segments if s["speaker"] == "patient"
        )
        if any(w in joined for w in ("rendez-vous", "rdv", "creneau")):
            return "prise_rdv"
        if any(w in joined for w in ("prepa", "jeun", "preparer")):
            return "preparation_examen"
        if any(w in joined for w in ("horaire", "ouvert", "ferme")):
            return "horaires"
        if any(w in joined for w in ("acces", "parking", "adresse")):
            return "acces"
        if guardrails.is_results_request(joined):
            return "demande_resultats"
        return "autre"

    def _build_summary(self) -> str:
        first = next(
            (s["text"] for s in self._segments if s["speaker"] == "patient"), ""
        )
        return f"Demande initiale du patient : {first}"[:500]
