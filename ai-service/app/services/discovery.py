from __future__ import annotations

import logging

from app import db
from app.agent.discovery_graph import run_discovery_graph
from app.config import get_settings
from app.gemini import BuyerDraft, embed
from app.taxonomy import needs_to_text, normalize_producer_products

logger = logging.getLogger(__name__)


def _persist_drafts(
    *,
    area_key: str,
    locality: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    drafts: list[BuyerDraft],
) -> int:
    settings = get_settings()
    db.ensure_area_exists(area_key, latitude, longitude, radius_km)
    persisted = 0

    for draft in drafts:
        if draft.geocode_status != "verified":
            logger.warning("Skipping %s — geocode was not verified", draft.name)
            continue

        needs_text = needs_to_text(draft.needs)
        embedding = None
        if settings.llm_enabled:
            try:
                embed_input = (
                    f"{draft.name} {draft.type} {draft.menu_items} "
                    f"needs: {needs_text}. {draft.summary} {draft.notes}"
                )
                embedding = embed(embed_input)
            except Exception as exc:
                logger.warning("Embedding failed for %s: %s", draft.name, exc)

        db.upsert_buyer(
            area_key=area_key,
            name=draft.name,
            type=draft.type,
            locality=draft.city or locality,
            address=draft.address,
            latitude=draft.latitude,
            longitude=draft.longitude,
            needs=draft.needs,
            needs_text=needs_text,
            summary=draft.summary,
            contact=draft.contact,
            source_urls=draft.source_urls,
            website=draft.website,
            phone=draft.phone,
            contact_person=draft.contact_person,
            menu_items=draft.menu_items,
            notes=draft.notes,
            geocode_provider=draft.geocode_provider,
            geocode_status=draft.geocode_status,
            geocode_query=draft.geocode_query,
            geocode_label=draft.geocode_label,
            embedding=embedding,
        )
        persisted += 1

    if persisted:
        db.mark_area_researched(area_key, latitude, longitude, radius_km)
    return persisted


def ensure_area_researched(
    *,
    locality: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    force_refresh: bool = False,
    discover_more: bool = False,
    user_id: str | None = None,
    products: list[str] | None = None,
    target_count: int | None = None,
) -> str:
    settings = get_settings()
    area_key = db.make_area_key(locality, latitude, longitude)
    producer_needs = normalize_producer_products(products or [])
    requested_count = max(1, min(target_count or settings.max_buyers_per_research, settings.max_buyers_per_research))

    exclude_names: list[str] = []
    avoid_labels: list[str] = []
    if user_id:
        avoid_labels = db.list_producer_preference_labels(user_id)
    if discover_more and user_id:
        exclude_names = [row["name"] for row in db.list_producer_buyers(user_id)]

    cache_eligible = (
        not force_refresh
        and not discover_more
        and db.is_area_fresh(area_key)
        and db.area_has_rich_data(area_key)
        and db.area_has_geocoded_data(area_key, latitude, longitude, radius_km)
    )
    if cache_eligible:
        logger.info("Area cache hit for %s (rich data)", area_key)
        return area_key

    logger.info(
        "Researching area %s via LangGraph agent (discover_more=%s)",
        area_key,
        discover_more,
    )
    drafts: list[BuyerDraft]

    try:
        if not settings.llm_enabled:
            raise RuntimeError("OPEN_ROUTER_KEY not configured")
        drafts = run_discovery_graph(
            locality=locality,
            latitude=latitude,
            longitude=longitude,
            range_km=radius_km,
            producer_needs=producer_needs,
            exclude_names=exclude_names,
            avoid_labels=avoid_labels,
            target_count=requested_count,
        )
    except Exception as exc:
        cached = db.list_buyers_in_area(area_key)
        if cached:
            logger.warning(
                "Research failed (%s) — reusing %d cached buyers for %s",
                exc,
                len(cached),
                area_key,
            )
            return area_key
        raise

    if not drafts and discover_more:
        logger.info("No new buyers found for discover_more in %s", area_key)
        return area_key

    _persist_drafts(
        area_key=area_key,
        locality=locality,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        drafts=drafts,
    )
    return area_key
