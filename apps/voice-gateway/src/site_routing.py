"""Routage DID -> site (Cergy / Goussainville).

Le 3CX actuel ne route que Cergy ; Goussainville est géré de façon logique
(connaissance / agenda / RDV) et pourra être routé en ajoutant une entrée dans
DID_SITE_MAP, sans changer le code.
"""
from __future__ import annotations

import json


def _digits(number: str | None) -> str:
    return "".join(c for c in (number or "") if c.isdigit())


def resolve_site(
    called_number: str | None,
    did_site_map_json: str | None,
    default: str = "cergy",
) -> str:
    """Déduit le site à partir du numéro appelé (DID).

    `did_site_map_json` : JSON {"<DID>": "<site>"}. La comparaison se fait sur les
    chiffres uniquement (tolérante au format +33 / 0 / espaces).
    """
    if not did_site_map_json:
        return default
    try:
        mapping = json.loads(did_site_map_json)
    except (ValueError, TypeError):
        return default
    target = _digits(called_number)
    if not target:
        return default
    for did, site in mapping.items():
        d = _digits(did)
        # Égalité ou correspondance par suffixe (DID parfois sans préfixe pays).
        if d and (d == target or target.endswith(d) or d.endswith(target)):
            return str(site)
    return default
