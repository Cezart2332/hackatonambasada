from __future__ import annotations

import json
import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any

from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.geocode import geocode_business, haversine_km
from app.openrouter_client import WebResponse, chat_with_web, embed as openrouter_embed
from app.phone_util import validate_phone
from app.taxonomy import normalize_needs, needs_to_text

logger = logging.getLogger(__name__)

JSON_SCHEMA_HINT = """
Return a JSON array. Each object MUST use only information found in web search results:
{
  "name": "exact business name",
  "type": "restaurant | hotel | cafe | shop | deli | supermarket",
  "city": "orașul/localitatea exactă din adresă, ex: Constanța | Eforie Nord | Tulcea | Murfatlar",
  "address": "strada, număr, oraș, județ, Romania (adresă completă din Google Maps / site)",
  "website": "https://... official site or Facebook page (empty string if not found)",
  "phone": "+40... (ONLY if explicitly listed online — empty string otherwise)",
  "contactPerson": "role or name if found (empty otherwise)",
  "menuItems": "real dishes/products from menu or listing, comma-separated",
  "needs": ["honey","meat","fish","cheese","eggs","vegetables","fruit","wine","dairy","bread","poultry","herbs"],
  "summary": "why they buy local, based on menu/cuisine (Romanian)",
  "notes": "extra facts from web: cuisine style, local suppliers mentioned",
  "source_urls": ["urls where info was found"]
}
Rules:
- ONLY include businesses that clearly exist in search results. Do NOT invent names.
- Do NOT include latitude/longitude — we geocode from address.
- phone must be copied exactly from a web source; if not found, use empty string. NEVER guess.
- menuItems must come from actual menus/pages when possible, not generic guesses.
- If a field is unknown, use empty string — never use N/A or placeholder text.
"""


