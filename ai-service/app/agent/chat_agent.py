from __future__ import annotations

import logging
import re
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from app.agent.llm import get_chat_model
from app.config import get_settings
from app.agent.outreach_agent import draft_outreach_message
from app.services.matching import discover_leads
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ești Warm Leads — asistent de vânzări pentru producători locali din Dobrogea, România.

Obiectiv:
1. Află ce produse vinde producătorul, cantitatea disponibilă, localitatea, raza de livrare (km) și zilele preferate.
2. Când profilul e suficient (produse + localitate + rază), apelează run_discovery pentru lead-uri reale.
3. Răspunde la întrebări despre lead-uri, mesaje outreach (draft_message) sau căutări suplimentare.

Reguli:
- Vorbește română, cald, scurt (2–4 propoziții).
- Pune câte o întrebare clară dacă lipsește ceva din profil.
- Nu inventa afaceri — folosește run_discovery.
- Dacă utilizatorul cere explicit „caută lead-uri”, „găsește clienți”, „caută restaurante/localuri” sau similar, tratează mesajul ca intenție de discovery și apelează run_discovery imediat când profilul are produse + localitate + rază.
- După run_discovery, rezumă concret numele găsite și menționează că sunt venue-uri reale verificate.
- Pentru „caută alte lead-uri” / „mai multe lead-uri” / „mai caută”, apelează run_discovery cu discover_more=true.
"""

_checkpointer = MemorySaver()
_agent = None

_chat_ctx: ContextVar[ChatSessionContext | None] = ContextVar("_chat_ctx", default=None)


@dataclass
class ChatSessionContext:
    user_id: str
    profile: dict[str, Any]
    profile_updates: dict[str, Any] = field(default_factory=dict)
    leads: list[dict[str, Any]] = field(default_factory=list)
    onboarding_complete: bool = False


@dataclass
class ChatTurnResult:
    reply: str
    profile_updates: dict[str, Any]
    leads: list[dict[str, Any]]
    onboarding_complete: bool
    model: str


def _ctx() -> ChatSessionContext:
    ctx = _chat_ctx.get()
    if ctx is None:
        raise RuntimeError("Chat context not set")
    return ctx


def _parse_range_km(value: str) -> float:
    match = re.search(r"(\d+(?:[.,]\d+)?)", value.replace(",", "."))
    if match:
        return float(match.group(1))
    return 35.0


def _profile_ready(profile: dict[str, Any]) -> bool:
    products = profile.get("products") or []
    has_product = bool(profile.get("product", "").strip()) or any(
        str(p).strip() for p in products if isinstance(p, str)
    ) or any(
        isinstance(p, dict) and str(p.get("name", "")).strip() for p in products
    )
    has_location = bool(str(profile.get("location", "")).strip())
    has_range = profile.get("rangeKm") is not None or bool(str(profile.get("range", "")).strip())
    return has_product and has_location and has_range


def _looks_like_discovery_request(message: str) -> bool:
    lower = message.lower().strip()
    
    # Direct explicit expressions for finding leads/clients
    explicit_phrases = {
        "vreau lead", "vreau clienți", "vreau clienti", "noi lead-uri", "noi leads",
        "lead-uri noi", "leads noi", "caută lead", "cauta lead", "caută clienți", "cauta clienti",
        "caută clienti", "cauta clienți", "descoperă lead", "descopera lead", "descoperă clienți",
        "descopera clienti"
    }
    if any(phrase in lower for phrase in explicit_phrases):
        return True

    # Search-related verbs
    verbs = {
        "caut", "caută", "cauta", "găsește", "găsești", "gaseste", "gasesti",
        "arată", "arata", "identifică", "identifica", "descoperă", "descopera",
        "să găsesc", "sa gasesc", "să caut", "sa caut"
    }
    
    # Buyer/lead target terms
    targets = {
        "lead", "leads", "client", "clienți", "clienti", "restaurant", "restaurante",
        "local", "localuri", "bistro", "bistrouri", "hotel", "hoteluri", "pensiune",
        "pensiuni", "cafenea", "cafenele", "brutărie", "brutării", "brutarie", "brutarii",
        "patiserie", "patiserii", "băcănie", "băcănii", "bacanie", "bacanii", "magazin",
        "magazine", "supermarket", "supermarketuri", "cumpărător", "cumpărători",
        "cumparator", "cumparatori", "achizitor", "achizitori", "producător", "producători"
    }

    has_verb = any(v in lower for v in verbs)
    has_target = any(t in lower for t in targets)

    if has_verb and has_target:
        # Ignore administrative/help requests that might mention a target word
        ignore_patterns = {
            "cum să", "cum sa", "ajutor", "parolă", "parola", "cont", "profil",
            "setări", "setari", "cum modific", "cum schimb", "cum șterg", "cum sterg"
        }
        if any(pat in lower for pat in ignore_patterns):
            return False
        return True

    return False



def _looks_like_more_discovery(message: str) -> bool:
    lower = message.lower()
    return any(term in lower for term in ("mai multe", "alte lead", "mai caut", "cauta altele", "caută altele"))


@tool
def update_profile_field(field: str, value: str) -> str:
    """Salvează un câmp din profilul producătorului.

    field: product | quantity | location | range_km | delivery_days | latitude | longitude
    value: valoarea text (ex: 'miere de salcâm', 'Murfatlar', '35 km', 'marți dimineața')
    """
    ctx = _ctx()
    field = field.strip().lower()
    value = value.strip()
    if not value:
        return "Valoarea e goală — cere utilizatorului să clarifice."

    updates: dict[str, Any] = {}

    if field in {"product", "products"}:
        products = [p.strip() for p in re.split(r"[,;]", value) if p.strip()]
        updates["product"] = ", ".join(products)
        updates["products"] = products
    elif field == "quantity":
        updates["quantity"] = value
    elif field == "location":
        updates["location"] = value
    elif field in {"range", "range_km", "rangekm"}:
        km = _parse_range_km(value)
        updates["range"] = f"{int(km)} km"
        updates["rangeKm"] = km
    elif field in {"delivery_days", "days", "deliverydays"}:
        updates["days"] = value
        updates["deliveryDays"] = value
    elif field == "latitude":
        updates["latitude"] = float(value.replace(",", "."))
    elif field == "longitude":
        updates["longitude"] = float(value.replace(",", "."))
    else:
        return f"Câmp necunoscut: {field}. Folosește product, quantity, location, range_km, delivery_days."

    ctx.profile.update(updates)
    ctx.profile_updates.update(updates)

    if _profile_ready(ctx.profile):
        ctx.onboarding_complete = True

    return f"Am salvat {field}={value}."


@tool
def run_discovery(discover_more: bool = False) -> str:
    """Caută lead-uri locale (afaceri potențiale) pe baza profilului producătorului.

    discover_more: true pentru lead-uri noi, excluzând cele deja afișate.
    """
    return _run_discovery_from_context(discover_more=discover_more)


def _run_discovery_from_context(discover_more: bool = False) -> str:
    ctx = _ctx()
    profile = ctx.profile

    products_raw = profile.get("products") or []
    if isinstance(products_raw, list):
        if products_raw and isinstance(products_raw[0], dict):
            products = [str(p.get("name", "")).strip() for p in products_raw if p.get("name")]
        else:
            products = [str(p).strip() for p in products_raw if str(p).strip()]
    else:
        products = []

    if not products and profile.get("product"):
        products = [p.strip() for p in str(profile["product"]).split(",") if p.strip()]

    locality = str(profile.get("location") or "Dobrogea").strip()
    latitude = float(profile.get("latitude") or 44.17)
    longitude = float(profile.get("longitude") or 28.63)
    range_km = float(profile.get("rangeKm") or _parse_range_km(str(profile.get("range") or "35 km")))

    if not products:
        return "Profil incomplet: lipsește produsul. Întreabă ce vinde producătorul."
    if not locality:
        return "Profil incomplet: lipsește localitatea."

    try:
        result = discover_leads(
            user_id=ctx.user_id,
            products=products,
            locality=locality,
            latitude=latitude,
            longitude=longitude,
            range_km=range_km,
            limit=3,
            discover_more=discover_more,
        )
        leads = result.get("leads") or []
        ctx.leads = leads
        ctx.onboarding_complete = True

        if not leads and discover_more:
            # No new leads found with discover_more — try a force refresh to find genuinely new ones
            logger.info("discover_more returned 0 leads, retrying with force_refresh")
            result = discover_leads(
                user_id=ctx.user_id,
                products=products,
                locality=locality,
                latitude=latitude,
                longitude=longitude,
                range_km=range_km,
                limit=3,
                force_refresh=True,
                discover_more=False,
            )
            leads = result.get("leads") or []
            ctx.leads = leads

        if not leads:
            return (
                f"Am verificat toată zona din raza de {int(range_km)} km în jurul {locality}. "
                "Nu am găsit afaceri noi nepotrivite deja. "
                "Poți mări raza de livrare sau aștept să apară venue-uri noi în zona ta."
            )
        names = ", ".join(lead["name"] for lead in leads[:5])
        suffix = f" (+{len(leads) - 5} altele)" if len(leads) > 5 else ""
        return f"Am găsit {len(leads)} lead-uri: {names}{suffix}."
    except Exception as exc:
        logger.exception("run_discovery failed: %s", exc)
        return "Căutarea a eșuat temporar. Cere utilizatorului să reînceapă."


@tool
def draft_message(business_name: str, tone: str = "cald, direct") -> str:
    """Generează un mesaj scurt de outreach pentru o afacere locală."""
    ctx = _ctx()
    profile = ctx.profile
    products = profile.get("product") or ", ".join(profile.get("products") or [])
    locality = str(profile.get("location") or "Dobrogea")
    message = draft_outreach_message(
        business_name=business_name,
        product_summary=str(products),
        locality=locality,
        tone=tone,
    )
    return message


def _get_agent():
    global _agent
    if _agent is None:
        model = get_chat_model(temperature=0.3)
        _agent = create_react_agent(
            model,
            [update_profile_field, run_discovery, draft_message],
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer,
        )
    return _agent


def _is_corrupt_chat_history_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return "tool_calls" in message or "toolmessage" in message


def _reset_chat_thread(thread_id: str) -> None:
    if hasattr(_checkpointer, "delete_thread"):
        _checkpointer.delete_thread(thread_id)
        logger.warning("Reset corrupt chat thread %s", thread_id)
        return
    logger.warning("Cannot reset chat thread %s — delete_thread unavailable", thread_id)


def _invoke_agent(agent, user_content: str, config: dict):
    payload = {"messages": [HumanMessage(content=user_content)]}
    try:
        return agent.invoke(payload, config=config)
    except ValueError as exc:
        if not _is_corrupt_chat_history_error(exc):
            raise
        thread_id = config.get("configurable", {}).get("thread_id")
        if not thread_id:
            raise
        logger.warning("Corrupt chat history for thread %s, retrying once", thread_id)
        _reset_chat_thread(thread_id)
        return agent.invoke(payload, config=config)


def _extract_reply(messages: list) -> str:
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(content, list):
                parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("text")]
                joined = "\n".join(parts).strip()
                if joined:
                    return joined
    return "Am înțeles. Cu ce te pot ajuta în continuare?"


def run_chat_turn(
    *,
    user_id: str,
    message: str,
    profile: dict[str, Any] | None = None,
) -> ChatTurnResult:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    ctx = ChatSessionContext(
        user_id=user_id,
        profile=dict(profile or {}),
    )
    token = _chat_ctx.set(ctx)

    try:
        agent = _get_agent()
        profile_hint = ""
        if ctx.profile:
            profile_hint = (
                f"produse={ctx.profile.get('product') or ctx.profile.get('products')}, "
                f"localitate={ctx.profile.get('location')}, "
                f"rază={ctx.profile.get('range') or ctx.profile.get('rangeKm')}, "
                f"zile={ctx.profile.get('days') or ctx.profile.get('deliveryDays')}"
            )

        user_content = message
        if profile_hint.strip("=,"):
            user_content = f"{message}\n\n[Profil curent: {profile_hint}]"

        if _looks_like_discovery_request(message) and _profile_ready(ctx.profile):
            discovery_reply = _run_discovery_from_context(
                discover_more=_looks_like_more_discovery(message)
            )
            return ChatTurnResult(
                reply=discovery_reply,
                profile_updates=dict(ctx.profile_updates),
                leads=list(ctx.leads),
                onboarding_complete=ctx.onboarding_complete,
                model=settings.openrouter_model,
            )

        config = {"configurable": {"thread_id": user_id}}
        result = _invoke_agent(agent, user_content, config)

        reply = _extract_reply(result.get("messages") or [])
        return ChatTurnResult(
            reply=reply,
            profile_updates=dict(ctx.profile_updates),
            leads=list(ctx.leads),
            onboarding_complete=ctx.onboarding_complete,
            model=settings.openrouter_model,
        )
    finally:
        _chat_ctx.reset(token)
