"""Détection légère d'intention / modalité / site / type de connaissance.

Utilisée par la boucle agent pour router vers la base de connaissance (RAG).
Robuste aux accents et à la casse.
"""
from __future__ import annotations

import re
import unicodedata


def normalize(text: str) -> str:
    lowered = text.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def _has(norm: str, stem: str) -> bool:
    """Match avec limite de mot AVANT le motif (préfixe accepté après).

    Ainsi 'horaire' matche 'horaires', 'implant' matche 'implants', mais 'rer'
    ne matche pas 'preparer' (pas de limite de mot avant ce 'rer').
    """
    return re.search(r"\b" + re.escape(stem), norm) is not None


def _has_any(norm: str, stems: tuple[str, ...]) -> bool:
    return any(_has(norm, s) for s in stems)


# Ordre important : motifs spécifiques avant motifs courts.
_MODALITIES: tuple[tuple[str, str], ...] = (
    ("irm", "irm"),
    ("scanner", "scanner"),
    ("tdm", "scanner"),
    ("radiographie", "radiographie"),
    ("radio", "radiographie"),
    ("echographie", "echographie"),
    ("echo", "echographie"),
    ("mammographie", "mammographie"),
    ("mammo", "mammographie"),
    ("cone beam", "cone_beam"),
    ("cone-beam", "cone_beam"),
    ("conebeam", "cone_beam"),
)

_SITES = (("cergy", "cergy"), ("goussainville", "goussainville"))


def detect_modality(text: str) -> str | None:
    norm = normalize(text)
    for stem, modality in _MODALITIES:
        if _has(norm, stem):
            return modality
    return None


def detect_site(text: str) -> str | None:
    norm = normalize(text)
    for stem, site in _SITES:
        if _has(norm, stem):
            return site
    return None


def detect_knowledge_type(text: str) -> str | None:
    """Type de connaissance visé (prep/contre_indication/doc/horaires/acces)."""
    norm = normalize(text)
    if _has_any(
        norm,
        ("contre-indication", "contre indication", "pacemaker", "implant",
         "enceinte", "grossesse", "claustrophob"),
    ):
        return "contre_indication"
    if _has_any(norm, ("horaire", "ouvert", "ferme", "fermeture")):
        return "horaires"
    if _has_any(
        norm,
        ("acces", "acceder", "parking", "stationnement", "adresse", "venir", "rer", "bus"),
    ):
        return "acces"
    if _has_any(norm, ("document", "apporter", "ordonnance", "carte vitale", "mutuelle")):
        return "doc"
    if _has_any(norm, ("prepa", "prepara", "jeun", "boire", "vessie", "manger")):
        return "prep"
    return None


def is_knowledge_query(text: str) -> bool:
    """Vrai si la demande relève d'une info de connaissance (et non d'un RDV pur)."""
    return detect_knowledge_type(text) is not None
