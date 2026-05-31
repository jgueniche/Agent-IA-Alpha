"""Phase 4 : l'agent propose des disponibilités (lues depuis la sync) puis
déporte la prise de RDV vers une tâche de rappel."""
import pytest

from src.agent.pipeline import VoiceAgent
from src.providers.mock import MockLlm, MockStt, MockTts


class FakeCore:
    async def create_call(self, **k):
        return "call-x"

    async def upsert_transcript(self, *a, **k):
        pass

    async def end_call(self, *a, **k):
        pass


class FakeCalendar:
    def __init__(self, slots):
        self._slots = slots
        self.booked = None

    async def get_availabilities(self, site, modality, *, limit=3):
        return self._slots

    async def request_booking(self, site, modality, *, desired_start_at=None, call_id=None, note=None):
        self.booked = {
            "site": site,
            "modality": modality,
            "desired": desired_start_at,
            "call_id": call_id,
        }
        return "task-9"


SLOTS = [
    {"site": "cergy", "modality": "irm", "startAt": "2026-06-05T09:00:00.000Z", "endAt": "2026-06-05T09:30:00.000Z"},
    {"site": "cergy", "modality": "irm", "startAt": "2026-06-06T14:00:00.000Z", "endAt": "2026-06-06T14:30:00.000Z"},
]


def make_agent(calendar):
    return VoiceAgent(
        stt=MockStt(), llm=MockLlm(), tts=MockTts(),
        core=FakeCore(), calendar=calendar, site="cergy",
    )


@pytest.mark.asyncio
async def test_propose_des_disponibilites_puis_deporte_le_rdv():
    cal = FakeCalendar(SLOTS)
    agent = make_agent(cal)
    await agent.start()

    # 1) Demande de RDV -> l'agent propose des créneaux lus depuis la sync.
    r1 = (await agent.handle_user_audio("Je voudrais un rendez-vous pour une IRM".encode(), ts=0.0)).decode()
    assert "creneaux" in r1.lower()
    assert "05/06 a 09:00" in r1

    # 2) Le patient confirme -> déport vers une tâche de rappel (booking-request).
    r2 = (await agent.handle_user_audio("Oui, c'est parfait".encode(), ts=4.0)).decode()
    assert "secretaire" in r2.lower()
    assert cal.booked is not None
    assert cal.booked["modality"] == "irm"
    assert cal.booked["desired"] == "2026-06-05T09:00:00.000Z"
    assert cal.booked["call_id"] == "call-x"


@pytest.mark.asyncio
async def test_sans_creneau_deporte_directement():
    cal = FakeCalendar([])
    agent = make_agent(cal)
    await agent.start()
    reply = (await agent.handle_user_audio("Je veux un rdv scanner a Cergy".encode(), ts=0.0)).decode()
    assert "rappellera" in reply.lower()
    assert cal.booked is not None
    assert cal.booked["modality"] == "scanner"
