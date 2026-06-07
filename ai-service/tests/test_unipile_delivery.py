from __future__ import annotations

from app.config import get_settings
from app.services import unipile_delivery


def test_romanian_phone_to_whatsapp_id() -> None:
    assert unipile_delivery._romanian_phone_to_whatsapp_id("0775313878") == "40775313878@s.whatsapp.net"
    assert unipile_delivery._romanian_phone_to_whatsapp_id("+40 736 671 759") == "40736671759@s.whatsapp.net"


def test_send_campaign_test_messages_skips_without_internal_config(monkeypatch) -> None:
    monkeypatch.delenv("INTERNAL_API_TOKEN", raising=False)
    get_settings.cache_clear()

    results = unipile_delivery.send_campaign_test_messages(
        lead_name="Test Lead",
        draft="Salut, acesta este un draft.",
        product_summary="miere",
        locality="Constanta",
        user_id="user-1",
    )

    assert len(results) == 6
    assert {item["status"] for item in results} == {"skipped"}


def test_send_campaign_test_messages_uses_user_integrations(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_send(**kwargs):
        calls.append(kwargs)
        return {"success": True}

    monkeypatch.setenv("INTERNAL_API_TOKEN", "test-token")
    monkeypatch.setenv("APP_URL", "http://backend:3001")
    monkeypatch.setenv("UNIPILE_ENABLE_SENDS", "true")
    monkeypatch.setattr(unipile_delivery, "send_lead_message_direct", fake_send)
    get_settings.cache_clear()

    results = unipile_delivery.send_campaign_test_messages(
        lead_name="Restaurant Test",
        draft="Salut, avem miere locala.",
        product_summary="miere",
        locality="Constanta",
        user_id="user-2",
    )

    assert len(results) == 6
    assert {item["status"] for item in results} == {"sent"}
    assert len(calls) == 6
    assert calls[0]["channel"] == "whatsapp"
    assert calls[0]["recipient"] == "0775313878"
    assert calls[0]["user_id"] == "user-2"
    assert calls[3]["channel"] == "email"
    assert calls[3]["recipient"] == "cezarturliu25@gmail.com"
    assert calls[3]["subject"] == "Simulare campanie Warm Leads - Restaurant Test"
    assert "Restaurant Test" in calls[3]["message"]


def test_send_campaign_test_messages_skips_when_integration_missing(monkeypatch) -> None:
    def fake_send(**_kwargs):
        raise RuntimeError('Unipile send failed (409): {"code":"INTEGRATION_NOT_CONNECTED"}')

    monkeypatch.setenv("INTERNAL_API_TOKEN", "test-token")
    monkeypatch.setenv("APP_URL", "http://backend:3001")
    monkeypatch.setenv("UNIPILE_ENABLE_SENDS", "true")
    monkeypatch.setattr(unipile_delivery, "send_lead_message_direct", fake_send)
    get_settings.cache_clear()

    results = unipile_delivery.send_campaign_test_messages(
        lead_name="Restaurant Test",
        draft="Salut, avem miere locala.",
        product_summary="miere",
        locality="Constanta",
        user_id="user-3",
    )

    assert len(results) == 6
    assert {item["status"] for item in results} == {"skipped"}
    assert all("Conectează contul din Profil" in item["detail"] for item in results)
