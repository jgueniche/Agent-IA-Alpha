"""Tests des garde-fous medicaux et de la detection d'urgence."""
from src.agent import guardrails


def test_detecte_urgence_douleur_thoracique():
    assert guardrails.detect_urgency("J'ai une douleur thoracique depuis ce matin") == (
        guardrails.URGENCY_CRITICAL
    )


def test_detecte_urgence_insensible_aux_accents_et_casse():
    assert (
        guardrails.detect_urgency("difficulté à respirer") == guardrails.URGENCY_CRITICAL
    )


def test_demande_de_rdv_sans_urgence():
    assert guardrails.detect_urgency("Je voudrais un rendez-vous pour une IRM") == (
        guardrails.URGENCY_NONE
    )


def test_detecte_demande_de_resultats():
    assert guardrails.is_results_request("Pouvez-vous me donner mes résultats ?")
    assert guardrails.is_results_request("c'est quoi mon diagnostic")
    assert not guardrails.is_results_request("Je veux prendre rendez-vous")


def test_max_urgency():
    assert (
        guardrails.max_urgency(guardrails.URGENCY_NONE, guardrails.URGENCY_CRITICAL)
        == guardrails.URGENCY_CRITICAL
    )
    assert (
        guardrails.max_urgency(guardrails.URGENCY_HIGH, guardrails.URGENCY_LOW)
        == guardrails.URGENCY_HIGH
    )
