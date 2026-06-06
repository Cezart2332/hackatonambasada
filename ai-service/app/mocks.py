"""Static mock responses — replace with real models + pgvector later."""

from __future__ import annotations

MOCK_EMBEDDING_DIM = 1536


def mock_embedding(seed: str) -> list[float]:
    """Deterministic fake vector for demos (not semantically meaningful)."""
    base = sum(ord(c) for c in seed) % 997
    return [((base * (i + 1)) % 1000) / 1000.0 for i in range(MOCK_EMBEDDING_DIM)]


def mock_onboarding_reply(step: str, user_answer: str, profile_hint: str | None) -> str:
    hints = {
        "product": f"Am notat: {user_answer}. Următorul pas — cantitatea disponibilă pentru livrare.",
        "quantity": f"Perfect, {user_answer}. Din ce localitate pleci cu marfa?",
        "location": f"Ok, {user_answer}. Cât de departe poți livra confortabil?",
        "range": f"Raza de {user_answer} e rezonabilă. În ce zile livrezi cel mai ușor?",
        "days": f"Excelent — {user_answer}. Caut acum afaceri locale care ar putea cumpăra.",
    }
    if step in hints:
        return hints[step]
    return f"Am înregistrat „{user_answer}”. Continuăm configurarea profilului."


def mock_message_draft(
    business_name: str,
    product_summary: str,
    locality: str,
    tone: str = "cald, direct",
) -> str:
    return (
        f"Bună ziua,\n\n"
        f"Sunt producător local din {locality or 'Dobrogea'} și ofer {product_summary or 'produse locale'}. "
        f"Am văzut că {business_name} pune accent pe ingrediente locale și cred că am avea o potrivire bună.\n\n"
        f"Pot trimite cantități, prețuri și o mostră dacă vă este util.\n\n"
        f"Cu respect,\n"
        f"Producător local"
    )


def mock_lead_enrichment(lead_name: str, lead_type: str, product_summary: str) -> dict:
    return {
        "leadName": lead_name,
        "leadType": lead_type,
        "matchScore": 88,
        "reason": f"{lead_name} ({lead_type}) pare potrivit pentru {product_summary or 'produse locale'} — mock AI.",
        "suggestedPitch": f"Propune un lot mic de test către {lead_name}, accent pe proveniență locală.",
        "bestDay": "Marți dimineața, înainte de aprovizionare.",
        "tone": "cald, direct, fără presiune",
    }
