"""Client HTTP vers core-api : journalisation des appels et transcriptions.

S'authentifie via la cle de service (header x-service-key). Aucune donnee de
sante n'est loguee localement.
"""
from __future__ import annotations

from typing import Any

import aiohttp


class CoreApiClient:
    def __init__(self, base_url: str, service_api_key: str) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "x-service-key": service_api_key,
        }

    async def create_call(
        self,
        *,
        site: str | None,
        caller_number: str | None,
        direction: str = "inbound",
    ) -> str:
        """Cree l'appel au demarrage. Retourne l'identifiant cote core-api."""
        payload = {"site": site, "callerNumber": caller_number, "direction": direction}
        payload = {k: v for k, v in payload.items() if v is not None}
        data = await self._post("/api/calls", payload)
        return data["id"]

    async def upsert_transcript(
        self,
        call_id: str,
        *,
        segments: list[dict[str, Any]],
        summary: str | None = None,
        intent: str | None = None,
        urgency: str = "none",
    ) -> None:
        await self._put(
            f"/api/calls/{call_id}/transcript",
            {
                "segments": segments,
                "summary": summary,
                "intent": intent,
                "urgency": urgency,
            },
        )

    async def end_call(
        self,
        call_id: str,
        *,
        outcome: str,
        duration_seconds: int,
        agent_resolved: bool,
        transferred_to: str | None = None,
        ended_at: str | None = None,
        agent_latency_ms: int | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "outcome": outcome,
            "durationSeconds": duration_seconds,
            "agentResolved": agent_resolved,
        }
        if transferred_to:
            payload["transferredTo"] = transferred_to
        if ended_at:
            payload["endedAt"] = ended_at
        if agent_latency_ms is not None:
            payload["agentLatencyMs"] = agent_latency_ms
        await self._patch(f"/api/calls/{call_id}", payload)

    # --- helpers HTTP --------------------------------------------------------

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.post(self._base + path, json=body) as r:
                r.raise_for_status()
                return await r.json()

    async def _put(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.put(self._base + path, json=body) as r:
                r.raise_for_status()
                return await r.json()

    async def _patch(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.patch(self._base + path, json=body) as r:
                r.raise_for_status()
                return await r.json()
