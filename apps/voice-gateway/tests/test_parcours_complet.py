"""Phase 8 — scénario E2E du parcours d'appel complet (sans téléphonie) :
réponse de l'agent (connaissance) → tentative de RDV → débordement / transfert,
journalisation de l'appel + latence perçue."""
import pytest

from src.agent.pipeline import VoiceAgent
from src.knowledge import InMemoryKnowledgeRetriever
from src.providers.mock import MockLlm, MockStt, MockTts
from tests.knowledge_fixture import KNOWLEDGE_FIXTURE


class FakeCalendar:
    def __init__(self, slots):
        self._slots = slots
        self.booked = None

    async def get_availabilities(self, site, modality, *, limit=3):
        return self._slots

    async def request_booking(self, site, modality, **k):
        self.booked = {"site": site, "modality": modality}
        return "task-1"


class FakeCore:
    def __init__(self):
        self.ended = None

    async def create_call(self, **k):
        return "call-1"

    async def upsert_transcript(self, *a, **k):
        self.transcript = k

    async def end_call(self, call_id, **k):
        self.ended = k


SLOTS = [{"site": "cergy", "modality": "irm", "startAt": "2026-06-05T09:00:00.000Z", "endAt": "x"}]


@pytest.mark.asyncio
async def test_parcours_complet_reponse_rdv_puis_transfert():
    core = FakeCore()
    cal = FakeCalendar(SLOTS)
    agent = VoiceAgent(
        stt=MockStt(), llm=MockLlm(), tts=MockTts(), core=core,
        retriever=InMemoryKnowledgeRetriever(KNOWLEDGE_FIXTURE),
        calendar=cal, site="cergy", transfer_target="200",
    )
    await agent.start()

    # 1) Réponse depuis la base de connaissance (préparation IRM).
    r1 = (await agent.handle_user_audio("Faut-il etre a jeun pour une IRM ?".encode())).decode()
    assert "jeun" in r1.lower()

    # 2) Demande de RDV -> proposition de créneaux (lecture agenda).
    r2 = (await agent.handle_user_audio("Je veux un rendez-vous".encode())).decode()
    assert "creneaux" in r2.lower()

    # 3) Débordement : cas sensible (demande de résultats) -> transfert humain.
    r3 = (await agent.handle_user_audio("Au fait, donnez-moi mes resultats".encode())).decode()
    assert "secretaire" in r3.lower()

    await agent.end()

    # L'appel est clôturé en transfert, avec latence perçue rapportée.
    assert core.ended["outcome"] == "transferred_to_human"
    assert core.ended["transferred_to"] == "200"
    assert core.ended["agent_latency_ms"] is not None
    # Mocks instantanés : latence très faible (la cible produit est < 800 ms).
    assert core.ended["agent_latency_ms"] < 800


@pytest.mark.asyncio
async def test_latence_moyenne_calculee():
    core = FakeCore()
    agent = VoiceAgent(stt=MockStt(), llm=MockLlm(), tts=MockTts(), core=core, site="cergy")
    await agent.start()
    assert agent.avg_latency_ms() is None
    await agent.handle_user_audio("Bonjour".encode())
    assert isinstance(agent.avg_latency_ms(), int)
