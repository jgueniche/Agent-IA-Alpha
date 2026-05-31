"""Client agenda (outils get_availabilities / create_callback_task) vers core-api.

L'écriture de RDV n'est pas possible sans API partenaire : la prise de RDV est
déportée en tâche de rappel (booking-request). L'agent ne fait que LIRE des
disponibilités synchronisées et PROPOSER.
"""
from __future__ import annotations

from typing import Any

import aiohttp


class CalendarClient:
    def __init__(self, base_url: str, service_api_key: str) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "x-service-key": service_api_key,
        }

    async def get_availabilities(
        self, site: str, modality: str, *, limit: int = 3
    ) -> list[dict[str, Any]]:
        payload = {"site": site, "modality": modality, "limit": limit}
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.post(self._base + "/api/calendar/availabilities", json=payload) as r:
                r.raise_for_status()
                return await r.json()

    async def request_booking(
        self,
        site: str,
        modality: str,
        *,
        desired_start_at: str | None = None,
        call_id: str | None = None,
        note: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {"site": site, "modality": modality}
        if desired_start_at:
            payload["desiredStartAt"] = desired_start_at
        if call_id:
            payload["callId"] = call_id
        if note:
            payload["note"] = note
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.post(self._base + "/api/calendar/booking-request", json=payload) as r:
                r.raise_for_status()
                data = await r.json()
                return data["taskId"]
