from __future__ import annotations

from langchain_openai import ChatOpenAI

from app.config import get_settings


def get_chat_model(*, json_mode: bool = False, temperature: float = 0.2) -> ChatOpenAI:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    model_kwargs: dict = {}
    if json_mode:
        model_kwargs["response_format"] = {"type": "json_object"}

    return ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.open_router_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://warmleads.local",
            "X-Title": "Warm Leads AI",
        },
        temperature=temperature,
        model_kwargs=model_kwargs,
    )
