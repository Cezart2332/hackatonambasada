from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import get_settings

logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings"

WEB_SEARCH_TOOL: dict[str, Any] = {
    "type": "openrouter:web_search",
    "parameters": {
        "engine": "exa",
        "max_results": 8,
        "max_total_results": 16,
        "search_context_size": "medium",
    },
}

WEB_FETCH_TOOL: dict[str, Any] = {
    "type": "openrouter:web_fetch",
    "parameters": {
        "engine": "exa",
        "max_uses": 6,
        "max_content_tokens": 8000,
    },
}


@dataclass
class WebResponse:
    text: str
    citations: list[dict[str, str]] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


class OpenRouterError(RuntimeError):
    pass


class OpenRouterRateLimitError(OpenRouterError):
    pass


def _headers() -> dict[str, str]:
    settings = get_settings()
    if not settings.llm_enabled:
        raise OpenRouterError("OPEN_ROUTER_KEY not configured")
    return {
        "Authorization": f"Bearer {settings.open_router_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://warmleads.local",
        "X-Title": "Warm Leads AI",
    }


def _is_rate_limit(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code == 429
    return False


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code == 429:
        raise OpenRouterRateLimitError(response.text[:500])
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise OpenRouterError(exc.response.text[:500]) from exc


def _extract_citations(data: dict[str, Any]) -> list[dict[str, str]]:
    citations: list[dict[str, str]] = []
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}

    for ann in message.get("annotations") or []:
        if ann.get("type") != "url_citation":
            continue
        cite = ann.get("url_citation") or {}
        url = str(cite.get("url") or "").strip()
        if url:
            citations.append(
                {
                    "title": str(cite.get("title") or "").strip(),
                    "uri": url,
                }
            )

    for item in data.get("citations") or []:
        if isinstance(item, str) and item.startswith("http"):
            citations.append({"title": "", "uri": item})
        elif isinstance(item, dict):
            url = str(item.get("url") or item.get("uri") or "").strip()
            if url:
                citations.append(
                    {
                        "title": str(item.get("title") or "").strip(),
                        "uri": url,
                    }
                )

    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for cite in citations:
        if cite["uri"] in seen:
            continue
        seen.add(cite["uri"])
        unique.append(cite)
    return unique


@retry(
    retry=retry_if_exception(_is_rate_limit),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    reraise=True,
)
def chat_with_web(
    prompt: str,
    *,
    use_web_tools: bool = True,
    json_mode: bool = False,
    temperature: float = 0.2,
) -> WebResponse:
    settings = get_settings()
    body: dict[str, Any] = {
        "model": settings.openrouter_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    if use_web_tools:
        body["tools"] = [WEB_SEARCH_TOOL, WEB_FETCH_TOOL]
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    with httpx.Client(timeout=180.0) as client:
        response = client.post(OPENROUTER_CHAT_URL, headers=_headers(), json=body)
        _raise_for_status(response)
        data = response.json()

    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    text = str(message.get("content") or "").strip()
    return WebResponse(text=text, citations=_extract_citations(data), raw=data)


@retry(
    retry=retry_if_exception(_is_rate_limit),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    reraise=True,
)
def embed(text: str) -> list[float]:
    settings = get_settings()
    body = {
        "model": settings.openrouter_embed_model,
        "input": text,
    }
    if settings.embed_dim != 1536:
        body["dimensions"] = settings.embed_dim

    with httpx.Client(timeout=60.0) as client:
        response = client.post(OPENROUTER_EMBED_URL, headers=_headers(), json=body)
        _raise_for_status(response)
        data = response.json()

    items = data.get("data") or []
    if not items:
        raise OpenRouterError("Embedding response empty")
    embedding = items[0].get("embedding")
    if not isinstance(embedding, list):
        raise OpenRouterError("Invalid embedding payload")
    return [float(v) for v in embedding]
