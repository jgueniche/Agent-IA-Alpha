"""Garde-fous medicaux et detection d'urgence (§M2).

L'agent ne donne JAMAIS de resultat d'examen, d'interpretation ni de conseil
medical. Il reconnait les signes d'urgence et redirige immediatement (consigne
d'appeler le 15 + transfert humain). En cas d'incertitude, il propose le
transfert vers une secretaire.
"""
from __future__ import annotations

import unicodedata

# Niveaux d'urgence (alignes sur l'enum Urgency du domaine).
URGENCY_NONE = "none"
URGENCY_LOW = "low"
URGENCY_MEDIUM = "medium"
URGENCY_HIGH = "high"
URGENCY_CRITICAL = "critical"

_URGENCY_RANK = {
    URGENCY_NONE: 0,
    URGENCY_LOW: 1,
    URGENCY_MEDIUM: 2,
    URGENCY_HIGH: 3,
    URGENCY_CRITICAL: 4,
}

# Signes evoquant une urgence vitale -> redirection immediate vers le 15.
_CRITICAL_PATTERNS = (
    "douleur thoracique",
    "douleur dans la poitrine",
    "mal a la poitrine",
    "malaise",
    "perte de connaissance",
    "evanoui",
    "essoufflement",
    "difficulte a respirer",
    "du mal a respirer",
    "avc",
    "paralysie",
    "parle de travers",
    "bouche de travers",
    "saignement abondant",
    "hemorragie",
    "convulsion",
)

# Demandes de resultats / interpretation -> jamais traitees par l'agent.
_RESULTS_PATTERNS = (
    "resultat",
    "compte rendu",
    "compte-rendu",
    "interpretation",
    "diagnostic",
    "est-ce que c'est grave",
    "est ce que c'est grave",
    "qu'est-ce que j'ai",
    "qu est ce que j ai",
)

SYSTEM_PROMPT_FR = (
    "Tu es l'assistant vocal telephonique du centre d'imagerie medicale Alpha "
    "Imagerie (sites de Cergy et Goussainville). Tu reponds en francais, de "
    "facon breve, claire et polie.\n"
    "Tu peux aider sur : prise de rendez-vous (en proposant des creneaux "
    "indicatifs ou en faisant rappeler une secretaire), preparation des examens "
    "(IRM, scanner, radiographie, echographie, mammographie, cone beam), "
    "documents a apporter, horaires, adresses, acces et stationnement.\n"
    "INTERDICTIONS ABSOLUES : ne donne jamais de resultat d'examen, de compte "
    "rendu, d'interpretation ni de conseil ou diagnostic medical. Tu ne "
    "remplaces pas un medecin.\n"
    "URGENCE : si la personne decrit des signes d'urgence (douleur thoracique, "
    "malaise, difficulte a respirer, signes d'AVC, saignement abondant...), "
    "invite-la a raccrocher et appeler le 15 (SAMU) immediatement, puis propose "
    "un transfert vers une secretaire.\n"
    "En cas de doute, d'incertitude ou si la personne le demande, propose "
    "toujours de transferer vers une secretaire."
)


def _normalize(text: str) -> str:
    """Minuscule + suppression des accents pour une detection robuste."""
    lowered = text.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def detect_urgency(text: str) -> str:
    """Retourne le niveau d'urgence detecte dans un enonce patient."""
    norm = _normalize(text)
    norm_patterns = [_normalize(p) for p in _CRITICAL_PATTERNS]
    if any(p in norm for p in norm_patterns):
        return URGENCY_CRITICAL
    return URGENCY_NONE


def is_results_request(text: str) -> bool:
    """Vrai si la personne demande des resultats / une interpretation."""
    norm = _normalize(text)
    return any(_normalize(p) in norm for p in _RESULTS_PATTERNS)


def max_urgency(a: str, b: str) -> str:
    """Retourne le niveau d'urgence le plus eleve."""
    return a if _URGENCY_RANK.get(a, 0) >= _URGENCY_RANK.get(b, 0) else b


# Reponses cadrees (independantes du LLM) pour les cas sensibles.
URGENCY_REPLY = (
    "Vos symptomes peuvent relever d'une urgence. Raccrochez et composez "
    "immediatement le 15. Je vous mets aussi en relation avec une secretaire."
)

RESULTS_REPLY = (
    "Je ne suis pas autorise a communiquer des resultats ou une interpretation "
    "medicale. Je vous transfere vers une secretaire qui pourra vous orienter."
)
