from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Any, Iterable

from app.config import get_settings
from app.db import ensure_area_exists, get_conn, haversine_km, is_area_fresh, mark_area_researched


def init_supplier_schema() -> None:
    settings = get_settings()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS supplier_location (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT '',
                    area_key TEXT NOT NULL,
                    locality TEXT NOT NULL DEFAULT '',
                    address TEXT NOT NULL DEFAULT '',
                    latitude DOUBLE PRECISION NOT NULL,
                    longitude DOUBLE PRECISION NOT NULL,
                    products TEXT[] NOT NULL DEFAULT '{{}}',
                    products_text TEXT NOT NULL DEFAULT '',
                    summary TEXT NOT NULL DEFAULT '',
                    contact TEXT NOT NULL DEFAULT '',
                    source_urls TEXT[] NOT NULL DEFAULT '{{}}',
                    website TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    contact_person TEXT NOT NULL DEFAULT '',
                    notes TEXT NOT NULL DEFAULT '',
                    geocode_provider TEXT NOT NULL DEFAULT '',
                    geocode_status TEXT NOT NULL DEFAULT 'unknown',
                    geocode_query TEXT NOT NULL DEFAULT '',
                    geocode_label TEXT NOT NULL DEFAULT '',
                    geocoded_at TIMESTAMPTZ,
                    embedding vector({settings.embed_dim}),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (area_key, name)
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS venue_supplier_interaction (
                    id TEXT PRIMARY KEY,
                    venue_user_id TEXT NOT NULL,
                    supplier_location_id TEXT NOT NULL REFERENCES supplier_location(id) ON DELETE CASCADE,
                    status TEXT NOT NULL DEFAULT 'shown',
                    rejection_reason TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (venue_user_id, supplier_location_id)
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS supplier_location_area_idx
                ON supplier_location (area_key)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS venue_supplier_interaction_user_idx
                ON venue_supplier_interaction (venue_user_id)
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS supplier_location_embedding_idx
                ON supplier_location USING hnsw (embedding vector_cosine_ops)
                """
            )
        conn.commit()


def make_supplier_id(area_key: str, name: str) -> str:
    digest = hashlib.sha256(f"{area_key}:{name.lower()}".encode()).hexdigest()[:16]
    return f"supplier_{digest}"


def upsert_supplier(
    *,
    area_key: str,
    name: str,
    type: str,
    locality: str,
    address: str,
    latitude: float,
    longitude: float,
    products: list[str],
    products_text: str,
    summary: str,
    contact: str,
    source_urls: list[str],
    embedding: list[float] | None,
    website: str = "",
    phone: str = "",
    contact_person: str = "",
    notes: str = "",
    geocode_provider: str = "",
    geocode_status: str = "unknown",
    geocode_query: str = "",
    geocode_label: str = "",
    geocoded_at: datetime | None = None,
) -> str:
    supplier_id = make_supplier_id(area_key, name)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO supplier_location (
                    id, name, type, area_key, locality, address,
                    latitude, longitude, products, products_text, summary,
                    contact, source_urls, website, phone, contact_person,
                    notes, geocode_provider, geocode_status,
                    geocode_query, geocode_label, geocoded_at, embedding, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, COALESCE(%s, CASE WHEN %s = 'verified' THEN NOW() ELSE NULL END), %s, NOW()
                )
                ON CONFLICT (area_key, name) DO UPDATE SET
                    type = EXCLUDED.type,
                    locality = EXCLUDED.locality,
                    address = EXCLUDED.address,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    products = EXCLUDED.products,
                    products_text = EXCLUDED.products_text,
                    summary = EXCLUDED.summary,
                    contact = EXCLUDED.contact,
                    source_urls = EXCLUDED.source_urls,
                    website = COALESCE(NULLIF(EXCLUDED.website, ''), supplier_location.website),
                    phone = EXCLUDED.phone,
                    contact_person = COALESCE(NULLIF(EXCLUDED.contact_person, ''), supplier_location.contact_person),
                    notes = COALESCE(NULLIF(EXCLUDED.notes, ''), supplier_location.notes),
                    geocode_provider = EXCLUDED.geocode_provider,
                    geocode_status = EXCLUDED.geocode_status,
                    geocode_query = EXCLUDED.geocode_query,
                    geocode_label = EXCLUDED.geocode_label,
                    geocoded_at = EXCLUDED.geocoded_at,
                    embedding = COALESCE(EXCLUDED.embedding, supplier_location.embedding),
                    updated_at = NOW()
                RETURNING id
                """,
                (
                    supplier_id,
                    name,
                    type,
                    area_key,
                    locality,
                    address,
                    latitude,
                    longitude,
                    products,
                    products_text,
                    summary,
                    contact,
                    source_urls,
                    website,
                    phone,
                    contact_person,
                    notes,
                    geocode_provider,
                    geocode_status,
                    geocode_query,
                    geocode_label,
                    geocoded_at,
                    geocode_status,
                    embedding,
                ),
            )
            row = cur.fetchone()
        conn.commit()
    return row["id"] if row else supplier_id


def list_suppliers_in_area(area_key: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM supplier_location WHERE area_key = %s
                AND geocode_status IN ('verified', 'city_center')
                ORDER BY updated_at DESC
                """,
                (area_key,),
            )
            return list(cur.fetchall())


def list_interacted_supplier_ids(venue_user_id: str) -> set[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT supplier_location_id FROM venue_supplier_interaction
                WHERE venue_user_id = %s
                """,
                (venue_user_id,),
            )
            rows = cur.fetchall()
    return {row["supplier_location_id"] for row in rows}


def record_venue_supplier_interaction(
    venue_user_id: str,
    supplier_location_id: str,
    status: str = "shown",
) -> None:
    interaction_id = hashlib.sha256(
        f"{venue_user_id}:{supplier_location_id}".encode()
    ).hexdigest()[:24]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO venue_supplier_interaction (
                    id, venue_user_id, supplier_location_id, status, updated_at
                ) VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (venue_user_id, supplier_location_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    updated_at = NOW()
                """,
                (interaction_id, venue_user_id, supplier_location_id, status),
            )
        conn.commit()


def list_venue_suppliers(venue_user_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.*, i.status AS interaction_status
                FROM venue_supplier_interaction i
                JOIN supplier_location s ON s.id = i.supplier_location_id
                WHERE i.venue_user_id = %s
                  AND s.geocode_status IN ('verified', 'city_center')
                ORDER BY i.updated_at DESC
                """,
                (venue_user_id,),
            )
            return list(cur.fetchall())


def search_suppliers_by_vector(
    *,
    embedding: list[float],
    latitude: float,
    longitude: float,
    range_km: float,
    exclude_ids: Iterable[str],
    limit: int = 20,
) -> list[dict[str, Any]]:
    exclude = list(exclude_ids)
    lat_delta = range_km / 111.0
    lon_delta = range_km / (111.0 * max(math.cos(math.radians(latitude)), 0.2))

    exclude_clause = ""
    params: list[Any] = [
        embedding,
        latitude - lat_delta,
        latitude + lat_delta,
        longitude - lon_delta,
        longitude + lon_delta,
    ]
    if exclude:
        exclude_clause = "AND id NOT IN (SELECT UNNEST(%s::text[]))"
        params.append(exclude)
    params.extend([embedding, limit])

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT *,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM supplier_location
                WHERE embedding IS NOT NULL
                  AND geocode_status IN ('verified', 'city_center')
                  AND latitude BETWEEN %s AND %s
                  AND longitude BETWEEN %s AND %s
                  {exclude_clause}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                tuple(params),
            )
            return list(cur.fetchall())


def supplier_area_has_data(area_key: str) -> bool:
    return len(list_suppliers_in_area(area_key)) > 0


def mark_supplier_area_researched(
    area_key: str,
    latitude: float,
    longitude: float,
    radius_km: float,
) -> None:
    ensure_area_exists(area_key, latitude, longitude, radius_km)
    mark_area_researched(area_key, latitude, longitude, radius_km)


def is_supplier_area_fresh(area_key: str) -> bool:
    return is_area_fresh(area_key)
