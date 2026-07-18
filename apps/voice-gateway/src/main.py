"""Passerelle voix : sonde de santé + appel de test navigateur (WebSocket).

La boucle temps réel téléphonique (SIP/LiveKit) vit dans `livekit_agent.py`
(Phase 2). L'endpoint `/ws/test-call` permet de parler à l'agent sans
téléphonie, avec les mêmes briques STT/LLM/TTS et la même journalisation.
"""
import asyncio
import contextlib
import logging

from aiohttp import web

from .config import load_config
from .providers.factory import build_stt, build_tts
from .testcall import handle_test_call

log = logging.getLogger("voice-gateway")


async def health(request: web.Request) -> web.Response:
    """Sonde de sante (liveness) + etat de preparation des modeles locaux."""
    return web.json_response(
        {
            "status": "ok",
            "service": "voice-gateway",
            "modelsReady": bool(request.app["state"].get("models_ready")),
        }
    )


async def _preload_models(app: web.Application) -> None:
    """Charge (et télécharge si besoin) les modèles locaux au démarrage.

    En tâche de fond : la sonde de santé répond immédiatement, le premier
    appel de test attend simplement la fin du chargement.
    """
    cfg = app["config"]
    try:
        for provider in (build_stt(cfg), build_tts(cfg)):
            ensure = getattr(provider, "ensure_ready", None)
            if ensure is not None:
                await ensure()
        app["state"]["models_ready"] = True
        log.info("modeles IA locaux prets (whisper=%s, piper=%s)", cfg.whisper_model, cfg.piper_voice)
    except Exception:  # noqa: BLE001
        log.exception("prechargement des modeles impossible (retente au premier appel)")


async def _on_startup(app: web.Application) -> None:
    app["state"]["preload_task"] = asyncio.create_task(_preload_models(app))


async def _on_cleanup(app: web.Application) -> None:
    task = app["state"].get("preload_task")
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def build_app() -> web.Application:
    logging.basicConfig(level=logging.INFO)
    app = web.Application()
    app["config"] = load_config()
    app["state"] = {"models_ready": False}
    app.add_routes(
        [
            web.get("/health", health),
            web.get("/ws/test-call", handle_test_call),
        ]
    )
    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)
    return app


if __name__ == "__main__":
    cfg = load_config()
    web.run_app(build_app(), host="0.0.0.0", port=cfg.port)
