from __future__ import annotations

import json
import logging
import re
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.llm import get_chat_model
from app.agent.outreach_agent import draft_outreach_message
from app.config import get_settings

logger = logging.getLogger(__name__)

SIMULATED_ACTION = "SIMULARE — mesaj generat, nicio trimitere reală"
DISCLAIMER = "SIMULARE — niciun mesaj WhatsApp/email nu a fost trimis."


class CampaignState(TypedDict):
    leads: list[dict[str, Any]]
    product_summary: str
    locality: str
    tone: str
    index: int
    steps: list[dict[str, Any]]


def _extract_json_object(text: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return {}


def _simulate_outcome(*, lead: dict[str, Any], draft: str, product_summary: str) -> dict[str, str]:
    settings = get_settings()
    if not settings.llm_enabled:
        raise RuntimeError("OPEN_ROUTER_KEY not configured")

    prompt = (
        "Ești un simulator pentru outreach B2B local pe lead-uri reale (NU trimite nimic real).\n"
        f"Lead: {lead.get('name')} ({lead.get('type', '')})\n"
        f"Producător: {product_summary}\n"
        f"Mesaj draft:\n{draft[:800]}\n\n"
        'Returnează DOAR JSON: {"outcome":"...", "reasoning":"..."}\n'
        "outcome — una din: răspuns probabil | interes moderat | nepotrivit | contact limitat"
    )
    try:
        model = get_chat_model(json_mode=True, temperature=0.2)
        raw = model.invoke(prompt).content
        text = raw if isinstance(raw, str) else str(raw)
        parsed = _extract_json_object(text)
        if parsed.get("outcome"):
            return {
                "outcome": str(parsed["outcome"]),
                "reasoning": str(parsed.get("reasoning") or ""),
            }
    except Exception as exc:
        logger.warning("Outcome simulation failed: %s", exc)
        raise RuntimeError("Outcome simulation failed") from exc


def process_lead_node(state: CampaignState) -> dict:
    idx = state["index"]
    if idx >= len(state["leads"]):
        return {}

    lead = state["leads"][idx]
    draft = draft_outreach_message(
        business_name=str(lead.get("name") or "Afacere locală"),
        business_type=str(lead.get("type") or ""),
        website=str(lead.get("website") or ""),
        menu_items=str(lead.get("menuItems") or lead.get("menu_items") or ""),
        notes=str(lead.get("notes") or ""),
        product_summary=state["product_summary"],
        locality=state["locality"],
        tone=state["tone"],
    )
    outcome = _simulate_outcome(
        lead=lead,
        draft=draft,
        product_summary=state["product_summary"],
    )

    step = {
        "leadId": lead.get("id") or f"lead-{idx}",
        "leadName": lead.get("name") or "Lead",
        "draftMessage": draft,
        "simulatedOutcome": outcome["outcome"],
        "simulatedAction": SIMULATED_ACTION,
        "reasoning": outcome["reasoning"],
    }
    steps = list(state["steps"])
    steps.append(step)
    return {"steps": steps, "index": idx + 1}


def route_after_lead(state: CampaignState) -> str:
    if state["index"] >= len(state["leads"]):
        return "end"
    return "process"


def _build_campaign_graph():
    graph = StateGraph(CampaignState)
    graph.add_node("process", process_lead_node)
    graph.set_entry_point("process")
    graph.add_conditional_edges("process", route_after_lead, {"process": "process", "end": END})
    return graph.compile()


_campaign_graph = None


def run_campaign_simulation(
    *,
    leads: list[dict[str, Any]],
    product_summary: str,
    locality: str,
    tone: str = "cald, direct",
    max_leads: int = 5,
) -> list[dict[str, Any]]:
    """Dry-run campaign: draft + simulated outcome per lead. No real sends."""
    batch = leads[:max_leads]
    if not batch:
        return []

    global _campaign_graph
    if _campaign_graph is None:
        _campaign_graph = _build_campaign_graph()

    initial: CampaignState = {
        "leads": batch,
        "product_summary": product_summary or "produse locale",
        "locality": locality or "Dobrogea",
        "tone": tone,
        "index": 0,
        "steps": [],
    }
    result = _campaign_graph.invoke(initial)
    return list(result.get("steps") or [])
