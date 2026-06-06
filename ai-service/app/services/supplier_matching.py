from __future__ import annotations

import logging
from typing import Any

from app import db_suppliers
from app.config import get_settings
from app.db import make_area_key
from app.gemini import embed
from app.services.supplier_discovery import ensure_suppliers_researched
from app.taxonomy import needs_to_text, normalize_producer_products, overlap_score

logger = logging.getLogger(__name__)


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


def _build_supplier_dto(
    row: dict[str, Any],
    *,
    latitude: float,
    longitude: float,
    venue_needs: list[str],
    venue_business_name: str,
    similarity: float = 0.0,
) -> dict[str, Any]:
    supplier_products: list[str] = list(row.get("products") or [])
    overlap = overlap_score(venue_needs, supplier_products)
    distance_km = db_suppliers.haversine_km(
        latitude, longitude, row["latitude"], row["longitude"]
    )
    matched = [n for n in venue_needs if n in set(supplier_products)]
    matched_label = needs_to_text(matched) if matched else needs_to_text(supplier_products[:3])

    contact_raw = (row.get("contact") or "").strip()
    if contact_raw.lower() in {"", "n/a", "na", "unknown", "none", "null"}:
        venue_label = venue_business_name.strip() or "localul nostru"
        contact_raw = (
            f"Bună ziua, sunt de la {venue_label}. Căutăm {needs_to_text(venue_needs)} "
            f"pentru aprovizionare în Dobrogea. Ce aveți disponibil și la ce preț puteți livra?"
        )

    match_score = int(
        min(99, max(55, 60 + overlap * 30 + similarity * 10 - min(15, distance_km / 5)))
    )

    website = row.get("website") or ""
    source_urls = list(row.get("source_urls") or [])[:8]
    if not website.strip() and source_urls:
        website = source_urls[0]

    products_text = row.get("products_text") or needs_to_text(supplier_products)
    sell_parts = products_text
    if row.get("notes"):
        sell_parts = f"{products_text}. {row['notes']}"

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row.get("type") or "producător local",
        "location": row.get("address") or row.get("locality") or "",
        "distance": f"{round(distance_km)} km",
        "match": match_score,
        "reason": row.get("summary") or f"Producător local care oferă {products_text}.",
        "sell": sell_parts,
        "bestDay": "De confirmat telefonic",
        "contact": contact_raw,
        "tone": "direct, potrivit pentru o primă comandă locală",
        "icon": "shop",
        "coordinates": [row["latitude"], row["longitude"]],
        "needs": supplier_products,
        "matchedNeeds": matched,
        "website": website,
        "phone": row.get("phone") or "",
        "contactPerson": row.get("contact_person") or "",
        "menuItems": products_text,
        "notes": row.get("notes") or row.get("summary") or "",
        "sourceUrls": source_urls,
        "fromCache": True,
    }


def discover_suppliers(
    *,
    user_id: str,
    products_needed: list[str],
    locality: str,
    latitude: float,
    longitude: float,
    range_km: float,
    limit: int = 5,
    force_refresh: bool = False,
    venue_business_name: str = "",
) -> dict[str, Any]:
    settings = get_settings()
    venue_needs = normalize_producer_products(products_needed)
    if not venue_needs:
        venue_needs = normalize_producer_products(["produse locale"])

    area_key = ensure_suppliers_researched(
        locality=locality or "Dobrogea",
        latitude=latitude,
        longitude=longitude,
        radius_km=range_km,
        products_needed=venue_needs,
        force_refresh=force_refresh,
        venue_user_id=user_id,
        target_count=max(limit * 2, limit + 2),
    )

    exclude = db_suppliers.list_interacted_supplier_ids(user_id)
    venue_query = f"Local HoReCa din {locality}. Caută: {needs_to_text(venue_needs)}."

    rows: list[dict[str, Any]] = []
    if settings.llm_enabled:
        try:
            query_embedding = embed(venue_query)
            rows = db_suppliers.search_suppliers_by_vector(
                embedding=query_embedding,
                latitude=latitude,
                longitude=longitude,
                range_km=range_km,
                exclude_ids=exclude,
                limit=limit * 2,
            )
        except Exception as exc:
            logger.warning("Supplier vector search failed: %s", exc)

    if not rows:
        area_rows = db_suppliers.list_suppliers_in_area(area_key)
        rows = [r for r in area_rows if r["id"] not in exclude]

    leads: list[dict[str, Any]] = []
    for row in rows:
        if row["id"] in exclude:
            continue
        distance_km = db_suppliers.haversine_km(
            latitude, longitude, row["latitude"], row["longitude"]
        )
        if distance_km > range_km:
            continue
        supplier_products = list(row.get("products") or [])
        if venue_needs and not overlap_score(venue_needs, supplier_products):
            continue
        similarity = float(row.get("similarity") or 0.0)
        leads.append(
            _build_supplier_dto(
                row,
                latitude=latitude,
                longitude=longitude,
                venue_needs=venue_needs,
                venue_business_name=venue_business_name,
                similarity=similarity,
            )
        )

    leads.sort(key=lambda item: (-item["match"], float(item["distance"].replace(" km", ""))))
    leads = leads[:limit]

    for lead in leads:
        db_suppliers.record_venue_supplier_interaction(user_id, lead["id"], "shown")

    return {
        "producers": leads,
        "areaKey": area_key,
        "fromCache": db_suppliers.is_supplier_area_fresh(area_key),
        "venueNeeds": venue_needs,
    }


def list_discovered_suppliers(
    user_id: str,
    latitude: float,
    longitude: float,
    venue_business_name: str = "",
) -> list[dict[str, Any]]:
    rows = db_suppliers.list_venue_suppliers(user_id)
    leads: list[dict[str, Any]] = []
    for row in rows:
        lead = _build_supplier_dto(
            row,
            latitude=latitude,
            longitude=longitude,
            venue_needs=list(row.get("products") or []),
            venue_business_name=venue_business_name,
        )
        api_status = _map_status_to_api(row.get("interaction_status"))
        if api_status:
            lead["status"] = api_status
        leads.append(lead)
    return leads


def update_supplier_status(
    user_id: str,
    supplier_id: str,
    status: str,
    reason: str | None = None,
) -> dict[str, str]:
    status_map = {
        "Bun": "good",
        "Nu e potrivit": "not_relevant",
        "Contactat": "contacted",
        "A răspuns": "responded",
        "A cumpărat": "bought",
    }
    db_status = status_map.get(status, "shown")
    db_suppliers.record_venue_supplier_interaction(user_id, supplier_id, db_status)
    return {"producerUserId": supplier_id, "status": status}
