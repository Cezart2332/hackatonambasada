from __future__ import annotations

import logging
import re
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool

from app.agent.chat_agent import ChatTurnResult, _extract_reply, _invoke_agent
from app.agent.llm import get_chat_model
from app.agent.outreach_agent import draft_outreach_message
from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ești asistentul de aprovizionare pentru localuri HoReCa din Dobrogea, România.

Obiectiv:
1. Află ce produse caută localul, cantitățile estimate, frecvența aprovizionării și zilele preferate de livrare.
2. Salvează răspunsurile cu update_venue_needs (doar în sesiunea de chat, nu în profilul permanent).
3. Abia după ce ai toate detaliile, utilizatorul va vedea producători potriviți în chat.
4. Răspunde la întrebări despre cum folosește platforma sau cum să contacteze producătorii din listă.

Reguli:
- Vorbește română, cald, scurt (2–4 propoziții).
- Colectează obligatoriu, în ordine: (1) produse, (2) cantitate/frecvență, (3) zile preferate de livrare. Locația e deja în profil — nu o cere din nou.
- Pune O SINGURĂ întrebare pe rând. NU menționa producători, potriviri sau liste până nu ai produse + frecvență + zile salvate.
- NU inventa producători și NU căuta pe internet — lista vine doar din producătorii înregistrați în platformă.
- Când utilizatorul menționează produse noi (ex. „am nevoie de miere”, „și lapte”), apelează update_venue_needs cu field=products_needed — adaugă la lista existentă.
- Când spune cantitate sau frecvență, apelează update_venue_needs cu field=supply_frequency.
- Când spune zile de livrare, apelează update_venue_needs cu field=preferred_days.
- Abia după ce toate cele 3 sunt complete, poți spune că urmează recomandări de producători; nu inventa nume.
- Dacă după completare nu există potriviri, spune clar și sugerează tab-ul Director pentru lista completă.
- Pentru mesaje către un producător, folosește draft_message.
"""

_checkpointer = MemorySaver()
_agent = None

_venue_ctx: ContextVar[VenueChatSessionContext | None] = ContextVar("_venue_ctx", default=None)


@dataclass
class VenueChatSessionContext:
    user_id: str
    profile: dict[str, Any]
    profile_updates: dict[str, Any] = field(default_factory=dict)
    onboarding_complete: bool = False


def _ctx() -> VenueChatSessionContext:
    ctx = _venue_ctx.get()
    if ctx is None:
        raise RuntimeError("Venue chat context not set")
    return ctx


def _venue_profile_ready(profile: dict[str, Any]) -> bool:
    needs = str(profile.get("productsNeeded") or profile.get("product") or "").strip()
    frequency = str(profile.get("supplyFrequency") or profile.get("quantity") or "").strip()
    days = str(profile.get("preferredDays") or profile.get("days") or "").strip()
    has_location = bool(str(profile.get("location") or "").strip())
    return bool(needs and frequency and days and has_location)


@tool
def update_venue_needs(field: str, value: str) -> str:
    """Salvează nevoile localului HoReCa.

    field: products_needed | supply_frequency | preferred_days | location
    value: textul introdus de utilizator
    """
    ctx = _ctx()
    field = field.strip().lower()
    value = value.strip()
    if not value:
        return "Valoarea e goală — cere utilizatorului să clarifice."

    updates: dict[str, Any] = {}

    if field in {"products_needed", "products", "product", "needs"}:
        new_products = [p.strip() for p in re.split(r"[,;]", value) if p.strip()]
        existing = str(ctx.profile.get("productsNeeded") or ctx.profile.get("product") or "").strip()
        merged: list[str] = []
        if existing:
            merged.extend(p.strip() for p in re.split(r"[,;]", existing) if p.strip())
        for item in new_products:
            item_lower = item.lower()
            if not any(item_lower in m.lower() or m.lower() in item_lower for m in merged):
                merged.append(item)
        joined = ", ".join(merged) if merged else ", ".join(new_products)
        updates["productsNeeded"] = joined
        updates["product"] = joined
        updates["products"] = merged or new_products
    elif field in {"supply_frequency", "quantity", "frequency"}:
        updates["supplyFrequency"] = value
        updates["quantity"] = value
    elif field in {"preferred_days", "days", "delivery_days"}:
        updates["preferredDays"] = value
        updates["days"] = value
    elif field == "location":
        updates["location"] = value
    else:
        return (
            "Câmp necunoscut. Folosește products_needed, supply_frequency, "
            "preferred_days sau location."
        )

    ctx.profile.update(updates)
    ctx.profile_updates.update(updates)

    if _venue_profile_ready(ctx.profile):
        ctx.onboarding_complete = True

    return f"Am salvat {field}={value}."


@tool
def draft_message(business_name: str, tone: str = "cald, direct") -> str:
    """Generează un mesaj scurt către un producător local."""
    ctx = _ctx()
    profile = ctx.profile
    products = profile.get("productsNeeded") or profile.get("product") or ""
    locality = str(profile.get("location") or "Dobrogea")
    return draft_outreach_message(
        business_name=business_name,
        product_summary=str(products),
        locality=locality,
        tone=tone,
    )


def _get_agent():
    global _agent
    if _agent is None:
        model = get_chat_model(temperature=0.3)
        _agent = create_react_agent(
            model,
            [update_venue_needs, draft_message],
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer,
        )
    return _agent


def run_venue_chat_turn(
    *,
    user_id: str,
    message: str,
    profile: dict[str, Any] | None = None,
) -> ChatTurnResult:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    normalized = dict(profile or {})
    if normalized.get("product") and not normalized.get("productsNeeded"):
        normalized["productsNeeded"] = normalized["product"]
    if normalized.get("quantity") and not normalized.get("supplyFrequency"):
        normalized["supplyFrequency"] = normalized["quantity"]
    if normalized.get("days") and not normalized.get("preferredDays"):
        normalized["preferredDays"] = normalized["days"]

    ctx = VenueChatSessionContext(user_id=user_id, profile=normalized)
    token = _venue_ctx.set(ctx)

    try:
        agent = _get_agent()
        profile_hint = (
            f"produse_căutate={ctx.profile.get('productsNeeded') or ctx.profile.get('product')}, "
            f"frecvență={ctx.profile.get('supplyFrequency') or ctx.profile.get('quantity')}, "
            f"zile={ctx.profile.get('preferredDays') or ctx.profile.get('days')}, "
            f"localitate={ctx.profile.get('location')}"
        )

        user_content = message
        if profile_hint.strip("=,"):
            user_content = f"{message}\n\n[Profil curent: {profile_hint}]"

        thread_id = f"venue-{user_id}"
        config = {"configurable": {"thread_id": thread_id}}
        result = _invoke_agent(agent, user_content, config)

        reply = _extract_reply(result.get("messages") or [])
        return ChatTurnResult(
            reply=reply,
            profile_updates=dict(ctx.profile_updates),
            leads=[],
            onboarding_complete=ctx.onboarding_complete,
            model=settings.openrouter_model,
        )
    finally:
        _venue_ctx.reset(token)
