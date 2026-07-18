"""Boucle de l'agent vocal : STT -> (garde-fous) -> LLM -> TTS.

Accumule la transcription et la journalise dans core-api a la fin de l'appel.
La pile temps reel (VAD, barge-in, SIP) est branchee par-dessus cette logique
dans `livekit_agent.py` ; ici on traite des "tours de parole" deja segmentes,
ce qui rend la boucle metier testable sans telephonie.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from ..calendar_client import CalendarClient
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
    calendar: CalendarClient | None = None
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
    _proposed_slots: list[dict] = field(default_factory=list)
    _booking_done: bool = False
    _latencies_ms: list[float] = field(default_factory=list)

    async def start(self) -> str:
        """Demarre l'appel cote core-api. Retourne l'identifiant d'appel."""
        self._start_ts = time.monotonic()
        self.call_id = await self.core.create_call(
            site=self.site,
            caller_number=self.caller_number,
            direction="inbound",
        )
        return self.call_id

    GREETING_FR = (
        "Centre d'imagerie Alpha, bonjour ! Je suis l'assistante vocale. "
        "Comment puis-je vous aider ?"
    )

    @property
    def transfer_requested(self) -> bool:
        """Vrai si l'appel doit etre transfere a un humain (urgence, resultats…)."""
        return self._transfer_requested

    @property
    def last_turn(self) -> tuple[str | None, str | None]:
        """Textes (patient, agent) du dernier tour de parole traite."""
        patient = next(
            (s["text"] for s in reversed(self._segments) if s["speaker"] == "patient"),
            None,
        )
        agent = next(
            (s["text"] for s in reversed(self._segments) if s["speaker"] == "agent"),
            None,
        )
        return patient, agent

    async def greet(self, text: str | None = None) -> bytes:
        """Message d'accueil de l'agent : journalise + synthetise."""
        greeting = text or self.GREETING_FR
        offset = time.monotonic() - self._start_ts if self._start_ts else 0.0
        self._segments.append(
            {"speaker": "agent", "ts": round(offset, 2), "text": greeting}
        )
        self._history.append(LlmMessage(role="assistant", content=greeting))
        return await self.tts.synthesize(greeting, voice="fr_FR-female")

    async def handle_user_audio(self, audio: bytes, ts: float | None = None) -> bytes:
        """Traite un tour de parole patient et renvoie l'audio de la reponse."""
        offset = ts if ts is not None else (time.monotonic() - self._start_ts)
        # Latence percue : du debut du traitement a la reponse synthetisee.
        turn_start = time.monotonic()
        text = await self.stt.transcribe(audio, language="fr")
        if not text.strip():
            # Rien d'exploitable (silence, bruit) : pas de tour a journaliser.
            return b""
        self._segments.append({"speaker": "patient", "ts": round(offset, 2), "text": text})

        reply = await self._decide_reply(text)

        self._segments.append(
            {"speaker": "agent", "ts": round(offset, 2), "text": reply}
        )
        self._history.append(LlmMessage(role="user", content=text))
        self._history.append(LlmMessage(role="assistant", content=reply))
        audio_out = await self.tts.synthesize(reply, voice="fr_FR-female")
        self._latencies_ms.append((time.monotonic() - turn_start) * 1000.0)
        return audio_out

    def avg_latency_ms(self) -> int | None:
        """Latence moyenne percue sur l'appel (ms), ou None si aucun tour."""
        if not self._latencies_ms:
            return None
        return round(sum(self._latencies_ms) / len(self._latencies_ms))

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

        # Agenda : proposer des disponibilités (lecture) ou déporter la prise de RDV.
        booking = await self._handle_booking(text)
        if booking is not None:
            return booking

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

    async def _handle_booking(self, text: str) -> str | None:
        """Outils get_availabilities / create_callback_task (prise de RDV)."""
        if self.calendar is None:
            return None

        # 1) Confirmation d'un créneau précédemment proposé -> déport en rappel.
        if self._proposed_slots and intents.is_confirmation(text):
            slot = self._proposed_slots[0]
            await self.calendar.request_booking(
                slot["site"],
                slot["modality"],
                desired_start_at=slot["startAt"],
                call_id=self.call_id,
            )
            self._proposed_slots = []
            self._booking_done = True
            return (
                "C'est note. Une secretaire confirmera votre rendez-vous. "
                "Puis-je faire autre chose pour vous ?"
            )

        # 2) Demande de RDV : lire les disponibilités synchronisées et proposer.
        if not intents.is_booking_query(text):
            return None
        modality = intents.detect_modality(text) or self._last_modality
        site = intents.detect_site(text) or self.site
        if not modality or not site:
            # Précisions manquantes : on laisse l'agent (LLM) demander site/modalité.
            return None

        slots = await self.calendar.get_availabilities(site, modality, limit=3)
        if slots:
            self._proposed_slots = slots
            return self._format_slots(slots, modality)

        # Aucun créneau en ligne -> déport direct vers une tâche de rappel.
        await self.calendar.request_booking(site, modality, call_id=self.call_id)
        self._booking_done = True
        return (
            "Je n'ai pas de creneau disponible en ligne pour le moment. Je transmets "
            "votre demande : une secretaire vous rappellera pour fixer le rendez-vous."
        )

    @staticmethod
    def _format_slots(slots: list[dict], modality: str) -> str:
        """Met en forme quelques créneaux proposés (lecture seule)."""
        labels = []
        for s in slots[:3]:
            iso = s.get("startAt", "")
            # ISO -> "le JJ/MM a HH:MM" (affichage simple)
            try:
                date, rest = iso.split("T")
                y, m, d = date.split("-")
                hh, mm = rest[:5].split(":")
                labels.append(f"le {d}/{m} a {hh}:{mm}")
            except ValueError:
                labels.append(iso)
        joined = ", ".join(labels)
        return (
            f"Voici des creneaux disponibles pour votre {modality} : {joined}. "
            "Lequel vous conviendrait ?"
        )

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
            agent_latency_ms=self.avg_latency_ms(),
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
