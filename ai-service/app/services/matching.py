from __future__ import annotations

import logging
from typing import Any

from app import db
from app.config import get_settings
from app.gemini import embed
from app.services.discovery import ensure_area_researched
from app.taxonomy import normalize_producer_products, needs_to_text, overlap_score

logger = logging.getLogger(__name__)

ICON_BY_TYPE = {
    "restaurant": "restaurant",
    "hotel": "hotel",
    "cafe": "cafe",
    "cafenea": "cafe",
    "shop": "shop",
    "magazin": "shop",
    "deli": "deli",
    "băcănie": "deli",
    "bacanie": "deli",
}


def _guess_icon(business_type: str) -> str:
    lower = business_type.lower()
    for key, icon in ICON_BY_TYPE.items():
        if key in lower:
            return icon
    return "shop"


def _map_status_to_api(status: str | None) -> str | None:
    mapping = {
        "shown": None,
        "contacted": "Contactat",
        "responded": "A răspuns",
        "bought": "A cumpărat",
        "not_relevant": "Nu e potrivit",
        "good": "Bun",
    }
    if not status:
        return None
    return mapping.get(status, None)


def _build_lead_dto(
    row: dict[str, Any],
    *,
    latitude: float,
    longitude: float,
    producer_needs: list[str],
    similarity: float = 0.0,
) -> dict[str, Any]:
    buyer_needs: list[str] = list(row.get("needs") or [])
    overlap = overlap_score(buyer_needs, producer_needs)
    distance_km = db.haversine_km(latitude, longitude, row["latitude"], row["longitude"])
    matched_needs = [n for n in producer_needs if n in set(buyer_needs)]
    matched_label = needs_to_text(matched_needs) if matched_needs else needs_to_text(buyer_needs[:3])

    contact_raw = (row.get("contact") or "").strip()
    if contact_raw.lower() in {"", "n/a", "na", "unknown", "none", "null"}:
        contact_raw = (
            f"Bună ziua, sunt producător local și am văzut informațiile despre {row['name']}. "
            f"Aș dori să vă propun produse locale — pot trimite cantități și prețuri dacă vă ajută."
        )

    # Distance is a minor factor — product overlap and semantic similarity are primary
    match_score = int(
        min(
            99,
            max(
                55,
                60 + overlap * 45 + similarity * 20 - min(5, distance_km / 20),
            ),
        )
    )

    website = row.get("website") or ""
    source_urls = list(row.get("source_urls") or [])[:8]
    if not website.strip() and source_urls:
        website = source_urls[0]

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "location": row.get("address") or row.get("locality") or "",
        "distance": f"{round(distance_km)} km",
        "match": match_score,
        "reason": row.get("summary") or f"Ar putea avea nevoie de {needs_to_text(buyer_needs)}.",
        "sell": f"Potrivire pentru: {matched_label}. Nevoile estimate: {row.get('needs_text') or needs_to_text(buyer_needs)}.",
        "bestDay": "Marți sau miercuri dimineața, înainte de aprovizionare.",
        "contact": contact_raw,
        "tone": "cald, scurt, fără presiune",
        "icon": _guess_icon(row.get("type", "")),
        "coordinates": [row["latitude"], row["longitude"]],
        "needs": buyer_needs,
        "matchedNeeds": matched_needs,
        "website": website,
        "phone": row.get("phone") or "",
        "contactPerson": row.get("contact_person") or "",
        "menuItems": row.get("menu_items") or "",
        "notes": row.get("notes") or row.get("summary") or "",
        "sourceUrls": source_urls,
        "fromCache": True,
    }


def discover_leads(
    *,
    user_id: str,
    products: list[str],
    locality: str,
    latitude: float,
    longitude: float,
    range_km: float,
    limit: int = 3,
    force_refresh: bool = False,
    discover_more: bool = False,
) -> dict[str, Any]:
    settings = get_settings()
    producer_needs = normalize_producer_products(products)
    if not producer_needs:
        producer_needs = normalize_producer_products(["produse locale"])

    area_key = ensure_area_researched(
        locality=locality or "Dobrogea",
        latitude=latitude,
        longitude=longitude,
        radius_km=range_km,
        force_refresh=force_refresh,
        discover_more=discover_more,
        user_id=user_id,
        products=products,
        target_count=max(limit * 2, limit + 2),
    )

    exclude = db.list_interacted_buyer_ids(user_id)
    producer_query = f"Producător local din {locality}. Vinde: {needs_to_text(producer_needs)}."

    rows: list[dict[str, Any]] = []
    if settings.gemini_enabled:
        try:
            query_embedding = embed(producer_query)
            rows = db.search_buyers_by_vector(
                embedding=query_embedding,
                latitude=latitude,
                longitude=longitude,
                range_km=range_km,
                exclude_ids=exclude,
                limit=limit * 2,
            )
        except Exception as exc:
            logger.warning("Vector search failed: %s", exc)

    if not rows:
        area_rows = db.list_buyers_in_area(area_key)
        rows = [r for r in area_rows if r["id"] not in exclude]

    leads: list[dict[str, Any]] = []
    for row in rows:
        if row["id"] in exclude:
            continue
        distance_km = db.haversine_km(latitude, longitude, row["latitude"], row["longitude"])
        if distance_km > range_km:
            continue
        similarity = float(row.get("similarity") or 0.0)
        buyer_needs = list(row.get("needs") or [])
        if producer_needs and not overlap_score(buyer_needs, producer_needs):
            continue
        leads.append(
            _build_lead_dto(
                row,
                latitude=latitude,
                longitude=longitude,
                producer_needs=producer_needs,
                similarity=similarity,
            )
        )

    # Sort by match score first, then by product overlap (not distance)
    leads.sort(key=lambda item: (-item["match"], -len(item.get("matchedNeeds", []))))
    leads = leads[:limit]

    for lead in leads:
        db.record_interaction(user_id, lead["id"], "shown")

    return {
        "leads": leads,
        "areaKey": area_key,
        "fromCache": db.is_area_fresh(area_key),
        "producerNeeds": producer_needs,
    }


def list_discovered_leads(user_id: str, latitude: float, longitude: float) -> list[dict[str, Any]]:
    rows = db.list_producer_buyers(user_id)
    leads: list[dict[str, Any]] = []
    for row in rows:
        lead = _build_lead_dto(
            row,
            latitude=latitude,
            longitude=longitude,
            producer_needs=list(row.get("needs") or []),
        )
        api_status = _map_status_to_api(row.get("interaction_status"))
        if api_status:
            lead["status"] = api_status
        leads.append(lead)
    return leads


def update_buyer_status(user_id: str, buyer_id: str, status: str, reason: str | None = None) -> dict[str, str]:
    status_map = {
        "Bun": "good",
        "Nu e potrivit": "not_relevant",
        "Contactat": "contacted",
        "A răspuns": "responded",
        "A cumpărat": "bought",
    }
    db_status = status_map.get(status, "shown")
    db.record_interaction(user_id, buyer_id, db_status)

    stored_labels: list[str] = []
    if status == "Nu e potrivit" and reason:
        from app.services.preferences import process_rejection

        buyer = db.get_buyer_by_id(buyer_id)
        stored_labels = process_rejection(
            user_id=user_id,
            buyer_id=buyer_id,
            reason=reason,
            buyer_name=str(buyer.get("name") if buyer else ""),
            buyer_type=str(buyer.get("type") if buyer else ""),
        )

    result: dict[str, str] = {"leadId": buyer_id, "status": status}
    if stored_labels:
        result["storedPreferences"] = ", ".join(stored_labels)
    return result
