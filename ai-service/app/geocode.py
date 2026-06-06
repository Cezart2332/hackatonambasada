from __future__ import annotations

import logging
import math
import re
import time
import unicodedata
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "WarmLeadsHackathon/1.0 (contact@warmleads.local)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim free tier: 1 req/s — stay conservative
_MIN_INTERVAL_S = 2.0
_last_request_at = 0.0
_nominatim_blocked_until = 0.0
_geocode_success_cache: dict[str, "GeocodeResult"] = {}


@dataclass(frozen=True)
class GeocodeResult:
    latitude: float
    longitude: float
    label: str
    query: str
    provider: str = "nominatim"
    status: str = "verified"

_COUNTRY_SUFFIXES = re.compile(
    r",?\s*(românia|romania|ro)\.?\s*$",
    re.IGNORECASE,
)
_POSTCODE = re.compile(r"\b\d{5,6}\b")
_STREET_ABBREVIATIONS = re.compile(r"\b(str|bd|b-dul|blvd)\.?\s+", re.IGNORECASE)
_STREET_PREFIXES = re.compile(
    r"^(strada|str\.|bulevardul|bd\.|b-dul|blvd|aleea|șoseaua|soseaua|piața|piata)\b",
    re.IGNORECASE,
)
# Matches parenthetical notes the LLM inserts, e.g. "(la parterul Hotelului X)"
_PARENTHETICAL = re.compile(r"\([^)]*\)")
_PARENTHETICAL_CONTENT = re.compile(r"\(([^)]*)\)")
# Matches "Sat X, comuna Y" administrative prefix
_SAT_COMUNA = re.compile(r"\bsat\b[^,]*,?\s*\bcomuna\b[^,]*,?", re.IGNORECASE)
_BROAD_LOCALITIES = {"dobrogea", "dobrogea plateau", "regiunea dobrogea"}
_MULTI_LOCATION_MARKERS = re.compile(
    r"\b(locatii multiple|locații multiple|adrese specifice|mai multe locații|mai multe locatii|promoții|promotii)\b",
    re.IGNORECASE,
)
_RELATIVE_LANDMARKS = [
    re.compile(r"\bzona\s+food\s*court\s*[-–—]?\s*", re.IGNORECASE),
    re.compile(r"\bvis[-\s]*a[-\s]*vis\s+de\s+[^,;]+,?\s*", re.IGNORECASE),
    re.compile(r"\bl[âa]ng[ăa]\s+[^,;]+,?\s*", re.IGNORECASE),
    re.compile(r"\baproape\s+de\s+[^,;]+,?\s*", re.IGNORECASE),
]
_STREET_TOKEN = re.compile(
    r"\b(str\.?|strada|bd\.?|b-dul|blvd|bulevardul|aleea|șoseaua|soseaua|piața|piata)\b",
    re.IGNORECASE,
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _nominatim_is_blocked() -> bool:
    return time.time() < _nominatim_blocked_until


def _block_nominatim(seconds: float = 90.0) -> None:
    global _nominatim_blocked_until
    _nominatim_blocked_until = max(_nominatim_blocked_until, time.time() + seconds)
    logger.warning("Nominatim circuit open — skipping external geocode for %.0fs", seconds)


def _wait_for_slot() -> None:
    global _last_request_at
    elapsed = time.time() - _last_request_at
    if elapsed < _MIN_INTERVAL_S:
        time.sleep(_MIN_INTERVAL_S - elapsed)


def _clean_locality(locality: str) -> str:
    text = (locality or "").strip()
    if not text:
        return ""
    text = _COUNTRY_SUFFIXES.sub("", text).strip(" ,")
    if _fold(text) in _BROAD_LOCALITIES:
        return ""
    return text


def _fold(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", ascii_text.lower()).strip()


def _expand_street_abbreviations(address: str) -> str:
    def repl(match: re.Match[str]) -> str:
        token = match.group(1).lower()
        if token in {"bd", "b-dul", "blvd"}:
            return "Bulevardul "
        return "Strada "

    return _STREET_ABBREVIATIONS.sub(repl, address).strip()


def _cleanup_address_fragment(fragment: str) -> str:
    text = (fragment or "").strip(" ,;:-")
    if not text:
        return ""
    text = re.sub(
        r"^\s*(?:adrese\s+specifice(?:\s+pentru\s+promo[țt]ii)?|loca[țt]ii\s+multiple)\s*:?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )
    for pattern in _RELATIVE_LANDMARKS:
        text = pattern.sub("", text)
    text = re.sub(r"\b(intersec[țt]ie|intersectie)\s+cu\s+[^,;]+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*,\s*,+", ", ", text)
    return text.strip(" ,;:-")


def _split_street_list(fragment: str) -> list[str]:
    if len(_STREET_TOKEN.findall(fragment)) < 2:
        return [fragment]
    parts = re.split(
        r",\s*(?=(?:str\.?|strada|bd\.?|b-dul|blvd|bulevardul|aleea|șoseaua|soseaua|piața|piata)\b)",
        fragment,
        flags=re.IGNORECASE,
    )
    return [part.strip(" ,") for part in parts if part.strip(" ,")]


def _raw_address_fragments(address: str) -> list[str]:
    """Break LLM-style multi-location addresses into geocodable chunks."""
    text = (address or "").strip()
    if not text:
        return []

    parenthetical = [
        content.strip()
        for content in _PARENTHETICAL_CONTENT.findall(text)
        if _STREET_TOKEN.search(content) or _MULTI_LOCATION_MARKERS.search(content)
    ]
    base = _PARENTHETICAL.sub("", text)
    seed_parts = [base, *parenthetical]

    fragments: list[str] = []
    for seed in seed_parts:
        normalized = re.sub(r"[\n|]+", ";", seed)
        normalized = re.sub(r"\s*/\s*", ";", normalized)
        normalized = re.sub(r"\s+;\s+", ";", normalized)
        for chunk in [part.strip() for part in normalized.split(";") if part.strip()]:
            if ":" in chunk and (_STREET_TOKEN.search(chunk) or _MULTI_LOCATION_MARKERS.search(chunk)):
                chunk = chunk.split(":", 1)[1].strip()
            for street_part in _split_street_list(chunk):
                cleaned = _cleanup_address_fragment(street_part)
                if (
                    cleaned
                    and re.search(r"\b(?:sau|ori)\b", _fold(cleaned))
                    and not _STREET_TOKEN.search(cleaned)
                    and not re.search(r"\d", cleaned)
                ):
                    continue
                if cleaned:
                    fragments.append(cleaned)

    return list(dict.fromkeys(fragments))


def _address_variants(address: str) -> list[str]:
    variants: list[str] = []
    # Fix missing space between word and digit: "Revoluției1" → "Revoluției 1"
    normalized = re.sub(r"([a-zA-ZÀ-žа-яА-Я])(\d)", r"\1 \2", address)
    # Normalize "nr. 4C" → "4C" for cleaner Nominatim queries
    normalized = re.sub(r"\bnr\.?\s*", "", normalized, flags=re.IGNORECASE).strip(", ")
    cleaned = _expand_street_abbreviations(normalized)
    if cleaned:
        variants.append(cleaned)

    if cleaned and not _STREET_PREFIXES.search(cleaned) and re.search(r"\d", cleaned):
        variants.append(f"Strada {cleaned}")

    return list(dict.fromkeys(variants))


def _text_contains_locality(text: str, locality: str) -> bool:
    target = _fold(locality)
    if not target:
        return False
    return bool(re.search(rf"\b{re.escape(target)}\b", _fold(text)))


def infer_city_from_address(address: str) -> str:
    """Best effort city/locality extraction from an AI-provided Romanian address."""
    text = _COUNTRY_SUFFIXES.sub("", address or "").strip(" ,")
    text = _POSTCODE.sub("", text).strip(" ,")
    if not text:
        return ""

    parts = [part.strip(" ,") for part in text.split(",") if part.strip(" ,")]
    if len(parts) < 2:
        return ""
    if len(parts) == 2:
        first = parts[0]
        if first and not _STREET_PREFIXES.search(first):
            return first

    candidates: list[str] = []
    for part in parts[1:]:
        folded = _fold(part)
        if not folded or folded in {"romania", "ro"}:
            continue
        if _STREET_PREFIXES.search(part):
            continue
        if re.search(r"\d", part):
            part = _POSTCODE.sub("", part).strip(" ,")
        if part:
            candidates.append(part)

    if not candidates:
        return ""
    if len(candidates) >= 2 and _fold(candidates[-1]) in {"constanta", "tulcea"}:
        return candidates[-2]
    return candidates[-1]


def _normalize_address(address: str, locality: str) -> str:
    """Strip redundant city/country tails the LLM often duplicates,
    and remove parenthetical notes / administrative prefixes."""
    text = (address or "").strip()
    if not text:
        return ""

    # Remove parenthetical annotations like "(la parterul Hotelului X)"
    text = _PARENTHETICAL.sub("", text).strip()

    text = _COUNTRY_SUFFIXES.sub("", text).strip(" ,")
    text = _POSTCODE.sub("", text).strip(" ,")
    loc = _clean_locality(locality)
    if loc:
        loc_parts = [part.strip() for part in loc.split(",") if part.strip()]
        city = loc_parts[0] if loc_parts else loc
        pattern = re.compile(
            rf",?\s*{re.escape(city)}\s*(?:{_POSTCODE.pattern})?\s*,?\s*$",
            re.IGNORECASE,
        )
        text = pattern.sub("", text).strip(" ,")
        text = _COUNTRY_SUFFIXES.sub("", text).strip(" ,")
        text = _POSTCODE.sub("", text).strip(" ,")
    return text


def _build_geocode_queries(name: str, address: str, locality: str) -> list[str]:
    name = (name or "").strip()
    locality = _clean_locality(locality) or infer_city_from_address(address)
    name_locality_suffix = f", {locality}" if locality else ""

    queries: list[str] = []
    clean_addresses: list[str] = []
    for fragment in _raw_address_fragments(address):
        clean = _normalize_address(fragment, locality)
        if clean and len(clean) > 3:
            clean_addresses.append(clean)
    if not clean_addresses:
        clean = _normalize_address(address, locality)
        if clean:
            clean_addresses.append(clean)

    for clean_address in list(dict.fromkeys(clean_addresses)):
        address_locality_suffix = (
            f", {locality}"
            if locality and not _text_contains_locality(clean_address, locality)
            else ""
        )
        if not clean_address or len(clean_address) <= 6:
            continue
        for variant in _address_variants(clean_address):
            if name:
                queries.append(f"{name}, {variant}{address_locality_suffix}, Romania")
            queries.append(f"{variant}{address_locality_suffix}, Romania")

        # Extra variant: strip "Sat X, comuna Y" prefix and try just the street
        sat_stripped = _SAT_COMUNA.sub("", clean_address).strip(" ,")
        if sat_stripped and sat_stripped != clean_address and len(sat_stripped) > 5:
            for variant in _address_variants(sat_stripped):
                if name:
                    queries.append(f"{name}, {variant}{address_locality_suffix}, Romania")
                queries.append(f"{variant}{address_locality_suffix}, Romania")

    if name:
        queries.append(f"{name}{name_locality_suffix}, Romania")

    # Last-resort: just name + city (no street at all)
    if name and locality:
        queries.append(f"{name}, {locality}, Romania")

    return list(dict.fromkeys(query for query in queries if query.strip(" ,")))


def _is_locality_level_result(item: dict) -> bool:
    """Reject city/county-only hits; persisted buyers need a real place/address."""
    item_class = str(item.get("class") or "").lower()
    item_type = str(item.get("type") or "").lower()
    address = item.get("address") if isinstance(item.get("address"), dict) else {}

    address_keys = {str(key).lower() for key in address.keys()}
    has_street_address = bool(
        address_keys
        & {
            "house_number",
            "road",
            "pedestrian",
            "footway",
            "street",
            "addr:street",
        }
    )
    has_business_class = item_class in {
        "amenity",
        "shop",
        "tourism",
        "leisure",
        "office",
        "craft",
        "building",
    }
    if has_street_address or has_business_class:
        return False

    locality_types = {
        "administrative",
        "city",
        "county",
        "municipality",
        "neighbourhood",
        "quarter",
        "suburb",
        "town",
        "village",
    }
    if item_class in {"boundary", "place"} or item_type in locality_types:
        return True

    try:
        place_rank = int(item.get("place_rank") or 99)
    except (TypeError, ValueError):
        place_rank = 99
    return place_rank <= 16


def _matches_requested_locality(item: dict, locality: str | None) -> bool:
    if not locality:
        return True

    target = _fold(_clean_locality(locality).split(",")[0])
    if not target or target in {"dobrogea", "romania", "ro"}:
        return True

    address = item.get("address") if isinstance(item.get("address"), dict) else {}
    # Extended list: include hamlet, neighbourhood, quarter for rural/resort localities
    precise_locality_fields = [
        "city", "town", "village", "municipality",
        "hamlet", "suburb", "neighbourhood", "quarter",
        "city_district",
    ]
    values = [_fold(str(address.get(field) or "")) for field in precise_locality_fields]
    values = [value for value in values if value]

    if not values:
        county = _fold(str(address.get("county") or ""))
        values = [county] if county else []

    if values:
        # Exact match OR target is substring of a value (handles "Vadu" inside longer strings)
        if any(target == v or target in v or v in target for v in values):
            return True
        if any(_fold(str(address.get(field) or "")) for field in precise_locality_fields):
            return False

    # Fallback: check display_name
    display = _fold(str(item.get("display_name") or ""))
    return bool(display and re.search(rf"\b{re.escape(target)}\b", display))


def _nominatim_search(client: httpx.Client, query: str) -> list[dict] | None:
    """Return results, empty list if not found, None if rate-limited (circuit open)."""
    global _last_request_at

    if _nominatim_is_blocked():
        return None

    _wait_for_slot()
    response = client.get(
        NOMINATIM_URL,
        params={
            "q": query,
            "format": "json",
            "limit": "3",
            "countrycodes": "ro",
            "addressdetails": "1",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=15.0,
    )
    _last_request_at = time.time()

    if response.status_code == 429:
        _block_nominatim(90.0)
        logger.warning("Nominatim 429 — circuit open, query was: %r", query[:80])
        return None

    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else []


def _pick_romania_result(
    results: list[dict],
    query: str,
    locality: str | None = None,
) -> GeocodeResult | None:
    for item in results:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if 43.5 <= lat <= 45.5 and 27.0 <= lon <= 30.0:
            if _is_locality_level_result(item):
                logger.info("Rejected locality-level geocode for %r: %s", query[:80], item.get("display_name"))
                continue
            if not _matches_requested_locality(item, locality):
                logger.info("Rejected wrong-locality geocode for %r: %s", query[:80], item.get("display_name"))
                continue
            label = str(item.get("display_name") or query)
            return GeocodeResult(latitude=lat, longitude=lon, label=label, query=query)
    return None


def geocode_query(query: str, locality: str | None = None) -> GeocodeResult | None:
    normalized = query.strip()
    if not normalized or _nominatim_is_blocked():
        return None

    cached = _geocode_success_cache.get(normalized)
    if cached:
        return cached

    try:
        with httpx.Client() as client:
            results = _nominatim_search(client, normalized)
    except Exception as exc:
        logger.warning("Geocode failed for %r: %s", normalized[:80], exc)
        return None

    if results is None:
        return None

    picked = _pick_romania_result(results, normalized, locality)
    if picked:
        if len(_geocode_success_cache) < 512:
            _geocode_success_cache[normalized] = picked
    return picked


def geocode_business(
    name: str,
    address: str,
    locality: str,
    *,
    fallback_lat: float | None = None,
    fallback_lon: float | None = None,
    fast_mode: bool = False,
) -> GeocodeResult | None:
    """Geocode a business to a verified external result; never return approximate coordinates."""
    from app.config import get_settings

    name = (name or "").strip()
    locality = (locality or "").strip()
    settings = get_settings()

    use_nominatim = settings.geocode_use_nominatim

    if not use_nominatim:
        logger.info("Geocode skipped for %r — Nominatim disabled", name)
        return None

    if _nominatim_is_blocked():
        logger.info("Geocode skipped for %r — Nominatim circuit open", name)
        return None

    queries = _build_geocode_queries(name, address, locality)
    for query in queries:
        result = geocode_query(query, locality=locality)
        if result:
            logger.info(
                "Geocoded %r -> %s (%.5f, %.5f)",
                name,
                result.label[:60],
                result.latitude,
                result.longitude,
            )
            return result

    logger.warning(
        "Geocode failed for %r address=%r locality=%r queries=%s",
        name,
        address,
        locality,
        queries,
    )
    return None


def geocode_city_center(locality: str) -> GeocodeResult | None:
    """Fallback: pin a business to its town/municipality center when POI geocode fails."""
    city = _clean_locality(locality)
    if not city:
        return None

    query = f"{city}, Romania"
    result = geocode_query(query, locality=city)
    if result:
        return GeocodeResult(
            latitude=result.latitude,
            longitude=result.longitude,
            label=result.label,
            query=result.query,
            provider=result.provider,
            status="city_center",
        )

    if _nominatim_is_blocked():
        return None

    try:
        with httpx.Client() as client:
            results = _nominatim_search(client, query)
    except Exception as exc:
        logger.warning("City geocode failed for %r: %s", city, exc)
        return None

    if not results:
        return None

    for item in results:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if 43.5 <= lat <= 45.5 and 27.0 <= lon <= 30.0:
            label = str(item.get("display_name") or query)
            return GeocodeResult(
                latitude=lat,
                longitude=lon,
                label=label,
                query=query,
                status="city_center",
            )
    return None
