from __future__ import annotations

import re

_FAKE_SUFFIXES = frozenset(
    {
        "000000000",
        "111111111",
        "123456789",
        "722000000",
        "733000000",
        "744000000",
        "755000000",
        "766000000",
        "777777777",
        "999999999",
    }
)


def normalize_phone_digits(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("40") and len(digits) >= 11:
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 10:
        digits = digits[1:]
    return digits


def format_romanian_phone(phone: str) -> str:
    digits = normalize_phone_digits(phone)
    if len(digits) != 9:
        return ""
    return f"+40 {digits[:3]} {digits[3:6]} {digits[6:]}"


def is_plausible_romanian_phone(phone: str) -> bool:
    digits = normalize_phone_digits(phone)
    if len(digits) != 9 or not digits.isdigit():
        return False
    if digits in _FAKE_SUFFIXES:
        return False
    if len(set(digits)) <= 2:
        return False
    if digits.endswith("000000") or "0000000" in digits:
        return False
    if digits[0] not in "7234":
        return False
    return True


def phone_appears_in_text(phone: str, text: str) -> bool:
    if not phone or not text:
        return False
    digits = normalize_phone_digits(phone)
    if len(digits) != 9:
        return False
    text_digits = re.sub(r"\D", "", text)
    return digits in text_digits


def validate_phone(phone: str, *, source_text: str = "") -> str:
    """Return formatted phone only if valid and (when source_text given) found in it."""
    cleaned = format_romanian_phone(phone)
    if not cleaned or not is_plausible_romanian_phone(cleaned):
        return ""
    if source_text and not phone_appears_in_text(cleaned, source_text):
        return ""
    return cleaned
