from __future__ import annotations

from langchain_core.tools import tool

from app.geocode import geocode_business
from app.openrouter_client import chat_with_web


@tool
def web_search_tool(query: str) -> str:
    """Search the web for real businesses and return summarized findings with source URLs."""
    prompt = (
        f"Caută pe internet: {query}\n"
        "Răspunde în română cu fapte concrete: nume afaceri, adrese, telefoane publice, "
        "site-uri, meniuri. Include URL-urile sursă."
    )
    response = chat_with_web(prompt, use_web_tools=True, json_mode=False)
    cites = "\n".join(f"- {c.get('title') or 'Sursă'}: {c.get('uri')}" for c in response.citations[:12])
    return f"{response.text}\n\nSURSE:\n{cites}" if cites else response.text


@tool
def web_fetch_tool(url: str) -> str:
    """Fetch a URL and extract business details (menu, contact, address)."""
    prompt = (
        f"Citește {url} și extrage informații despre afacere: adresă, telefon, meniu/produse. "
        f"Răspunde scurt, fără inventii."
    )
    response = chat_with_web(prompt, use_web_tools=True, json_mode=False)
    return response.text


@tool
def geocode_tool(name: str, address: str, locality: str) -> str:
    """Geocode a business name + address to latitude/longitude in Romania."""
    result = geocode_business(name, address, locality)
    if not result:
        return "NOT_FOUND"
    return f"{result.latitude},{result.longitude}|{result.label}"
