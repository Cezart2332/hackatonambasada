from __future__ import annotations

import logging

from app.agent.llm import get_chat_model
from app.config import get_settings
from app.openrouter_client import chat_with_web

logger = logging.getLogger(__name__)


def _fetch_business_context(*, website: str, business_name: str) -> str:
    if not website.strip():
        return ""
    try:
        prompt = (
            f"Citește {website} și extrage informații despre {business_name}: "
            "meniu, produse, stil, contact. Răspunde scurt în română, fără inventii."
        )
        response = chat_with_web(prompt, use_web_tools=True, json_mode=False)
        return (response.text or "")[:2500]
    except Exception as exc:
        logger.warning("web_fetch for outreach failed (%s): %s", business_name, exc)
        return ""


def draft_venue_procurement_message(
    *,
    producer_name: str,
    venue_name: str,
    products: str,
    supply_frequency: str = "",
    preferred_days: str = "",
    producer_products: str = "",
    locality: str = "",
    tone: str = "cald, direct",
) -> str:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    prompt = (
        f"Scrie un mesaj scurt de aprovizionare în română de la un local HoReCa către un producător.\n\n"
        f"Local: {venue_name or 'local din Dobrogea'}\n"
        f"Producător: {producer_name}\n"
        f"Căutăm: {products or 'produse locale'}\n"
        f"Cantitate/frecvență: {supply_frequency or 'de confirmat'}\n"
        f"Zile preferate livrare: {preferred_days or 'de confirmat'}\n"
        f"Locație: {locality or 'Dobrogea'}\n"
        f"Produse oferite de producător: {producer_products or 'produse locale'}\n"
        f"Ton: {tone}\n\n"
        "Reguli: 4–8 propoziții, cerere clară de ofertă și disponibilitate, menționează cantitatea și zilele. "
        "Returnează DOAR textul mesajului."
    )

    model = get_chat_model(temperature=0.35)
    content = model.invoke(prompt).content
    if isinstance(content, str) and content.strip():
        return content.strip()
    raise RuntimeError("LLM venue procurement draft failed")


def draft_outreach_message(
    *,
    business_name: str,
    business_type: str = "",
    website: str = "",
    menu_items: str = "",
    notes: str = "",
    product_summary: str = "",
    locality: str = "",
    tone: str = "cald, direct",
    account_type: str = "producer",
    venue_business_name: str = "",
    supply_frequency: str = "",
    preferred_days: str = "",
) -> str:
    if account_type == "venue":
        return draft_venue_procurement_message(
            producer_name=business_name,
            venue_name=venue_business_name,
            products=product_summary,
            supply_frequency=supply_frequency,
            preferred_days=preferred_days,
            producer_products=menu_items,
            locality=locality,
            tone=tone,
        )

    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    site_context = _fetch_business_context(website=website, business_name=business_name)
    extra = "\n".join(
        part
        for part in [
            f"Meniu/produse cunoscute: {menu_items}" if menu_items else "",
            f"Note: {notes}" if notes else "",
            f"Context site: {site_context}" if site_context else "",
        ]
        if part
    )

    prompt = (
        f"Scrie un mesaj WhatsApp natural, scurt, în română, pentru un producător local.\n\n"
        f"Afacere țintă: {business_name} ({business_type or 'local'})\n"
        f"Producător: {product_summary or 'produse locale'} din {locality or 'Dobrogea'}\n"
        f"Ton: {tone}\n"
        f"{extra}\n\n"
        "Reguli stricte:\n"
        "- 3–5 propoziții, ca un mesaj scris de un om, nu ca text de marketing.\n"
        "- Prima propoziție trebuie să fie concretă și să lege produsul de meniul/oferta localului, dacă există date.\n"
        "- Evită formule generice precum „vă propunem o colaborare”, „suntem încântați”, „soluții personalizate”.\n"
        "- Cere un răspuns simplu: dacă vor preț/listă/cantitate pentru o probă mică.\n"
        "- NU inventa detalii care nu apar mai sus.\n"
        "Returnează DOAR textul mesajului, fără titluri sau explicații."
    )

    try:
        model = get_chat_model(temperature=0.35)
        content = model.invoke(prompt).content
        if isinstance(content, str) and content.strip():
            return content.strip()
    except Exception as exc:
        logger.warning("LLM outreach draft failed for %s: %s", business_name, exc)
        raise RuntimeError("LLM outreach draft failed") from exc
    raise RuntimeError("LLM outreach draft failed")
