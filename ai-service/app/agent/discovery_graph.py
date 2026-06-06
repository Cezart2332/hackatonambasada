from __future__ import annotations

import logging
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.gemini import (
    JSON_SCHEMA_HINT,
    BuyerDraft,
    _enrich_buyer_details,
    _extract_json_array,
    _fetch_menu_from_website,
    _filter_public_urls,
    _parse_buyer_item,
)
from app.geocode import geocode_business, haversine_km
from app.openrouter_client import chat_with_web
from app.phone_util import validate_phone
from app.taxonomy import needs_to_text

logger = logging.getLogger(__name__)

SEARCH_ANGLES = [
    "restaurante, hoteluri și pensiuni",
    "magazine alimentare, supermarketuri și băcănii",
    "cafenele, patiserii și cofetării",
    "catering, cantine și unități HoReCa",
]

MAX_ATTEMPTS = 2


def _address_needs_enrichment(address: str, locality: str) -> bool:
    clean = (address or "").strip()
    if not clean:
        return True

    lower = clean.lower()
    locality_lower = (locality or "").strip().lower()
    weak_markers = {
        "locație aproximativă",
        "locatie aproximativa",
        "lângă",
        "langa",
        "zona",
    }
    if any(marker in lower for marker in weak_markers):
        return True
    if len(clean) < 16:
        return True
    if locality_lower and lower.strip(" ,") in {locality_lower, f"{locality_lower}, românia", f"{locality_lower}, romania"}:
        return True
    return "," not in clean and not any(char.isdigit() for char in clean)


class DiscoveryState(TypedDict):
    locality: str
    latitude: float
    longitude: float
    range_km: float
    producer_needs: list[str]
    exclude_names: list[str]
    avoid_labels: list[str]
    target_count: int
    attempts: int
    research_text: str
    citations: list[dict[str, str]]
    validated: list[BuyerDraft]
    seen_names: list[str]


def _name_blocked(name: str, exclude_names: list[str], seen: set[str]) -> bool:
    lower = name.lower().strip()
    if not lower or lower in seen:
        return True
    for excluded in exclude_names:
        ex = excluded.lower().strip()
        if not ex:
            continue
        if ex in lower or lower in ex:
            return True
    return False


def search_node(state: DiscoveryState) -> dict:
    attempts = state["attempts"] + 1
    angle = SEARCH_ANGLES[(attempts - 1) % len(SEARCH_ANGLES)]
    needs_label = needs_to_text(state["producer_needs"])
    exclude = state["exclude_names"]
    exclude_block = (
        "\n".join(f"- {n}" for n in exclude[:40])
        if exclude
        else "(niciuna)"
    )
    avoid = state.get("avoid_labels") or []
    avoid_block = (
        "\n".join(f"- {label}" for label in avoid[:15])
        if avoid
        else "(niciuna)"
    )

    prompt = (
        f"Caută pe internet afaceri REALE din {state['locality']}, Dobrogea, România "
        f"(rază ~{state['range_km']:.0f} km, coordonate {state['latitude']:.3f}, {state['longitude']:.3f}).\n"
        f"Focus pentru această căutare: {angle}.\n"
        f"Producătorul vinde: {needs_label}.\n\n"
        f"NU include aceste afaceri deja găsite:\n{exclude_block}\n\n"
        f"EVITĂ tipuri/motive respinse anterior de producător:\n{avoid_block}\n\n"
        "Folosește web search și web fetch. Pentru fiecare: nume exact, adresă completă, "
        "site, telefon public, meniu, nevoi agricole estimate.\n\n"
        f"{JSON_SCHEMA_HINT}\n"
        f"Returnează DOAR un JSON array valid cu până la {state['target_count']} afaceri noi.\n"
        "NU inventa. NU include lat/lon."
    )

    response = chat_with_web(prompt, use_web_tools=True, json_mode=True)
    return {
        "attempts": attempts,
        "research_text": response.text,
        "citations": response.citations,
    }


