"""Tests de la boucle agent (sans reseau) : journalisation, garde-fous, transfert."""
import pytest

from src.agent import guardrails
from src.agent.pipeline import VoiceAgent
from src.providers.mock import MockLlm, MockStt, MockTts


class FakeCore:
    """Faux client core-api : capture les payloads au lieu de les envoyer."""

    def __init__(self):
        self.created = None
        self.transcript = None
        self.ended = None

    async def create_call(self, *, site, caller_number, direction="inbound"):
        self.created = {"site": site, "caller_number": caller_number, "direction": direction}
        return "call-test-1"

    async def upsert_transcript(self, call_id, *, segments, summary, intent, urgency):
        self.transcript = {
            "call_id": call_id,
            "segments": segments,
            "summary": summary,
            "intent": intent,
            "urgency": urgency,
        }

    async def end_call(self, call_id, *, outcome, duration_seconds, agent_resolved, transferred_to=None, ended_at=None):
        self.ended = {
            "call_id": call_id,
            "outcome": outcome,
            "agent_resolved": agent_resolved,
            "transferred_to": transferred_to,
        }


def make_agent(core):
    return VoiceAgent(
        stt=MockStt(),
        llm=MockLlm(),
        tts=MockTts(),
        core=core,
        site="cergy",
        caller_number="0612345678",
        transfer_target="200",
    )


@pytest.mark.asyncio
async def test_appel_nominal_produit_call_et_transcript():
    core = FakeCore()
    agent = make_agent(core)
    call_id = await agent.start()
    assert call_id == "call-test-1"

    for i, txt in enumerate(
        ["Bonjour je voudrais un rendez-vous pour une IRM", "A Cergy"]
    ):
        audio = await agent.handle_user_audio(txt.encode(), ts=float(i * 4))
        assert isinstance(audio, bytes) and len(audio) > 0

    await agent.end()

    # Un call + un transcript ont ete produits (critere d'acceptation Phase 1).
    assert core.created["site"] == "cergy"
    assert core.transcript is not None
    segs = core.transcript["segments"]
    # Alternance patient/agent.
    assert [s["speaker"] for s in segs] == ["patient", "agent", "patient", "agent"]
    assert core.transcript["intent"] == "prise_rdv"
    assert core.transcript["urgency"] == guardrails.URGENCY_NONE
    assert core.ended["outcome"] == "resolved_by_agent"
    assert core.ended["agent_resolved"] is True


@pytest.mark.asyncio
async def test_urgence_declenche_consigne_15_et_transfert():
    core = FakeCore()
    agent = make_agent(core)
    await agent.start()
    audio = await agent.handle_user_audio(
        "j'ai une grosse douleur thoracique".encode(), ts=0.0
    )
    # Reponse cadree (pas le LLM) + consigne 15.
    assert "15" in audio.decode()
    await agent.end()
    assert core.transcript["urgency"] == guardrails.URGENCY_CRITICAL
    assert core.ended["outcome"] == "transferred_to_human"
    assert core.ended["transferred_to"] == "200"


@pytest.mark.asyncio
async def test_demande_de_resultats_refusee_et_transferee():
    core = FakeCore()
    agent = make_agent(core)
    await agent.start()
    audio = await agent.handle_user_audio(
        "je veux mes résultats d'IRM".encode(), ts=0.0
    )
    reply = audio.decode()
    assert "secretaire" in reply.lower() or "secrétaire" in reply.lower()
    await agent.end()
    assert core.ended["outcome"] == "transferred_to_human"
