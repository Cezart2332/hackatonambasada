from __future__ import annotations

import logging
from typing import Any, Literal

import httpx
from langchain_core.tools import tool

from app.config import get_settings

logger = logging.getLogger(__name__)


def _send_via_node(
    *,
    user_id: str,
    channel: Literal["whatsapp", "email"],
    recipient: str,
    message: str,
    subject: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.internal_api_token:
        raise RuntimeError("INTERNAL_API_TOKEN not configured on AI service")

    url = f"{settings.app_url.rstrip('/')}/api/integrations/unipile/send"
    payload: dict[str, Any] = {
        "userId": user_id,
        "channel": channel,
        "recipient": recipient,
        "message": message,
    }
    if subject:
        payload["subject"] = subject

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            url,
            headers={
                "X-Internal-Token": settings.internal_api_token,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            detail = response.text[:300]
            raise RuntimeError(f"Unipile send failed ({response.status_code}): {detail}")
        return response.json()


@tool("send_lead_message")
def send_lead_message(
    userId: str,
    channel: Literal["whatsapp", "email"],
    recipient: str,
    message: str,
    subject: str | None = None,
) -> dict[str, Any]:
    """Send a WhatsApp or email message through the user's connected Unipile account."""
    return _send_via_node(
        user_id=userId,
        channel=channel,
        recipient=recipient,
        message=message,
        subject=subject,
    )


def send_lead_message_direct(
    *,
    user_id: str,
    channel: Literal["whatsapp", "email"],
    recipient: str,
    message: str,
    subject: str | None = None,
) -> dict[str, Any]:
    """Direct call used by the lead outreach graph (same as the LangChain tool)."""
    return _send_via_node(
        user_id=user_id,
        channel=channel,
        recipient=recipient,
        message=message,
        subject=subject,
    )