def extract_validate_node(state: DiscoveryState) -> dict:
    items = _extract_json_array(state["research_text"])
    source_urls = _filter_public_urls(
        [c["uri"] for c in state["citations"] if c.get("uri")]
    )
    validated = list(state["validated"])
    seen = {n.lower() for n in state["seen_names"]}

    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if _name_blocked(name, state["exclude_names"], seen):
            continue

        draft = _parse_buyer_item(
            item,
            locality=state["locality"],
            latitude=state["latitude"],
            longitude=state["longitude"],
            fallback_urls=source_urls,
            research_text=state["research_text"],
            grounding_chunks=state["citations"],
        )
        if not draft:
            continue

        if _address_needs_enrichment(draft.address, state["locality"]):
            _enrich_buyer_details(draft, state["locality"])

        geo = geocode_business(
            draft.name,
            draft.address,
            draft.city or state["locality"],
            fallback_lat=state["latitude"],
            fallback_lon=state["longitude"],
        )
        if not geo:
            logger.warning("Graph skip %s — geocode failed", draft.name)
            continue

        dist = haversine_km(state["latitude"], state["longitude"], geo.latitude, geo.longitude)
        if dist > state["range_km"] * 1.3:
            logger.warning("Graph skip %s — %.1f km away", draft.name, dist)
            continue

        draft.latitude = geo.latitude
        draft.longitude = geo.longitude
        draft.geocode_provider = geo.provider
        draft.geocode_status = geo.status
        draft.geocode_query = geo.query
        draft.geocode_label = geo.label
        if geo.label and len(draft.address) < 20:
            draft.address = geo.label
        draft.phone = validate_phone(draft.phone, source_text=state["research_text"])

        validated.append(draft)
        seen.add(name.lower())

        if len(validated) >= state["target_count"]:
            break

    return {"validated": validated, "seen_names": list(seen)}


def route_after_validate(state: DiscoveryState) -> Literal["search", "end"]:
    if len(state["validated"]) >= state["target_count"]:
        return "end"
    if state["attempts"] >= MAX_ATTEMPTS:
        return "end"
    return "search"


def _build_graph():
    graph = StateGraph(DiscoveryState)
    graph.add_node("search", search_node)
    graph.add_node("extract_validate", extract_validate_node)
    graph.set_entry_point("search")
    graph.add_edge("search", "extract_validate")
    graph.add_conditional_edges(
        "extract_validate",
        route_after_validate,
        {"search": "search", "end": END},
    )
    return graph.compile()


_discovery_graph = None


def get_discovery_graph():
    global _discovery_graph
    if _discovery_graph is None:
        _discovery_graph = _build_graph()
    return _discovery_graph


def run_discovery_graph(
    *,
    locality: str,
    latitude: float,
    longitude: float,
    range_km: float,
    producer_needs: list[str],
    exclude_names: list[str] | None = None,
    avoid_labels: list[str] | None = None,
    target_count: int = 12,
) -> list[BuyerDraft]:
    """LangGraph agent loop: web search → extract → validate → retry until enough new buyers."""
    graph = get_discovery_graph()
    initial: DiscoveryState = {
        "locality": locality,
        "latitude": latitude,
        "longitude": longitude,
        "range_km": range_km,
        "producer_needs": producer_needs,
        "exclude_names": exclude_names or [],
        "avoid_labels": avoid_labels or [],
        "target_count": target_count,
        "attempts": 0,
        "research_text": "",
        "citations": [],
        "validated": [],
        "seen_names": [],
    }
    result = graph.invoke(initial)
    drafts: list[BuyerDraft] = list(result.get("validated") or [])

    enrich_limit = min(len(drafts), 2)
    for i, draft in enumerate(drafts[:enrich_limit]):
        _enrich_buyer_details(draft, locality)
        if draft.website and len(draft.menu_items) < 20:
            menu = _fetch_menu_from_website(draft.name, draft.website)
            if menu:
                draft.menu_items = menu

    return drafts[:target_count]
