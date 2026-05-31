"""Critère d'acceptation Phase 3 : l'agent répond correctement à 10 scénarios
métier types, en s'appuyant sur la base de connaissance (RAG / retrieval)."""
import pytest

from src.agent.pipeline import VoiceAgent
from src.knowledge import InMemoryKnowledgeRetriever
from src.providers.mock import MockLlm, MockStt, MockTts
from tests.knowledge_fixture import KNOWLEDGE_FIXTURE


class FakeCore:
    async def create_call(self, *, site, caller_number, direction="inbound"):
        return "call-x"

    async def upsert_transcript(self, *a, **k):
        pass

    async def end_call(self, *a, **k):
        pass


def make_agent(site="cergy"):
    return VoiceAgent(
        stt=MockStt(),
        llm=MockLlm(),
        tts=MockTts(),
        core=FakeCore(),
        retriever=InMemoryKnowledgeRetriever(KNOWLEDGE_FIXTURE),
        site=site,
    )


# (question patient, fragment(s) attendu(s) dans la réponse de l'agent)
SCENARIOS = [
    ("Faut-il etre a jeun pour une IRM ?", ["jeun"]),
    ("Je peux passer une IRM avec un pacemaker ?", ["pacemaker"]),
    ("Comment preparer un scanner avec injection ?", ["jeun"]),
    ("Faut-il etre a jeun pour une echographie de l'abdomen ?", ["jeun", "6 heures"]),
    ("Pour une echographie pelvienne faut-il la vessie pleine ?", ["vessie"]),
    ("Comment me preparer pour une mammographie ?", ["cycle"]),
    ("Quels documents dois-je apporter ?", ["ordonnance"]),
    ("Quels sont les horaires du site de Cergy ?", ["Cergy", "8h00"]),
    ("Comment acceder au centre de Cergy, y a-t-il un parking ?", ["parking"]),
    ("Je suis enceinte, est-ce un probleme pour une radio ?", ["grossesse"]),
]


@pytest.mark.parametrize("question,expected", SCENARIOS)
@pytest.mark.asyncio
async def test_scenario_metier(question, expected):
    agent = make_agent()
    await agent.start()
    audio = await agent.handle_user_audio(question.encode(), ts=0.0)
    reply = audio.decode()
    for fragment in expected:
        assert fragment.lower() in reply.lower(), f"'{fragment}' absent de : {reply!r}"


@pytest.mark.asyncio
async def test_les_dix_scenarios_sont_couverts():
    assert len(SCENARIOS) >= 10
