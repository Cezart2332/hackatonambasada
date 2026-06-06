from __future__ import annotations

import hashlib
import math
import re
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Generator, Iterable

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None


@dataclass
class BuyerRow:
    id: str
    name: str
    type: str
    area_key: str
    locality: str
    address: str
    latitude: float
    longitude: float
    needs: list[str]
    needs_text: str
    summary: str
    contact: str
    source_urls: list[str]
    geocode_provider: str = ""
    geocode_status: str = "unknown"
    geocode_query: str = ""
    geocode_label: str = ""
    geocoded_at: datetime | None = None


def make_area_key(locality: str, latitude: float, longitude: float) -> str:
    norm_locality = re.sub(r"\s+", "-", locality.lower().strip())[:40] or "dobrogea"
    grid_lat = round(latitude, 1)
    grid_lon = round(longitude, 1)
    return f"{norm_locality}:{grid_lat}:{grid_lon}"


def make_buyer_id(area_key: str, name: str) -> str:
    digest = hashlib.sha256(f"{area_key}:{name.lower()}".encode()).hexdigest()[:16]
    return f"buyer_{digest}"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            conninfo=settings.psycopg_database_url,
            min_size=1,
            max_size=8,
            kwargs={"row_factory": dict_row},
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    pool = get_pool()
    with pool.connection() as conn:
        register_vector(conn)
        yield conn


