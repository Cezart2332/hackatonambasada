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
) -> str:
    """Personalized outreach draft — returns text only, never sends."""
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
        f"Scrie un mesaj scurt de outreach în română pentru un producător local.\n\n"
        f"Afacere țintă: {business_name} ({business_type or 'local'})\n"
        f"Producător: {product_summary or 'produse locale'} din {locality or 'Dobrogea'}\n"
        f"Ton: {tone}\n"
        f"{extra}\n\n"
        "Reguli: 4–8 propoziții, fără presiune, menționează potrivirea concretă cu meniul/oferta, "
        "propune lot mic de probă. NU inventa detalii care nu apar mai sus. "
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
