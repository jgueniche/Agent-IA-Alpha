"""Appel de test par WebSocket (micro navigateur), sans téléphonie.

Permet de parler réellement à l'agent depuis le back-office (« Tester
l'agent ») : le navigateur envoie chaque tour de parole en WAV PCM, la
passerelle répond avec la transcription, le texte de l'agent et l'audio
synthétisé. L'appel est journalisé dans core-api exactement comme un appel
téléphonique (journal, transcription, métriques).

Protocole (trames texte JSON + trames binaires) :
  serveur -> client : {"type":"status","state":"loading_models"}
                      {"type":"ready","callId":"..."}
                      {"type":"turn","patient":str|null,"agent":str}
                      <binaire>  audio WAV de la réponse (suit chaque "turn")
                      {"type":"empty"}          rien d'exploitable entendu
                      {"type":"transfer","target":str}   transfert simulé
                      {"type":"ended","callId":"..."}
                      {"type":"error","message":str}
  client -> serveur : <binaire>  un tour de parole patient (WAV PCM mono)
                      {"type":"end"}  fin d'appel
"""
from __future__ import annotations

import json
import logging

from aiohttp import WSMsgType, web

from .agent.pipeline import VoiceAgent
from .calendar_client import CalendarClient
from .config import Config
from .core_client import CoreApiClient
from .knowledge import HttpKnowledgeRetriever
from .providers.factory import build_llm, build_stt, build_tts

log = logging.getLogger("testcall")

VALID_SITES = ("cergy", "goussainville")


def build_agent(cfg: Config, site: str) -> VoiceAgent:
    """Assemble un VoiceAgent complet (mêmes briques que la téléphonie)."""
    return VoiceAgent(
        stt=build_stt(cfg),
        llm=build_llm(cfg),
        tts=build_tts(cfg),
        core=CoreApiClient(cfg.core_api_url, cfg.service_api_key),
        retriever=HttpKnowledgeRetriever(cfg.core_api_url, cfg.service_api_key),
        calendar=CalendarClient(cfg.core_api_url, cfg.service_api_key),
        site=site,
        caller_number=None,  # appel de test : pas de numéro patient
        transfer_target=cfg.transfer_target,
    )


async def _send_json(ws: web.WebSocketResponse, payload: dict) -> None:
    await ws.send_str(json.dumps(payload, ensure_ascii=False))


async def handle_test_call(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(max_msg_size=32 * 1024 * 1024)
    await ws.prepare(request)

    cfg: Config = request.app["config"]
    agent_factory = request.app.get("agent_factory", build_agent)

    site = request.query.get("site", "cergy")
    if site not in VALID_SITES:
        site = "cergy"

    agent = agent_factory(cfg, site)

    try:
        # Chargement des modèles locaux (long au premier lancement : téléchargement).
        await _send_json(ws, {"type": "status", "state": "loading_models"})
        for provider in (agent.stt, agent.tts):
            ensure = getattr(provider, "ensure_ready", None)
            if ensure is not None:
                await ensure()

        call_id = await agent.start()
        await _send_json(ws, {"type": "ready", "callId": call_id, "site": site})

        # Message d'accueil parlé.
        greeting_audio = await agent.greet()
        _, greeting_text = agent.last_turn
        await _send_json(ws, {"type": "turn", "patient": None, "agent": greeting_text})
        await ws.send_bytes(greeting_audio)

        async for msg in ws:
            if msg.type == WSMsgType.BINARY:
                reply_audio = await agent.handle_user_audio(msg.data)
                if not reply_audio:
                    await _send_json(ws, {"type": "empty"})
                    continue
                patient_text, agent_text = agent.last_turn
                await _send_json(
                    ws, {"type": "turn", "patient": patient_text, "agent": agent_text}
                )
                await ws.send_bytes(reply_audio)
                if agent.transfer_requested:
                    await _send_json(
                        ws, {"type": "transfer", "target": cfg.transfer_target}
                    )
            elif msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "end":
                    break
            elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSING, WSMsgType.ERROR):
                break

        await agent.end()
        if not ws.closed:
            await _send_json(ws, {"type": "ended", "callId": agent.call_id})
    except Exception:  # noqa: BLE001 — remonté au client, jamais de PII en log
        log.exception("échec de l'appel de test")
        if not ws.closed:
            await _send_json(
                ws,
                {
                    "type": "error",
                    "message": (
                        "L'appel de test a échoué côté passerelle. Vérifiez que "
                        "core-api est démarré et que SERVICE_API_KEY est correcte "
                        "(logs : docker compose logs voice-gateway)."
                    ),
                },
            )
    finally:
        if not ws.closed:
            await ws.close()
    return ws