def init_schema() -> None:
    settings = get_settings()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS buyer_location (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT '',
                    area_key TEXT NOT NULL,
                    locality TEXT NOT NULL DEFAULT '',
                    address TEXT NOT NULL DEFAULT '',
                    latitude DOUBLE PRECISION NOT NULL,
                    longitude DOUBLE PRECISION NOT NULL,
                    needs TEXT[] NOT NULL DEFAULT '{{}}',
                    needs_text TEXT NOT NULL DEFAULT '',
                    summary TEXT NOT NULL DEFAULT '',
                    contact TEXT NOT NULL DEFAULT '',
                    source_urls TEXT[] NOT NULL DEFAULT '{{}}',
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
                CREATE TABLE IF NOT EXISTS area_research (
                    area_key TEXT PRIMARY KEY,
                    latitude DOUBLE PRECISION NOT NULL,
                    longitude DOUBLE PRECISION NOT NULL,
                    radius_km DOUBLE PRECISION NOT NULL DEFAULT 35,
                    researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS producer_buyer_interaction (
                    id TEXT PRIMARY KEY,
                    producer_user_id TEXT NOT NULL,
                    buyer_location_id TEXT NOT NULL REFERENCES buyer_location(id) ON DELETE CASCADE,
                    status TEXT NOT NULL DEFAULT 'shown',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (producer_user_id, buyer_location_id)
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS buyer_location_area_idx
                ON buyer_location (area_key)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS producer_buyer_interaction_user_idx
                ON producer_buyer_interaction (producer_user_id)
                """
            )
            cur.execute(
                f"""
                CREATE INDEX IF NOT EXISTS buyer_location_embedding_idx
                ON buyer_location USING hnsw (embedding vector_cosine_ops)
                """
            )
            for col, col_type in [
                ("website", "TEXT NOT NULL DEFAULT ''"),
                ("phone", "TEXT NOT NULL DEFAULT ''"),
                ("contact_person", "TEXT NOT NULL DEFAULT ''"),
                ("menu_items", "TEXT NOT NULL DEFAULT ''"),
                ("notes", "TEXT NOT NULL DEFAULT ''"),
                ("geocode_provider", "TEXT NOT NULL DEFAULT ''"),
                ("geocode_status", "TEXT NOT NULL DEFAULT 'unknown'"),
                ("geocode_query", "TEXT NOT NULL DEFAULT ''"),
                ("geocode_label", "TEXT NOT NULL DEFAULT ''"),
                ("geocoded_at", "TIMESTAMPTZ"),
            ]:
                cur.execute(
                    f"ALTER TABLE buyer_location ADD COLUMN IF NOT EXISTS {col} {col_type}"
                )
            cur.execute(
                """
                ALTER TABLE producer_buyer_interaction
                ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT ''
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS producer_preference (
                    id TEXT PRIMARY KEY,
                    producer_user_id TEXT NOT NULL,
                    signal_type TEXT NOT NULL DEFAULT 'avoid',
                    label TEXT NOT NULL DEFAULT '',
                    detail TEXT NOT NULL DEFAULT '',
                    source_buyer_id TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS producer_preference_user_idx
                ON producer_preference (producer_user_id)
                """
            )
            _apply_cascade_fks(cur)
        conn.commit()


def _apply_cascade_fks(cur: psycopg.Cursor) -> None:
    """Ensure FK cascades so DBeaver/manual deletes clean up related AI rows."""
    cur.execute(
        """
        INSERT INTO area_research (area_key, latitude, longitude, radius_km, researched_at)
        SELECT DISTINCT b.area_key, b.latitude, b.longitude, 35, '1970-01-01'::timestamptz
        FROM buyer_location b
        WHERE NOT EXISTS (
            SELECT 1 FROM area_research a WHERE a.area_key = b.area_key
        )
        """
    )
    cur.execute(
        """
        DELETE FROM producer_buyer_interaction p
        WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = p.producer_user_id)
        """
    )
    cur.execute(
        """
        DO $$ BEGIN
            ALTER TABLE buyer_location
            ADD CONSTRAINT buyer_location_area_key_fkey
            FOREIGN KEY (area_key) REFERENCES area_research(area_key)
            ON DELETE CASCADE;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    cur.execute(
        """
        DO $$ BEGIN
            ALTER TABLE producer_buyer_interaction
            ADD CONSTRAINT producer_buyer_interaction_user_fkey
            FOREIGN KEY (producer_user_id) REFERENCES "user"(id)
            ON DELETE CASCADE;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )


def area_has_rich_data(area_key: str) -> bool:
    buyers = list_buyers_in_area(area_key)
    if not buyers:
        return False
    rich = sum(
        1
        for b in buyers
        if (b.get("website") or "").strip() or (b.get("menu_items") or "").strip()
    )
    return rich >= max(1, len(buyers) // 2)


def area_has_geocoded_data(
    area_key: str,
    center_lat: float,
    center_lon: float,
    radius_km: float,
) -> bool:
    buyers = list_buyers_in_area(area_key)
    if not buyers:
        return False

    coord_buckets: set[tuple[float, float]] = set()
    in_range = 0
    for buyer in buyers:
        if (buyer.get("geocode_status") or "unknown") != "verified":
            continue
        lat = float(buyer["latitude"])
        lon = float(buyer["longitude"])
        dist = haversine_km(center_lat, center_lon, lat, lon)
        if 0.05 < dist <= radius_km * 1.35:
            in_range += 1
        coord_buckets.add((round(lat, 3), round(lon, 3)))

    if in_range < max(1, len(buyers) // 3):
        return False
    if len(coord_buckets) < min(2, len(buyers)):
        return False
    return True


def get_area_research(area_key: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM area_research WHERE area_key = %s",
                (area_key,),
            )
            return cur.fetchone()


def is_area_fresh(area_key: str) -> bool:
    row = get_area_research(area_key)
    if not row:
        return False
    settings = get_settings()
    researched_at: datetime = row["researched_at"]
    if researched_at.tzinfo is None:
        researched_at = researched_at.replace(tzinfo=timezone.utc)
    ttl = timedelta(days=settings.area_cache_ttl_days)
    return datetime.now(timezone.utc) - researched_at < ttl


def ensure_area_exists(
    area_key: str,
    latitude: float,
    longitude: float,
    radius_km: float,
) -> None:
    """Create area row before buyers so FK cascade chain is valid."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO area_research (area_key, latitude, longitude, radius_km, researched_at)
                VALUES (%s, %s, %s, %s, '1970-01-01'::timestamptz)
                ON CONFLICT (area_key) DO NOTHING
                """,
                (area_key, latitude, longitude, radius_km),
            )
        conn.commit()


def mark_area_researched(
    area_key: str,
    latitude: float,
    longitude: float,
    radius_km: float,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO area_research (area_key, latitude, longitude, radius_km, researched_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (area_key) DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    radius_km = EXCLUDED.radius_km,
                    researched_at = NOW()
                """,
                (area_key, latitude, longitude, radius_km),
            )
        conn.commit()


def upsert_buyer(
    *,
    area_key: str,
    name: str,
    type: str,
    locality: str,
    address: str,
    latitude: float,
    longitude: float,
    needs: list[str],
    needs_text: str,
    summary: str,
    contact: str,
    source_urls: list[str],
    embedding: list[float] | None,
    website: str = "",
    phone: str = "",
    contact_person: str = "",
    menu_items: str = "",
    notes: str = "",
    geocode_provider: str = "",
    geocode_status: str = "unknown",
    geocode_query: str = "",
    geocode_label: str = "",
    geocoded_at: datetime | None = None,
) -> str:
    buyer_id = make_buyer_id(area_key, name)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO buyer_location (
                    id, name, type, area_key, locality, address,
                    latitude, longitude, needs, needs_text, summary,
                    contact, source_urls, website, phone, contact_person,
                    menu_items, notes, geocode_provider, geocode_status,
                    geocode_query, geocode_label, geocoded_at, embedding, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, COALESCE(%s, CASE WHEN %s = 'verified' THEN NOW() ELSE NULL END), %s, NOW()
                )
                ON CONFLICT (area_key, name) DO UPDATE SET
                    type = EXCLUDED.type,
                    locality = EXCLUDED.locality,
                    address = EXCLUDED.address,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    needs = EXCLUDED.needs,
                    needs_text = EXCLUDED.needs_text,
                    summary = EXCLUDED.summary,
                    contact = EXCLUDED.contact,
                    source_urls = EXCLUDED.source_urls,
                    website = COALESCE(NULLIF(EXCLUDED.website, ''), buyer_location.website),
                    phone = EXCLUDED.phone,
                    contact_person = COALESCE(NULLIF(EXCLUDED.contact_person, ''), buyer_location.contact_person),
                    menu_items = COALESCE(NULLIF(EXCLUDED.menu_items, ''), buyer_location.menu_items),
                    notes = COALESCE(NULLIF(EXCLUDED.notes, ''), buyer_location.notes),
                    geocode_provider = EXCLUDED.geocode_provider,
                    geocode_status = EXCLUDED.geocode_status,
                    geocode_query = EXCLUDED.geocode_query,
                    geocode_label = EXCLUDED.geocode_label,
                    geocoded_at = EXCLUDED.geocoded_at,
                    embedding = COALESCE(EXCLUDED.embedding, buyer_location.embedding),
                    updated_at = NOW()
                RETURNING id
                """,
                (
                    buyer_id,
                    name,
                    type,
                    area_key,
                    locality,
                    address,
                    latitude,
                    longitude,
                    needs,
                    needs_text,
                    summary,
                    contact,
                    source_urls,
                    website,
                    phone,
                    contact_person,
                    menu_items,
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
    return row["id"] if row else buyer_id


def list_interacted_buyer_ids(producer_user_id: str) -> set[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT buyer_location_id FROM producer_buyer_interaction
                WHERE producer_user_id = %s
                """,
                (producer_user_id,),
            )
            rows = cur.fetchall()
    return {row["buyer_location_id"] for row in rows}


def record_interaction(
    producer_user_id: str,
    buyer_location_id: str,
    status: str = "shown",
) -> None:
    interaction_id = hashlib.sha256(
        f"{producer_user_id}:{buyer_location_id}".encode()
    ).hexdigest()[:24]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO producer_buyer_interaction (
                    id, producer_user_id, buyer_location_id, status, updated_at
                ) VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (producer_user_id, buyer_location_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    updated_at = NOW()
                """,
                (interaction_id, producer_user_id, buyer_location_id, status),
            )
        conn.commit()


def search_buyers_by_vector(
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
    params: list[Any] = [embedding, latitude - lat_delta, latitude + lat_delta, longitude - lon_delta, longitude + lon_delta]
    if exclude:
        exclude_clause = "AND id <> ALL(%s::text[])"
        params.append(exclude)
    params.extend([embedding, limit])

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    id, name, type, area_key, locality, address,
                    latitude, longitude, needs, needs_text, summary,
                    contact, source_urls,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM buyer_location
                WHERE embedding IS NOT NULL
                  AND geocode_status = 'verified'
                  AND latitude BETWEEN %s AND %s
                  AND longitude BETWEEN %s AND %s
                  {exclude_clause}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                tuple(params),
            )
            return list(cur.fetchall())


def list_buyers_in_area(area_key: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM buyer_location WHERE area_key = %s
                AND geocode_status = 'verified'
                ORDER BY updated_at DESC
                """,
                (area_key,),
            )
            return list(cur.fetchall())


def get_buyer_by_id(buyer_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM buyer_location WHERE id = %s", (buyer_id,))
            return cur.fetchone()


def get_interaction_status(producer_user_id: str, buyer_id: str) -> str | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT status FROM producer_buyer_interaction
                WHERE producer_user_id = %s AND buyer_location_id = %s
                """,
                (producer_user_id, buyer_id),
            )
            row = cur.fetchone()
            return row["status"] if row else None


def list_producer_buyers(producer_user_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT b.*, i.status AS interaction_status
                FROM producer_buyer_interaction i
                JOIN buyer_location b ON b.id = i.buyer_location_id
                WHERE i.producer_user_id = %s
                  AND b.geocode_status = 'verified'
                ORDER BY i.updated_at DESC
                """,
                (producer_user_id,),
            )
            return list(cur.fetchall())


def record_rejection_reason(
    producer_user_id: str,
    buyer_location_id: str,
    reason: str,
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE producer_buyer_interaction
                SET rejection_reason = %s, updated_at = NOW()
                WHERE producer_user_id = %s AND buyer_location_id = %s
                """,
                (reason[:1000], producer_user_id, buyer_location_id),
            )
        conn.commit()


def upsert_producer_preference(
    *,
    pref_id: str,
    user_id: str,
    label: str,
    detail: str = "",
    source_buyer_id: str | None = None,
    signal_type: str = "avoid",
) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO producer_preference (
                    id, producer_user_id, signal_type, label, detail,
                    source_buyer_id, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    label = EXCLUDED.label,
                    detail = EXCLUDED.detail,
                    updated_at = NOW()
                """,
                (pref_id, user_id, signal_type, label[:120], detail[:500], source_buyer_id),
            )
        conn.commit()


def list_producer_preference_labels(producer_user_id: str, limit: int = 20) -> list[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT label FROM producer_preference
                WHERE producer_user_id = %s
                ORDER BY updated_at DESC
                LIMIT %s
                """,
                (producer_user_id, limit),
            )
            rows = cur.fetchall()
    return [str(row["label"]) for row in rows if row.get("label")]
