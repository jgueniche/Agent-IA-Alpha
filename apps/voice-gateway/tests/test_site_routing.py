"""Tests du routage DID -> site."""
from src.site_routing import resolve_site


def test_defaut_cergy_sans_mapping():
    assert resolve_site("+33187430171", None) == "cergy"


def test_mapping_explicite():
    m = '{"0187430171": "cergy", "0139000000": "goussainville"}'
    assert resolve_site("+33 1 87 43 01 71", m) == "cergy"
    assert resolve_site("0139000000", m) == "goussainville"


def test_numero_inconnu_retombe_sur_defaut():
    m = '{"0139000000": "goussainville"}'
    assert resolve_site("0100000000", m, default="cergy") == "cergy"


def test_json_invalide_ne_casse_pas():
    assert resolve_site("0187430171", "{pas du json") == "cergy"
