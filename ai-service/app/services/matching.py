from __future__ import annotations

import logging
from typing import Any

from app import db
from app.config import get_settings
from app.gemini import embed
from app.services.compatibility import buyer_is_compatible_with_producer
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

    exclude_base = db.list_interacted_buyer_ids(user_id)

    # Smart re-surface: if a not_relevant lead's needs now overlap with current
    # producer products, lift the exclusion so it can reappear
    exclude = _apply_smart_resurface(user_id, exclude_base, producer_needs)

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
                limit=limit * 4,
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
        if not buyer_is_compatible_with_producer(
            name=str(row.get("name") or ""),
            business_type=str(row.get("type") or ""),
            producer_needs=producer_needs,
            buyer_needs=buyer_needs,
            summary=str(row.get("summary") or ""),
            menu_items=str(row.get("menu_items") or ""),
            notes=str(row.get("notes") or ""),
        ):
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


def list_discovered_leads(
    user_id: str,
    latitude: float,
    longitude: float,
    *,
    products: list[str] | None = None,
) -> list[dict[str, Any]]:
    rows = db.list_producer_buyers(user_id)
    producer_needs = normalize_producer_products(products or [])
    leads: list[dict[str, Any]] = []
    for row in rows:
        buyer_needs = list(row.get("needs") or [])
        if not buyer_is_compatible_with_producer(
            name=str(row.get("name") or ""),
            business_type=str(row.get("type") or ""),
            producer_needs=producer_needs or buyer_needs,
            buyer_needs=buyer_needs,
            summary=str(row.get("summary") or ""),
            menu_items=str(row.get("menu_items") or ""),
            notes=str(row.get("notes") or ""),
        ):
            continue
        lead = _build_lead_dto(
            row,
            latitude=latitude,
            longitude=longitude,
            producer_needs=producer_needs or buyer_needs,
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
        "Ceva n-a mers": "not_relevant",
    }
    db_status = status_map.get(status, "shown")
    db.record_interaction(user_id, buyer_id, db_status, reason=reason or "")

    stored_labels: list[str] = []
    if db_status == "not_relevant" and reason:
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


def _apply_smart_resurface(
    user_id: str,
    exclude_ids: set[str],
    current_producer_needs: list[str],
) -> set[str]:
    """Remove from the exclusion set any 'not_relevant' leads whose needs
    now overlap with the producer's current products.
    This lets a restaurant that needed goat cheese resurface if the producer
    starts selling goat cheese, even if they were rejected before for a
    different incompatibility.
    """
    if not exclude_ids or not current_producer_needs:
        return exclude_ids

    try:
        not_relevant = db.list_not_relevant_with_reasons(user_id)
    except Exception as exc:
        logger.warning("smart_resurface: could not load not_relevant list: %s", exc)
        return exclude_ids

    resurfaced: set[str] = set()
    for row in not_relevant:
        buyer_id = row["buyer_location_id"]
        if buyer_id not in exclude_ids:
            continue
        buyer_needs: list[str] = list(row.get("needs") or [])
        if not buyer_needs:
            continue
        # If buyer's needs now overlap with producer's current products, resurface
        if overlap_score(buyer_needs, current_producer_needs) > 0:
            reason = (row.get("rejection_reason") or "").lower()
            # Only resurface if rejection wasn't about non-product factors
            non_product_signals = ["pret", "livrare", "zile", "exclusiv", "contract", "departe", "km"]
            if not any(sig in reason for sig in non_product_signals):
                resurfaced.add(buyer_id)
                logger.info("Smart resurface: %s (current needs now match producer products)", buyer_id)

    return exclude_ids - resurfaced
