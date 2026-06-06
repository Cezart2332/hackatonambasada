from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

from app.agent.llm import get_chat_model
from app.config import get_settings
from app import db

logger = logging.getLogger(__name__)


def _extract_json_object(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return {}


def process_rejection(
    *,
    user_id: str,
    buyer_id: str,
    reason: str,
    buyer_name: str = "",
    buyer_type: str = "",
) -> list[str]:
    """Extract avoid-signals from rejection reason and store for future discovery bias."""
    reason = reason.strip()
    if not reason:
        return []

    db.record_rejection_reason(user_id, buyer_id, reason)
    labels = _extract_avoid_labels(reason, buyer_name, buyer_type)
    stored: list[str] = []

    for label in labels:
        pref_id = hashlib.sha256(f"{user_id}:{label.lower()}".encode()).hexdigest()[:20]
        db.upsert_producer_preference(
            pref_id=pref_id,
            user_id=user_id,
            label=label,
            detail=reason[:500],
            source_buyer_id=buyer_id,
        )
        stored.append(label)

    return stored


def _extract_avoid_labels(reason: str, buyer_name: str, buyer_type: str) -> list[str]:
    settings = get_settings()
    if not settings.llm_enabled:
        labels = []
        lower = reason.lower()
        cheese_variants = ("capr", "oaie", "vacă", "vaca", "brânz", "branz")
        if sum(1 for keyword in cheese_variants if keyword in lower) >= 2:
            labels.append("incompatibilitate sortiment brânză")
        for keyword in ("preț", "pret", "cantitate", "livrare", "contract exclusiv", "închis", "inchis"):
            if keyword in lower:
                labels.append(keyword)
        if (
            not labels
            and buyer_type
            and buyer_type.lower() not in {l.lower() for l in labels}
            and any(word in lower for word in ("nu caut", "nu vreau", "evită tipul", "evita tipul"))
        ):
            labels.append(buyer_type.split()[0][:40])
        return labels[:4] or [reason[:60]]

    prompt = (
        "Extrage 1–3 etichete scurte de evitare din feedback-ul producătorului.\n"
        f"Afacere: {buyer_name} ({buyer_type})\n"
        f"Motiv: {reason}\n\n"
        "Reguli:\n"
        "- Etichetele trebuie să fie specifice motivului, nu categorii largi.\n"
        "- NU returna tipul afacerii (restaurant/hotel/cafe/magazin) decât dacă utilizatorul spune explicit că nu vrea acel tip de afacere.\n"
        "- Pentru incompatibilități de produs, păstrează varianta exactă: ex. „cere brânză de capră, producătorul vinde brânză de oaie”.\n"
        "- Pentru preț, cantitate, livrare sau contract existent, eticheta trebuie să reflecte exact problema.\n"
        'Returnează DOAR JSON: {"labels":["...","..."]}'
    )
    try:
        model = get_chat_model(json_mode=True, temperature=0.1)
        raw = model.invoke(prompt).content
        text = raw if isinstance(raw, str) else str(raw)
        parsed = _extract_json_object(text)
        labels = [str(x).strip() for x in (parsed.get("labels") or []) if str(x).strip()]
        return labels[:4] or [reason[:60]]
    except Exception as exc:
        logger.warning("Preference extraction failed: %s", exc)
        return [reason[:60]]