@dataclass
class BuyerDraft:
    name: str
    type: str
    city: str
    address: str
    latitude: float
    longitude: float
    needs: list[str]
    summary: str
    contact: str
    source_urls: list[str] = field(default_factory=list)
    website: str = ""
    phone: str = ""
    contact_person: str = ""
    menu_items: str = ""
    notes: str = ""
    geocode_provider: str = ""
    geocode_status: str = "unknown"
    geocode_query: str = ""
    geocode_label: str = ""


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def embed(text: str) -> list[float]:
    return l2_normalize(openrouter_embed(text))


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for key in ("buyers", "results", "data"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
            if parsed.keys() & {"name", "address", "type"}:
                return [parsed]
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _citation_urls(response: WebResponse) -> list[str]:
    return [c["uri"] for c in response.citations if c.get("uri")]


def _sanitize_url(url: str) -> str:
    cleaned = url.strip().rstrip(".,;)")
    if not cleaned:
        return ""
    if not cleaned.startswith("http"):
        cleaned = f"https://{cleaned.lstrip('/')}"
    if len(cleaned) < 14 or " " in cleaned:
        return ""
    return cleaned


def _filter_public_urls(urls: list[str]) -> list[str]:
    public: list[str] = []
    for url in urls:
        if url and url.startswith("http"):
            public.append(url)
    return list(dict.fromkeys(public))


def _extract_urls_from_text(text: str) -> list[str]:
    found = re.findall(r"https?://[^\s\]\)\"'<>]+", text)
    domains = re.findall(
        r"(?:https?://)?(?:www\.)?([a-zA-Z0-9-]+\.(?:ro|com|eu|net|org)[^\s\]\)\"'<>]*)",
        text,
    )
    urls = list(found)
    for domain in domains:
        if not domain.startswith("http"):
            urls.append(f"https://{domain.lstrip('/')}")
    return _filter_public_urls(urls)


def _extract_phone_from_text(text: str) -> str:
    for match in re.finditer(
        r"(\+40[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2,3}|0\d{9})",
        text,
    ):
        validated = validate_phone(match.group(1), source_text=text)
        if validated:
            return validated
    return ""


def _guess_website_for_name(name: str, research_text: str, chunks: list[dict[str, str]]) -> str:
    name_lower = name.lower()
    for chunk in chunks:
        title = chunk.get("title", "").lower()
        if name_lower in title or any(part in title for part in name_lower.split() if len(part) > 3):
            uri = chunk.get("uri", "")
            if uri:
                return uri

    idx = research_text.lower().find(name_lower)
    if idx >= 0:
        window = research_text[max(0, idx - 120) : idx + 280]
        urls = _extract_urls_from_text(window)
        if urls:
            return urls[0]
    return ""


def _guess_menu_for_name(name: str, research_text: str) -> str:
    name_lower = name.lower()
    idx = research_text.lower().find(name_lower)
    if idx < 0:
        return ""
    window = research_text[idx : idx + 600]
    menu_match = re.search(
        r"(?:meniu|preparate|feluri|produse|oferă|servește)[:\s*-]+([^\n*\.]{10,180})",
        window,
        re.IGNORECASE,
    )
    if menu_match:
        return re.sub(r"\*+", "", menu_match.group(1)).strip(" ,;:-")
    return ""


def _web_generate(prompt: str, *, json_mode: bool = False) -> WebResponse:
    return chat_with_web(prompt, use_web_tools=True, json_mode=json_mode, temperature=0.2)


def _fetch_menu_from_website(name: str, website: str) -> str:
    if not website or not website.startswith("http"):
        return ""
    prompt = (
        f"Folosește web fetch pentru {website} și extrage feluri de mâncare / produse "
        f"pentru {name}. Răspunde DOAR cu listă scurtă separată prin virgulă. "
        f"Dacă nu găsești meniu, răspunde cu string gol."
    )
    try:
        resp = _web_generate(prompt)
        text = resp.text.strip()
        if len(text) > 500 or text.lower().startswith("nu am"):
            return ""
        return text
    except Exception:
        return ""


def _clean_contact(contact: str, name: str, locality: str) -> str:
    bad = {"", "n/a", "na", "unknown", "none", "null"}
    if contact.strip().lower() in bad:
        return (
            f"Bună ziua, sunt producător local din {locality} și am văzut informațiile despre "
            f"{name}. Aș dori să vă propun produse locale — pot trimite cantități și prețuri dacă vă ajută."
        )
    return contact.strip()


def _parse_buyer_item(
    item: dict[str, Any],
    *,
    locality: str,
    latitude: float,
    longitude: float,
    fallback_urls: list[str],
    research_text: str = "",
    grounding_chunks: list[dict[str, str]] | None = None,
) -> BuyerDraft | None:
    name = str(item.get("name", "")).strip()
    if not name or len(name) < 3:
        return None

    needs = normalize_needs([str(n) for n in item.get("needs", [])])
    if not needs:
        needs = ["vegetables", "dairy"]

    address = str(item.get("address", locality) or locality).strip()
    city = str(item.get("city", "") or "").strip()
    if not city:
        from app.geocode import infer_city_from_address

        city = infer_city_from_address(address) or locality

    urls = [str(u) for u in item.get("source_urls", []) if u and str(u).startswith("http")]
    merged_urls = list(dict.fromkeys(urls + fallback_urls))[:12]
    website = _sanitize_url(str(item.get("website", "") or "").strip())

    menu_items = str(item.get("menuItems", item.get("menu_items", "")) or "").strip()
    phone = validate_phone(str(item.get("phone", "") or "").strip(), source_text=research_text)
    contact_person = str(item.get("contactPerson", item.get("contact_person", "")) or "").strip()
    notes = str(item.get("notes", "") or "").strip()

    if not website:
        website = _guess_website_for_name(name, research_text, grounding_chunks or [])
    if not phone:
        idx = research_text.lower().find(name.lower())
        if idx >= 0:
            phone = _extract_phone_from_text(research_text[max(0, idx - 80) : idx + 220])
    if not menu_items:
        menu_items = _guess_menu_for_name(name, research_text)
    if not merged_urls and website:
        merged_urls = [website]
    if not merged_urls:
        merged_urls = [c["uri"] for c in (grounding_chunks or []) if c.get("uri")][:5]

    return BuyerDraft(
        name=name,
        type=str(item.get("type", "afacere locală")),
        city=city,
        address=address,
        latitude=latitude,
        longitude=longitude,
        needs=needs,
        summary=str(item.get("summary", f"Potrivit pentru {needs_to_text(needs)}.")),
        contact=_clean_contact(str(item.get("contact", "")), name, locality),
        source_urls=merged_urls,
        website=website,
        phone=phone,
        contact_person=contact_person,
        menu_items=menu_items,
        notes=notes,
    )


def _enrich_buyer_details(draft: BuyerDraft, locality: str) -> None:
    if draft.website and len(draft.menu_items) >= 15 and draft.phone and len(draft.address) > 20:
        return

    prompt = (
        f"Caută pe internet afacerea „{draft.name}” din {locality}, România.\n"
        "Folosește web search și web fetch. Găsește: adresa completă, site/Facebook, "
        "telefon public (doar dacă e listat), meniu/produse.\n"
        'Răspunde DOAR JSON: {"address":"","website":"","phone":"","contactPerson":"","menuItems":"","notes":""}\n'
        "Folosește string gol pentru câmpuri necunoscute. Nu inventa telefon sau adresă."
    )
    try:
        grounded = _web_generate(prompt, json_mode=True)
        grounded_text = grounded.text
        chunks = grounded.citations
        items = _extract_json_array(grounded_text or "{}")
        data: dict[str, Any] = items[0] if items else {}
        if not data and grounded_text:
            try:
                parsed = json.loads(grounded_text.strip())
                if isinstance(parsed, dict):
                    data = parsed
            except json.JSONDecodeError:
                data = {}

        if not draft.website:
            draft.website = _sanitize_url(str(data.get("website", "") or "").strip())
            if not draft.website:
                draft.website = _sanitize_url(
                    _guess_website_for_name(draft.name, grounded_text, chunks)
                )

        new_address = str(data.get("address", "") or "").strip()
        if new_address and len(new_address) > len(draft.address):
            draft.address = new_address

        if not draft.phone:
            draft.phone = validate_phone(
                str(data.get("phone", "") or "").strip(),
                source_text=grounded_text,
            )
            if not draft.phone:
                draft.phone = _extract_phone_from_text(grounded_text)
        if not draft.contact_person:
            draft.contact_person = str(
                data.get("contactPerson", data.get("contact_person", "")) or ""
            ).strip()
        if len(draft.menu_items) < 15:
            menu = str(data.get("menuItems", data.get("menu_items", "")) or "").strip()
            if menu:
                draft.menu_items = menu
            elif not draft.menu_items:
                draft.menu_items = _guess_menu_for_name(draft.name, grounded_text)
        if not draft.notes:
            draft.notes = str(data.get("notes", "") or "").strip()

        extra_urls = _filter_public_urls(_citation_urls(grounded) + _extract_urls_from_text(grounded_text))
        draft.source_urls = list(dict.fromkeys(draft.source_urls + extra_urls + _citation_urls(grounded)))[:12]
    except Exception as exc:
        logger.warning("Enrich failed for %s: %s", draft.name, exc)


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=2, min=4, max=30))
def research_area(
    locality: str,
    latitude: float,
    longitude: float,
    radius_km: float,
) -> list[BuyerDraft]:
    settings = get_settings()

    search_prompt = (
        f"Caută pe internet afaceri REALE din {locality}, Dobrogea, România "
        f"(rază ~{radius_km:.0f} km în jurul coordonatelor {latitude:.3f}, {longitude:.3f}).\n"
        "Tipuri: restaurante, hoteluri, pensiuni, cafenele, supermarketuri, magazine alimentare, băcănii.\n"
        "Folosește web search și web fetch pentru meniuri/site-uri.\n"
        "Pentru fiecare afacere: nume exact, adresă completă, site, telefon public, meniu, nevoi agricole.\n"
        "NU inventa afaceri.\n\n"
        f"{JSON_SCHEMA_HINT}\n"
        f"Limitează la {settings.max_buyers_per_research} afaceri reale din zona {locality}.\n"
        f"Include doar afaceri din raza de ~{radius_km:.0f} km.\n"
        "Răspunde DOAR cu JSON array valid (fără markdown)."
    )

    grounded = _web_generate(search_prompt, json_mode=True)
    research_text = grounded.text
    grounding_chunks = grounded.citations
    source_urls = _filter_public_urls(_citation_urls(grounded) + _extract_urls_from_text(research_text))

    raw_items = _extract_json_array(research_text or "[]")
    drafts: list[BuyerDraft] = []

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        draft = _parse_buyer_item(
            item,
            locality=locality,
            latitude=latitude,
            longitude=longitude,
            fallback_urls=source_urls,
            research_text=research_text,
            grounding_chunks=grounding_chunks,
        )
        if draft:
            drafts.append(draft)

    validated: list[BuyerDraft] = []
    enrich_limit = min(len(drafts), 4)
    for i, draft in enumerate(drafts):
        if i < enrich_limit:
            _enrich_buyer_details(draft, locality)
            if draft.website and len(draft.menu_items) < 20:
                fetched_menu = _fetch_menu_from_website(draft.name, draft.website)
                if fetched_menu:
                    draft.menu_items = fetched_menu

        draft.phone = validate_phone(draft.phone, source_text=draft.notes or research_text)

        geo = geocode_business(draft.name, draft.address, draft.city or locality)
        if not geo:
            logger.warning("Skipping %s — could not geocode %r", draft.name, draft.address)
            continue

        dist_km = haversine_km(latitude, longitude, geo.latitude, geo.longitude)
        if dist_km > radius_km * 1.3:
            logger.warning(
                "Skipping %s — geocoded %.1f km away (max %.0f): %s",
                draft.name,
                dist_km,
                radius_km,
                geo.label[:80],
            )
            continue

        draft.latitude = geo.latitude
        draft.longitude = geo.longitude
        draft.geocode_provider = geo.provider
        draft.geocode_status = geo.status
        draft.geocode_query = geo.query
        draft.geocode_label = geo.label
        if geo.label and len(draft.address) < 20:
            draft.address = geo.label
        validated.append(draft)

    drafts = validated

    if not drafts:
        raise RuntimeError(f"No real businesses found for {locality}")

    return drafts[: settings.max_buyers_per_research]
