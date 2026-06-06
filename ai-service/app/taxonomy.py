"""Canonical product categories for buyer needs and producer matching."""

from __future__ import annotations

CANONICAL_NEEDS = [
    "honey",
    "meat",
    "fish",
    "cheese",
    "eggs",
    "vegetables",
    "fruit",
    "wine",
    "dairy",
    "bread",
    "poultry",
    "herbs",
]

# Romanian + English keywords -> canonical category
KEYWORD_MAP: dict[str, str] = {
    "miere": "honey",
    "honey": "honey",
    "apicol": "honey",
    "carne": "meat",
    "meat": "meat",
    "vită": "meat",
    "porc": "meat",
    "miel": "meat",
    "pește": "fish",
    "peste": "fish",
    "fish": "fish",
    "fructe de mare": "fish",
    "brânză": "cheese",
    "branza": "cheese",
    "cheese": "cheese",
    "brânzeturi": "cheese",
    "ouă": "eggs",
    "oua": "eggs",
    "eggs": "eggs",
    "legume": "vegetables",
    "vegetables": "vegetables",
    "salată": "vegetables",
    "fructe": "fruit",
    "fruit": "fruit",
    "vin": "wine",
    "wine": "wine",
    "lactate": "dairy",
    "dairy": "dairy",
    "lapte": "dairy",
    "iaurt": "dairy",
    "pâine": "bread",
    "bread": "bread",
    "paine": "bread",
    "pui": "poultry",
    "poultry": "poultry",
    "curcan": "poultry",
    "ierburi": "herbs",
    "herbs": "herbs",
    "condimente": "herbs",
}

DISPLAY_RO: dict[str, str] = {
    "honey": "miere",
    "meat": "carne",
    "fish": "pește",
    "cheese": "brânză",
    "eggs": "ouă",
    "vegetables": "legume",
    "fruit": "fructe",
    "wine": "vin",
    "dairy": "lactate",
    "bread": "pâine",
    "poultry": "pui",
    "herbs": "ierburi",
}


def normalize_need(text: str) -> str | None:
    lower = text.lower().strip()
    if lower in CANONICAL_NEEDS:
        return lower
    for keyword, canonical in KEYWORD_MAP.items():
        if keyword in lower:
            return canonical
    return None


def normalize_needs(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        canonical = normalize_need(item)
        if canonical and canonical not in seen:
            seen.add(canonical)
            result.append(canonical)
    return result


def normalize_producer_products(product_names: list[str]) -> list[str]:
    needs: list[str] = []
    for name in product_names:
        canonical = normalize_need(name)
        if canonical:
            needs.append(canonical)
    return normalize_needs(needs)


def needs_to_text(needs: list[str]) -> str:
    labels = [DISPLAY_RO.get(n, n) for n in needs]
    return ", ".join(labels)


def overlap_score(buyer_needs: list[str], producer_needs: list[str]) -> float:
    if not producer_needs or not buyer_needs:
        return 0.0
    buyer_set = set(buyer_needs)
    producer_set = set(producer_needs)
    overlap = len(buyer_set & producer_set)
    return overlap / len(producer_set)
