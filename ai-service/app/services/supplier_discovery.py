from __future__ import annotations

import logging

from app import db_suppliers
from app.agent.supplier_discovery_graph import SupplierDraft, run_supplier_discovery_graph
from app.config import get_settings
from app.db import make_area_key
from app.gemini import embed
from app.taxonomy import needs_to_text, normalize_producer_products

logger = logging.getLogger(__name__)


def _persist_supplier_drafts(
    *,
    area_key: str,
    locality: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    drafts: list[SupplierDraft],
) -> int:
    settings = get_settings()
    db_suppliers.ensure_area_exists(area_key, latitude, longitude, radius_km)
    persisted = 0

    for draft in drafts:
        if draft.geocode_status not in {"verified", "city_center"}:
            continue

        products_text = needs_to_text(draft.products)
        embedding = None
        if settings.llm_enabled:
            try:
                embed_input = (
                    f"{draft.name} {draft.type} {products_text} "
                    f"{draft.summary} {draft.notes}"
                )
                embedding = embed(embed_input)
            except Exception as exc:
                logger.warning("Supplier embedding failed for %s: %s", draft.name, exc)

        db_suppliers.upsert_supplier(
            area_key=area_key,
            name=draft.name,
            type=draft.type,
            locality=draft.city or locality,
            address=draft.address,
            latitude=draft.latitude,
            longitude=draft.longitude,
            products=draft.products,
            products_text=products_text,
            summary=draft.summary,
            contact=draft.contact,
            source_urls=draft.source_urls,
            website=draft.website,
            phone=draft.phone,
            contact_person=draft.contact_person,
            notes=draft.notes,
            geocode_provider=draft.geocode_provider,
            geocode_status=draft.geocode_status,
            geocode_query=draft.geocode_query,
            geocode_label=draft.geocode_label,
            embedding=embedding,
        )
        persisted += 1

    if persisted:
        db_suppliers.mark_supplier_area_researched(area_key, latitude, longitude, radius_km)
    return persisted


def ensure_suppliers_researched(
    *,
    locality: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    products_needed: list[str] | None = None,
    force_refresh: bool = False,
    venue_user_id: str | None = None,
    target_count: int | None = None,
) -> str:
    settings = get_settings()
    area_key = make_area_key(locality, latitude, longitude)
    venue_needs = normalize_producer_products(products_needed or ["produse locale"])
    requested_count = max(1, min(target_count or settings.max_buyers_per_research, 8))

    exclude_names: list[str] = []
    if venue_user_id:
        exclude_names = [row["name"] for row in db_suppliers.list_venue_suppliers(venue_user_id)]

    existing_suppliers = db_suppliers.list_suppliers_in_area(area_key)
    has_any_data = len(existing_suppliers) > 0

    # Use cached data if any suppliers exist AND TTL is still valid
    cache_eligible = (
        not force_refresh
        and has_any_data
        and db_suppliers.is_supplier_area_fresh(area_key)
    )
    if cache_eligible:
        logger.info("Supplier cache hit for %s (%d suppliers)", area_key, len(existing_suppliers))
        return area_key

    # If area has data but TTL expired, still reuse it (weekly TTL handles auto-refresh)
    if has_any_data and not force_refresh:
        logger.info("Supplier area %s: TTL expired but has %d suppliers — reusing cache", area_key, len(existing_suppliers))
        return area_key

    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    drafts = run_supplier_discovery_graph(
        locality=locality,
        latitude=latitude,
        longitude=longitude,
        range_km=radius_km,
        venue_needs=venue_needs,
        exclude_names=exclude_names,
        target_count=requested_count,
    )

    _persist_supplier_drafts(
        area_key=area_key,
        locality=locality,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        drafts=drafts,
    )
    return area_key
