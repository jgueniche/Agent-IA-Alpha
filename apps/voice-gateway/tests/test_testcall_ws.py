"""Tests de l'appel de test WebSocket (protocole navigateur <-> passerelle)."""
import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from src.agent.pipeline import VoiceAgent
from src.config import load_config
from src.main import build_app
from src.providers.mock import MockLlm, MockStt, MockTts


class FakeCore:
    async def create_call(self, *, site, caller_number, direction="inbound"):
        return "call-ws-1"

    async def upsert_transcript(self, call_id, **kwargs):
        self.transcript = kwargs

    async def end_call(self, call_id, **kwargs):
        self.ended = kwargs


def fake_agent_factory(cfg, site):
    return VoiceAgent(
        stt=MockStt(),
        llm=MockLlm(),
        tts=MockTts(),
        core=FakeCore(),
        retriever=None,
        calendar=None,
        site=site,
        transfer_target=cfg.transfer_target,
    )


@pytest.fixture
async def client():
    app = build_app()
    app["agent_factory"] = fake_agent_factory
    server = TestServer(app)
    client = TestClient(server)
    await client.start_server()
    yield client
    await client.close()


async def _recv_json(ws):
    msg = await ws.receive()
    return json.loads(msg.data)


async def test_full_test_call_flow(client):
    ws = await client.ws_connect("/ws/test-call?site=cergy")

    # 1. statut de chargement puis prêt
    assert (await _recv_json(ws))["type"] == "status"
    ready = await _recv_json(ws)
    assert ready["type"] == "ready"
    assert ready["callId"] == "call-ws-1"

    # 2. accueil parlé : texte + audio
    greeting = await _recv_json(ws)
    assert greeting["type"] == "turn"
    assert greeting["patient"] is None
    assert "Alpha" in greeting["agent"]
    audio = await ws.receive()
    assert isinstance(audio.data, bytes) and audio.data

    # 3. tour patient (MockStt décode l'UTF-8 envoyé en binaire)
    await ws.send_bytes("Bonjour, quels sont vos horaires ?".encode("utf-8"))
    turn = await _recv_json(ws)
    assert turn["type"] == "turn"
    assert turn["patient"].startswith("Bonjour")
    assert turn["agent"]
    audio = await ws.receive()
    assert isinstance(audio.data, bytes)

    # 4. silence -> "empty", pas de tour journalisé
    await ws.send_bytes(b"   ")
    assert (await _recv_json(ws))["type"] == "empty"

    # 5. fin d'appel
    await ws.send_str(json.dumps({"type": "end"}))
    ended = await _recv_json(ws)
    assert ended["type"] == "ended"
    assert ended["callId"] == "call-ws-1"
    await ws.close()


async def test_transfer_notification_on_critical(client):
    ws = await client.ws_connect("/ws/test-call?site=cergy")
    for _ in range(3):
        await ws.receive()  # status, ready, turn (accueil)
    await ws.receive()  # audio accueil

    await ws.send_bytes(
        "J'ai une douleur dans la poitrine et du mal a respirer".encode("utf-8")
    )
    turn = await _recv_json(ws)
    assert turn["type"] == "turn"
    await ws.receive()  # audio
    transfer = await _recv_json(ws)
    assert transfer["type"] == "transfer"
    assert transfer["target"]
    await ws.close()


async def test_health_reports_models_flag(client):
    res = await client.get("/health")
    body = await res.json()
    assert body["status"] == "ok"
    assert "modelsReady" in body
