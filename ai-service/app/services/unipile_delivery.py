from __future__ import annotations

import logging
import re
from typing import Any

from app.agent.tools.send_lead_message import send_lead_message_direct
from app.config import get_settings

logger = logging.getLogger(__name__)

TEST_WHATSAPP_NUMBERS = ("0775313878", "0736671759", "0742557626")
TEST_EMAILS = ("cezarturliu25@gmail.com", "cezarturliu245@gmail.com", "nicolae.andrei888@gmail.com")


def _romanian_phone_to_whatsapp_id(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 10:
        digits = f"40{digits[1:]}"
    if digits.startswith("40") and len(digits) == 11:
        return f"{digits}@s.whatsapp.net"
    if len(digits) >= 10:
        return f"{digits}@s.whatsapp.net"
    return ""


def _delivery_status(channel: str, target: str, status: str, detail: str = "", provider_id: str = "") -> dict[str, str]:
    return {
        "channel": channel,
        "target": target,
        "status": status,
        "detail": detail,
        "providerId": provider_id,
    }


def _custom_message(*, lead_name: str, draft: str, product_summary: str, locality: str) -> str:
    return (
        f"Lead simulat: {lead_name}\n"
        f"Oferta: {product_summary or 'produse locale'}\n"
        f"Zona: {locality or 'Dobrogea'}\n\n"
        f"{draft.strip()}"
    )


def _campaign_delivery_enabled() -> bool:
    settings = get_settings()
    return bool(
        settings.unipile_enable_sends
        and settings.internal_api_token
        and settings.internal_api_token.strip()
        and settings.app_url
        and settings.app_url.strip()
    )


def _is_not_connected_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "409" in text or "nu este conectat" in text or "integration_not_connected" in text


def _send_demo_message(
    *,
    user_id: str,
    channel: str,
    recipient: str,
    message: str,
    subject: str | None = None,
) -> dict[str, str]:
    try:
        send_lead_message_direct(
            user_id=user_id,
            channel="whatsapp" if channel == "whatsapp" else "email",
            recipient=recipient,
            message=message,
            subject=subject,
        )
        return _delivery_status(
            channel,
            recipient,
            "sent",
            "Trimis din contul WhatsApp/Gmail conectat al utilizatorului.",
        )
    except Exception as exc:
        logger.warning("Campaign demo send failed (%s -> %s): %s", channel, recipient, exc)
        if _is_not_connected_error(exc):
            label = "WhatsApp" if channel == "whatsapp" else "Gmail"
            return _delivery_status(
                channel,
                recipient,
                "skipped",
                f"Integrarea {label} nu este conectată. Conectează contul din Profil.",
            )
        return _delivery_status(channel, recipient, "failed", str(exc)[:180])


def send_campaign_test_messages(
    *,
    lead_name: str,
    draft: str,
    product_summary: str,
    locality: str,
    user_id: str,
    sender_email: str = "",
    sender_phone: str = "",
) -> list[dict[str, str]]:
    """Send each campaign draft to hardcoded demo recipients via the user's connected integrations."""
    del sender_email, sender_phone

    message = _custom_message(
        lead_name=lead_name,
        draft=draft,
        product_summary=product_summary,
        locality=locality,
    )

    if not _campaign_delivery_enabled():
        skip_reason = "INTERNAL_API_TOKEN/APP_URL neconfigurat pe AI service sau UNIPILE_ENABLE_SENDS=false"
        return [
            _delivery_status("whatsapp", target, "skipped", skip_reason)
            for target in TEST_WHATSAPP_NUMBERS
        ] + [
            _delivery_status("email", target, "skipped", skip_reason)
            for target in TEST_EMAILS
        ]

    subject = f"Simulare campanie Warm Leads - {lead_name}"
    results: list[dict[str, str]] = []

    for phone in TEST_WHATSAPP_NUMBERS:
        if not _romanian_phone_to_whatsapp_id(phone):
            results.append(_delivery_status("whatsapp", phone, "failed", "Numar WhatsApp invalid"))
            continue
        results.append(
            _send_demo_message(
                user_id=user_id,
                channel="whatsapp",
                recipient=phone,
                message=message,
            ),
        )

    for email in TEST_EMAILS:
        results.append(
            _send_demo_message(
                user_id=user_id,
                channel="email",
                recipient=email,
                message=message,
                subject=subject,
            ),
        )

    return results


def summarize_delivery(results: list[dict[str, str]]) -> str:
    sent = sum(1 for item in results if item.get("status") == "sent")
    failed = sum(1 for item in results if item.get("status") == "failed")
    skipped = sum(1 for item in results if item.get("status") == "skipped")
    parts: list[str] = []
    if sent:
        parts.append(f"{sent} trimise")
    if failed:
        parts.append(f"{failed} esuate")
    if skipped:
        parts.append(f"{skipped} sarite")
    return "Livrare demo Unipile: " + (", ".join(parts) if parts else "fara rezultate")
