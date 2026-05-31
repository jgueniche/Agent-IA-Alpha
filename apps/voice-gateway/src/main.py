"""Squelette de la passerelle voix (Phase 0).

Expose uniquement une sonde de sante pour valider l'orchestration Docker.
La boucle temps reel (VAD -> STT -> LLM -> TTS) arrive en Phase 1.
"""
import os

from aiohttp import web


async def health(_request: web.Request) -> web.Response:
    """Sonde de sante (liveness)."""
    return web.json_response({"status": "ok", "service": "voice-gateway", "phase": 0})


def build_app() -> web.Application:
    app = web.Application()
    app.add_routes([web.get("/health", health)])
    return app


if __name__ == "__main__":
    port = int(os.environ.get("VOICE_GATEWAY_PORT", "8080"))
    web.run_app(build_app(), host="0.0.0.0", port=port)
