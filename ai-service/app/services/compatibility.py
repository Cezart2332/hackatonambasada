from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

from app.config import get_settings
from app.openrouter_client import chat_with_web
from app.taxonomy import deterministic_business_compatibility, needs_to_text

logger = logging.getLogger(__name__)

_compatibility_cache: dict[str, bool] = {}


def _extract_json_object(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text or "")
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _cache_key(payload: dict[str, Any]) -> str:
    stable = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def buyer_is_compatible_with_producer(
    *,
    name: str,
    business_type: str,
    producer_needs: list[str],
    buyer_needs: list[str] | None = None,
    summary: str = "",
    menu_items: str = "",
    notes: str = "",
) -> bool:
    """Use the LLM as the compatibility judge, with a deterministic fallback."""
    payload = {
        "name": (name or "").strip(),
        "business_type": (business_type or "").strip(),
        "producer_needs": producer_needs or [],
        "buyer_needs": buyer_needs or [],
        "summary": (summary or "").strip()[:900],
        "menu_items": (menu_items or "").strip()[:900],
        "notes": (notes or "").strip()[:900],
    }
    fallback = deterministic_business_compatibility(
        name=payload["name"],
        business_type=payload["business_type"],
        producer_needs=list(payload["producer_needs"]),
        buyer_needs=list(payload["buyer_needs"]),
        summary=payload["summary"],
        menu_items=payload["menu_items"],
        notes=payload["notes"],
    )
    if not payload["producer_needs"]:
        return True

    key = _cache_key(payload)
    if key in _compatibility_cache:
        return _compatibility_cache[key]

    settings = get_settings()
    if not settings.llm_enabled:
        _compatibility_cache[key] = fallback
        return fallback

    prompt = (
        "Ești evaluator de compatibilitate B2B pentru aplicația Warm Leads.\n"
        "Decide dacă localul este un lead realist pentru producătorul dat.\n\n"
        f"Produsele producătorului: {needs_to_text(list(payload['producer_needs']))} "
        f"({', '.join(payload['producer_needs'])}).\n\n"
        "Local candidat:\n"
        f"- nume: {payload['name']}\n"
        f"- tip: {payload['business_type']}\n"
        f"- nevoi estimate: {needs_to_text(list(payload['buyer_needs']))} "
        f"({', '.join(payload['buyer_needs']) or 'necunoscute'})\n"
        f"- descriere: {payload['summary'] or 'necunoscută'}\n"
        f"- meniu/produse: {payload['menu_items'] or 'necunoscut'}\n"
        f"- note: {payload['notes'] or 'necunoscute'}\n\n"
        "Reguli de decizie:\n"
        "- Marchează compatible=true doar dacă localul ar cumpăra realist produsele producătorului.\n"
        "- Dacă producătorul vinde carne/pui, respinge localuri vegane, vegetariene, plant-based sau care caută doar legume/fructe.\n"
        "- Dacă producătorul vinde brânză/lactate, respinge carmangerii, măcelării sau magazine axate pe legume/fructe, "
        "cu excepția cazului în care există semnal clar că vând/caută brânzeturi/lactate.\n"
        "- Dacă producătorul vinde legume/fructe/ierburi, respinge carmangerii, măcelării și mezelării, "
        "dar păstrează restaurante/hoteluri/cafenele mixte dacă meniul/nevoile lor susțin produsul.\n"
        "- Pentru restaurante, hoteluri și cafenele mixte, judecă după meniu și nevoi, nu doar după etichetă.\n"
        "- Dacă informația este prea slabă și compatibilitatea nu este plauzibilă, răspunde false.\n\n"
        'Returnează DOAR JSON valid: {"compatible": true, "reason": "motiv scurt"}'
    )

    try:
        response = chat_with_web(prompt, use_web_tools=False, json_mode=True, temperature=0.0)
        parsed = _extract_json_object(response.text)
        compatible = parsed.get("compatible")
        if isinstance(compatible, bool):
            if not compatible:
                reason = str(parsed.get("reason") or "incompatibil").strip()
                logger.warning("Compatibility reject %s — %s", name, reason[:180])
            _compatibility_cache[key] = compatible
            return compatible
        logger.warning("Compatibility judge returned invalid JSON for %s: %s", name, response.text[:250])
    except Exception as exc:
        logger.warning("Compatibility judge failed for %s: %s", name, exc)

    _compatibility_cache[key] = fallback
    return fallback
