from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.gemini import (
    _clean_contact,
    _extract_json_array,
    _extract_phone_from_text,
    _filter_public_urls,
    _guess_website_for_name,
    _sanitize_url,
)
from app.geocode import geocode_business, geocode_city_center, haversine_km, infer_city_from_address
from app.openrouter_client import chat_with_web
from app.phone_util import validate_phone
from app.taxonomy import normalize_producer_products, needs_to_text

logger = logging.getLogger(__name__)

SUPPLIER_SEARCH_ANGLES = [
    "ferme, gospodării și producători de legume/fructe",
    "stupine, apicultori și producători de miere",
    "brânzării, lactate artizanale și crescători de animale",
    "vinării, cramă și producători de băuturi locale",
]

MAX_ATTEMPTS = 2

SUPPLIER_JSON_HINT = """
Return a JSON array. Each object MUST use only information found in web search results:
{
  "name": "exact producer/farm name",
  "type": "fermă | stupină | brânzărie | vinărie | producător local",
  "city": "localitate exactă",
  "address": "adresă completă din România",
  "website": "https://... (empty if not found)",
  "phone": "+40... (ONLY if listed online)",
  "contactPerson": "name or role if found",
  "products": ["honey","cheese","eggs","vegetables","fruit","wine","dairy","meat","herbs","bread","poultry","fish"],
  "summary": "what they produce and how (Romanian)",
  "notes": "delivery info, certifications, story",
  "source_urls": ["urls"]
}
Rules: ONLY real producers from search. Do NOT invent. No lat/lon in JSON.
"""


@dataclass
class SupplierDraft:
    name: str
    type: str
    city: str
    address: str
    latitude: float
    longitude: float
    products: list[str]
    summary: str
    contact: str
    source_urls: list[str] = field(default_factory=list)
    website: str = ""
    phone: str = ""
    contact_person: str = ""
    notes: str = ""
    geocode_provider: str = ""
    geocode_status: str = "unknown"
    geocode_query: str = ""
    geocode_label: str = ""


class SupplierDiscoveryState(TypedDict):
    locality: str
    latitude: float
    longitude: float
    range_km: float
    venue_needs: list[str]
    exclude_names: list[str]
    target_count: int
    attempts: int
    research_text: str
    citations: list[dict[str, str]]
    validated: list[SupplierDraft]
    seen_names: list[str]


def _name_blocked(name: str, exclude_names: list[str], seen: set[str]) -> bool:
    lower = name.lower().strip()
    if not lower or lower in seen:
        return True
    for excluded in exclude_names:
        ex = excluded.lower().strip()
        if ex and (ex in lower or lower in ex):
            return True
    return False


def _parse_supplier_item(
    item: dict,
    *,
    locality: str,
    latitude: float,
    longitude: float,
    fallback_urls: list[str],
    research_text: str = "",
) -> SupplierDraft | None:
    name = str(item.get("name", "")).strip()
    if not name or len(name) < 3:
        return None

    raw_products = item.get("products") or item.get("product") or []
    if isinstance(raw_products, str):
        raw_products = [p.strip() for p in raw_products.split(",") if p.strip()]
    products = normalize_producer_products([str(p) for p in raw_products])
    if not products:
        products = normalize_producer_products([str(item.get("summary", "produse locale"))])

    address = str(item.get("address", locality) or locality).strip()
    city = str(item.get("city", "") or "").strip() or infer_city_from_address(address) or locality
    urls = [str(u) for u in item.get("source_urls", []) if u and str(u).startswith("http")]
    merged_urls = list(dict.fromkeys(urls + fallback_urls))[:12]
    website = _sanitize_url(str(item.get("website", "") or "").strip())
    phone = validate_phone(str(item.get("phone", "") or "").strip(), source_text=research_text)
    if not website:
        website = _guess_website_for_name(name, research_text, [])
    if not phone:
        idx = research_text.lower().find(name.lower())
        if idx >= 0:
            phone = _extract_phone_from_text(research_text[max(0, idx - 80) : idx + 220])

    return SupplierDraft(
        name=name,
        type=str(item.get("type", "producător local")),
        city=city,
        address=address,
        latitude=latitude,
        longitude=longitude,
        products=products,
        summary=str(item.get("summary", f"Producător local — {needs_to_text(products)}.")),
        contact=_clean_contact(str(item.get("contact", "")), name, locality),
        source_urls=merged_urls if merged_urls else ([website] if website else []),
        website=website,
        phone=phone,
        contact_person=str(item.get("contactPerson", item.get("contact_person", "")) or "").strip(),
        notes=str(item.get("notes", "") or "").strip(),
    )


