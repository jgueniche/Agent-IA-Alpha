"""Retrieval de connaissances (RAG, étape recherche) côté passerelle.

L'agent consomme un `KnowledgeRetriever`. Deux implémentations :
 - HttpKnowledgeRetriever : interroge core-api (`POST /api/knowledge/search`),
   c'est le chemin de production (le scoring/édition vit côté core-api).
 - InMemoryKnowledgeRetriever : scoring local identique, pour tests hors-ligne.

Le scoring lexical est volontairement simple et déterministe ; il peut être
remplacé par un retriever vectoriel (pgvector + embeddings EEE) sans changer
le contrat ni l'agent.
"""
from __future__ import annotations

import unicodedata
from typing import Any, Protocol

import aiohttp

_STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "au", "aux", "et", "ou",
    "pour", "est", "elle", "vous", "que", "qui", "quoi", "quel", "quelle",
    "dois", "faut", "avec", "sans", "sur", "dans", "avant", "apres", "etre",
    "votre", "vos", "pas", "plus", "mon", "ma", "mes", "par", "ce", "cette",
}


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower())
    out = []
    for c in decomposed:
        if unicodedata.category(c) == "Mn":
            continue
        out.append(c if c.isalnum() else " ")
    return " ".join("".join(out).split())


def _tokenize(text: str) -> list[str]:
    return [t for t in _normalize(text).split(" ") if len(t) >= 3 and t not in _STOPWORDS]


def score_item(query_tokens: list[str], item: dict, ctx: dict) -> int:
    title_tokens = set(_tokenize(item.get("title", "")))
    content_tokens = set(_tokenize(item.get("content", "")))
    score = 0
    for t in query_tokens:
        if t in title_tokens:
            score += 3
        elif t in content_tokens:
            score += 1
    if ctx.get("modality") and item.get("modality") == ctx["modality"]:
        score += 3
    if ctx.get("type") and item.get("type") == ctx["type"]:
        score += 2
    if ctx.get("siteSlug") and item.get("siteSlug") == ctx["siteSlug"]:
        score += 2
    return score


class KnowledgeRetriever(Protocol):
    async def search(
        self,
        query: str,
        *,
        modality: str | None = None,
        type: str | None = None,
        site: str | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        ...


class HttpKnowledgeRetriever:
    """Interroge core-api (production)."""

    def __init__(self, base_url: str, service_api_key: str) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "x-service-key": service_api_key,
        }

    async def search(
        self,
        query: str,
        *,
        modality: str | None = None,
        type: str | None = None,
        site: str | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        payload: dict[str, Any] = {"query": query, "limit": limit}
        if modality:
            payload["modality"] = modality
        if type:
            payload["type"] = type
        if site:
            payload["siteSlug"] = site
        async with aiohttp.ClientSession(headers=self._headers) as s:
            async with s.post(self._base + "/api/knowledge/search", json=payload) as r:
                r.raise_for_status()
                return await r.json()


class InMemoryKnowledgeRetriever:
    """Scoring local (tests hors-ligne), miroir de la logique core-api."""

    def __init__(self, items: list[dict[str, Any]]) -> None:
        self._items = items

    async def search(
        self,
        query: str,
        *,
        modality: str | None = None,
        type: str | None = None,
        site: str | None = None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        candidates = [
            it
            for it in self._items
            if it.get("isActive", True)
            and (type is None or it.get("type") == type)
            and (modality is None or it.get("modality") in (modality, None))
        ]
        ctx = {"modality": modality, "type": type, "siteSlug": site}
        q = _tokenize(query)
        scored = [(score_item(q, it, ctx), it) for it in candidates]
        scored = [(s, it) for s, it in scored if s > 0]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{**it, "score": s} for s, it in scored[:limit]]
