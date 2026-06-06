"""Static mock responses — replace with real models + pgvector later."""

from __future__ import annotations

MOCK_EMBEDDING_DIM = 1536


def mock_embedding(seed: str) -> list[float]:
    """Deterministic fake vector for demos (not semantically meaningful)."""
    base = sum(ord(c) for c in seed) % 997
    return [((base * (i + 1)) % 1000) / 1000.0 for i in range(MOCK_EMBEDDING_DIM)]


def mock_onboarding_reply(step: str, user_answer: str, profile_hint: str | None) -> str:
    hints = {
        "product": (
            f"Super — {user_answer} sună bine pentru piața locală. "
            f"Cât ai disponibil săptămâna asta pentru livrare?"
        ),
        "quantity": (
            f"Notat: {user_answer}. "
            f"Ca să-ți arăt lead-uri aproape, spune-mi din ce localitate pleci."
        ),
        "location": (
            f"Perfect, {user_answer}. "
            f"Ultima întrebare despre livrare: cât de departe poți merge fără să te încurce?"
        ),
        "range": (
            f"Raza de {user_answer} e ok. "
            f"În ce zile îți convine cel mai mult să livrezi?"
        ),
        "days": (
            f"Am tot ce-mi trebuie — livrare {user_answer}. "
            f"Caut acum restaurante, hoteluri și magazine din zonă care ar putea cumpăra."
        ),
    }
    if step in hints:
        return hints[step]
    if profile_hint:
        return f"Am actualizat profilul cu „{user_answer}”. Folosesc și ce ai deja: {profile_hint}."
    return f"Am notat „{user_answer}”. Mai avem un pas sau două și trecem la lead-uri."


def mock_message_draft(
    business_name: str,
    product_summary: str,
    locality: str,
    tone: str = "cald, direct",
) -> str:
    products = product_summary or "produse din zonă"
    place = locality or "Dobrogea"

    return (
        f"Bună ziua,\n\n"
        f"Sunt producător din {place} și am {products} disponibile săptămâna asta. "
        f"Am văzut că la {business_name} folosiți ingrediente locale — "
        f"ar putea fi o potrivire bună pentru meniul sau oferta voastră.\n\n"
        f"Dacă vă ajută, vă trimit cantități, prețuri și o mostră mică, fără obligație.\n\n"
        f"Mulțumesc,\n"
        f"Un producător local"
    )


def mock_lead_enrichment(lead_name: str, lead_type: str, product_summary: str) -> dict:
    products = product_summary or "produse locale"
    type_label = lead_type or "afacere locală"

    return {
        "leadName": lead_name,
        "leadType": type_label,
        "matchScore": 91,
        "reason": (
            f"{lead_name} ({type_label}) cumpără des din zonă și menționează furnizori locali — "
            f"potrivit pentru {products}."
        ),
        "suggestedPitch": (
            f"Sugerează un lot mic de probă pentru {lead_name}, "
            f"cu accent pe proveniență din Dobrogea și livrare rapidă."
        ),
        "bestDay": "Marți sau miercuri dimineața, înainte de aprovizionare.",
        "tone": "cald, scurt, fără presiune",
    }
