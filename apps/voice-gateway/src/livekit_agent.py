"""Worker LiveKit Agents — intégration média temps réel (SIP/RTP) avec 3CX.

Modèle retenu (voie 1, cf. docs/3cx-setup.md) : l'agent est une **extension SIP
enregistrée** dans 3CX. Sur non-réponse, les files 721 (RDV) / 713 (AUTRES)
renvoient vers cette extension ; LiveKit SIP reçoit l'appel, l'agent répond, et
peut **transférer (SIP REFER)** vers la file 721 quand un humain est requis.

La logique métier (garde-fous, détection d'urgence/intentions, accès core-api)
est RÉUTILISÉE depuis les modules déjà testés (`agent.guardrails`, `agent.intents`,
`core_client`, `calendar_client`, `knowledge`). Ce fichier ne fait que la
**liaison** avec la pile LiveKit.

Dépendances (non incluses dans l'image par défaut — lourdes) :
    pip install -r requirements-livekit.txt
Puis lancer le worker :
    python -m src.livekit_agent start

⚠️ À valider contre la version de `livekit-agents` installée (l'API évolue) :
les plugins STT/LLM/TTS doivent être choisis **EEE / auto-hébergés** (§2.3).
"""
from __future__ import annotations

import time

from .config import load_config
from .core_client import CoreApiClient
from .calendar_client import CalendarClient
from .knowledge import HttpKnowledgeRetriever
from .site_routing import resolve_site
from .agent import guardrails, intents

try:  # Imports lourds, optionnels (Phase 2).
    from livekit import agents, api
    from livekit.agents import (
        Agent,
        AgentSession,
        JobContext,
        RunContext,
        WorkerOptions,
        cli,
        function_tool,
    )

    LIVEKIT_AVAILABLE = True
except ImportError:  # pragma: no cover
    LIVEKIT_AVAILABLE = False