def search_node(state: SupplierDiscoveryState) -> dict:
    attempts = state["attempts"] + 1
    angle = SUPPLIER_SEARCH_ANGLES[(attempts - 1) % len(SUPPLIER_SEARCH_ANGLES)]
    needs_label = needs_to_text(state["venue_needs"])
    exclude_block = "\n".join(f"- {n}" for n in state["exclude_names"][:40]) or "(niciuna)"

    prompt = (
        f"Caută pe internet producători și fermieri REALI din {state['locality']}, Dobrogea, România "
        f"(rază ~{state['range_km']:.0f} km).\n"
        f"Focus: {angle}.\n"
        f"Localul HoReCa caută: {needs_label}.\n\n"
        f"NU include acești producători deja găsiți:\n{exclude_block}\n\n"
        f"{SUPPLIER_JSON_HINT}\n"
        f"Returnează DOAR un JSON array cu până la {state['target_count']} producători noi."
    )

    response = chat_with_web(prompt, use_web_tools=True, json_mode=True)
    return {
        "attempts": attempts,
        "research_text": response.text,
        "citations": response.citations,
    }


def extract_validate_node(state: SupplierDiscoveryState) -> dict:
    items = _extract_json_array(state["research_text"])
    source_urls = _filter_public_urls([c["uri"] for c in state["citations"] if c.get("uri")])
    validated = list(state["validated"])
    seen = {n.lower() for n in state["seen_names"]}

    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if _name_blocked(name, state["exclude_names"], seen):
            continue

        draft = _parse_supplier_item(
            item,
            locality=state["locality"],
            latitude=state["latitude"],
            longitude=state["longitude"],
            fallback_urls=source_urls,
            research_text=state["research_text"],
        )
        if not draft:
            continue

        city = draft.city or infer_city_from_address(draft.address) or state["locality"]
        geo = geocode_business(
            draft.name,
            draft.address,
            city,
            fallback_lat=state["latitude"],
            fallback_lon=state["longitude"],
        )
        if not geo:
            geo = geocode_city_center(city)
        if not geo:
            continue

        dist = haversine_km(state["latitude"], state["longitude"], geo.latitude, geo.longitude)
        if dist > state["range_km"] * 1.3:
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


def route_after_validate(state: SupplierDiscoveryState) -> Literal["search", "end"]:
    if len(state["validated"]) >= state["target_count"]:
        return "end"
    if state["attempts"] >= MAX_ATTEMPTS:
        return "end"
    return "search"


def _build_graph():
    graph = StateGraph(SupplierDiscoveryState)
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


_supplier_graph = None


def run_supplier_discovery_graph(
    *,
    locality: str,
    latitude: float,
    longitude: float,
    range_km: float,
    venue_needs: list[str],
    exclude_names: list[str] | None = None,
    target_count: int = 8,
) -> list[SupplierDraft]:
    global _supplier_graph
    if _supplier_graph is None:
        _supplier_graph = _build_graph()

    initial: SupplierDiscoveryState = {
        "locality": locality,
        "latitude": latitude,
        "longitude": longitude,
        "range_km": range_km,
        "venue_needs": venue_needs,
        "exclude_names": exclude_names or [],
        "target_count": target_count,
        "attempts": 0,
        "research_text": "",
        "citations": [],
        "validated": [],
        "seen_names": [],
    }
    result = _supplier_graph.invoke(initial)
    return list(result.get("validated") or [])[:target_count]