if LIVEKIT_AVAILABLE:

    class AlphaImagerieAgent(Agent):
        """Agent vocal Alpha Imagerie : garde-fous + outils (function calling)."""

        def __init__(self, *, site: str, call_state: dict) -> None:
            super().__init__(instructions=guardrails.SYSTEM_PROMPT_FR)
            self._site = site
            self._state = call_state
            cfg = load_config()
            self._calendar = CalendarClient(cfg.core_api_url, cfg.service_api_key)
            self._knowledge = HttpKnowledgeRetriever(cfg.core_api_url, cfg.service_api_key)

        # --- Garde-fous appliqués à chaque tour patient ----------------------
        async def on_user_turn_completed(self, turn_ctx, new_message) -> None:  # type: ignore[override]
            text = new_message.text_content or ""
            self._state["segments"].append({"speaker": "patient", "ts": _offset(self._state), "text": text})

            urgency = guardrails.detect_urgency(text)
            self._state["urgency"] = guardrails.max_urgency(self._state["urgency"], urgency)
            if urgency == guardrails.URGENCY_CRITICAL:
                self._state["transfer"] = True
                await self.session.say(guardrails.URGENCY_REPLY)
                await self._do_transfer("urgence_vitale")
                raise agents.StopResponse()  # ne pas laisser le LLM répondre
            if guardrails.is_results_request(text):
                self._state["transfer"] = True
                await self.session.say(guardrails.RESULTS_REPLY)
                await self._do_transfer("demande_resultats")
                raise agents.StopResponse()

            mod = intents.detect_modality(text)
            if mod:
                self._state["last_modality"] = mod

        # --- Outils (function calling) ---------------------------------------
        @function_tool()
        async def lookup_exam_prep(self, ctx: RunContext, question: str) -> str:
            """Donne la préparation / les consignes d'un examen depuis la base validée."""
            ktype = intents.detect_knowledge_type(question) or "prep"
            modality = intents.detect_modality(question) or self._state.get("last_modality")
            results = await self._knowledge.search(
                question, modality=modality, type=ktype, site=self._site, limit=1
            )
            return results[0]["content"] if results else (
                "Je n'ai pas cette information ; je peux vous passer une secrétaire."
            )

        @function_tool()
        async def get_availabilities(self, ctx: RunContext, modality: str) -> str:
            """Propose des créneaux disponibles (lecture agenda) pour une modalité."""
            slots = await self._calendar.get_availabilities(self._site, modality, limit=3)
            self._state["proposed"] = slots
            if not slots:
                return "Aucun créneau en ligne ; je crée une demande de rappel."
            return "; ".join(s.get("startAt", "") for s in slots)

        @function_tool()
        async def create_callback_task(self, ctx: RunContext, modality: str) -> str:
            """Déporte la prise de RDV vers une tâche de rappel (secrétaire)."""
            await self._calendar.request_booking(
                self._site, modality, call_id=self._state.get("call_id")
            )
            return "C'est noté, une secrétaire vous rappellera pour confirmer."

        @function_tool()
        async def transfer_to_human(self, ctx: RunContext, reason: str) -> str:
            """Transfère l'appel vers une secrétaire (SIP REFER vers la file RDV)."""
            self._state["transfer"] = True
            await self._do_transfer(reason)
            return "Je vous mets en relation avec une secrétaire."

        async def _do_transfer(self, reason: str) -> None:
            cfg = load_config()
            sip_id = self._state.get("sip_participant_identity")
            if not sip_id or not cfg.sip_domain:
                return
            await self._state["ctx"].api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    participant_identity=sip_id,
                    room_name=self._state["ctx"].room.name,
                    transfer_to=f"sip:{cfg.transfer_target}@{cfg.sip_domain}",
                    play_dialtone=True,
                )
            )

    async def entrypoint(ctx: JobContext) -> None:
        """Point d'entrée du worker : un job par appel entrant (room SIP)."""
        cfg = load_config()
        await ctx.connect()

        # Métadonnées SIP : numéro appelé (DID) -> site ; identité du participant.
        participant = await ctx.wait_for_participant()
        attrs = participant.attributes or {}
        called = attrs.get("sip.trunkPhoneNumber") or attrs.get("sip.calledNumber")
        caller = attrs.get("sip.phoneNumber")
        site = resolve_site(called, cfg.did_site_map)

        core = CoreApiClient(cfg.core_api_url, cfg.service_api_key)
        call_id = await core.create_call(site=site, caller_number=caller, direction="inbound")

        state: dict = {
            "ctx": ctx,
            "call_id": call_id,
            "site": site,
            "segments": [],
            "urgency": guardrails.URGENCY_NONE,
            "transfer": False,
            "last_modality": None,
            "proposed": [],
            "start_ts": time.monotonic(),
            "sip_participant_identity": participant.identity,
        }

        # STT / LLM / TTS : à instancier avec des plugins EEE / auto-hébergés.
        # (placeholders — voir requirements-livekit.txt et docs/3cx-setup.md)
        session = AgentSession()  # vad=..., stt=..., llm=..., tts=...

        async def _on_shutdown() -> None:
            duration = int(time.monotonic() - state["start_ts"])
            await core.upsert_transcript(
                call_id,
                segments=state["segments"],
                summary=_summary(state),
                intent=_qualify(state),
                urgency=state["urgency"],
            )
            transferred = state["transfer"]
            await core.end_call(
                call_id,
                outcome="transferred_to_human" if transferred else "resolved_by_agent",
                duration_seconds=duration,
                agent_resolved=not transferred,
                transferred_to=cfg.transfer_target if transferred else None,
            )

        ctx.add_shutdown_callback(_on_shutdown)

        await session.start(
            agent=AlphaImagerieAgent(site=site, call_state=state),
            room=ctx.room,
        )

    def run() -> None:
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="alpha-imagerie"))

else:  # pragma: no cover

    def run() -> None:
        raise SystemExit(
            "livekit-agents n'est pas installé. "
            "Installez-le : pip install -r requirements-livekit.txt (voir docs/3cx-setup.md)."
        )


# --- helpers transcript -----------------------------------------------------

def _offset(state: dict) -> float:
    return round(time.monotonic() - state.get("start_ts", time.monotonic()), 2)


def _summary(state: dict) -> str:
    first = next((s["text"] for s in state["segments"] if s["speaker"] == "patient"), "")
    return f"Demande initiale du patient : {first}"[:500]


def _qualify(state: dict) -> str:
    joined = " ".join(s["text"].lower() for s in state["segments"] if s["speaker"] == "patient")
    if intents.is_booking_query(joined):
        return "prise_rdv"
    if intents.detect_knowledge_type(joined):
        return intents.detect_knowledge_type(joined) or "autre"
    return "autre"


if __name__ == "__main__":
    run()
