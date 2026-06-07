from __future__ import annotations

import logging
from typing import Any, Literal, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.llm import get_chat_model
from app.agent.outreach_agent import draft_outreach_message
from app.agent.tools.send_lead_message import send_lead_message_direct
from app.config import get_settings

logger = logging.getLogger(__name__)


class LeadOutreachState(TypedDict):
    user_id: str
    lead_name: str
    company_name: str
    phone: str
    email: str
    context: str
    preferred_channel: str
    mode: str
    analysis: str
    message: str
    channel: str
    recipient: str
    subject: str
    sent: bool
    send_result: dict[str, Any]


def analyze_lead_node(state: LeadOutreachState) -> dict[str, Any]:
    settings = get_settings()
    if not settings.llm_enabled:
        analysis = (
            f"Lead: {state['lead_name'] or state['company_name'] or 'necunoscut'}. "
            f"Context: {state['context'][:400]}"
        )
        return {"analysis": analysis}

    prompt = (
        "Ești analist B2B pentru outreach local în România.\n"
        f"Lead: {state['lead_name'] or 'necunoscut'}\n"
        f"Companie: {state['company_name'] or 'necunoscută'}\n"
        f"Telefon: {state['phone'] or 'lipsă'}\n"
        f"Email: {state['email'] or 'lipsă'}\n"
        f"Context: {state['context']}\n\n"
        "Scrie 2-3 propoziții: ce tip de local e, de ce ar fi potrivit, ce unghi de abordare recomanzi.\n"
        "Răspunde în română, concret, fără formulări generice AI."
    )
    try:
        model = get_chat_model(temperature=0.3)
        content = model.invoke(prompt).content
        analysis = content if isinstance(content, str) else str(content)
        return {"analysis": analysis.strip()}
    except Exception as exc:
        logger.warning("Lead analysis failed: %s", exc)
        raise RuntimeError("AI generation error during lead analysis") from exc


def compose_message_node(state: LeadOutreachState) -> dict[str, Any]:
    business_name = state["company_name"] or state["lead_name"] or "Afacere locală"
    try:
        message = draft_outreach_message(
            business_name=business_name,
            business_type="local / restaurant",
            product_summary=state["context"],
            locality="Dobrogea",
            tone="cald, direct",
            notes=state["analysis"],
        )
        return {"message": message.strip()}
    except Exception as exc:
        logger.warning("Message compose failed: %s", exc)
        raise RuntimeError("AI generation error during message compose") from exc


def choose_channel_node(state: LeadOutreachState) -> dict[str, Any]:
    preferred = (state.get("preferred_channel") or "").strip().lower()
    phone = (state.get("phone") or "").strip()
    email = (state.get("email") or "").strip()

    channel: Literal["whatsapp", "email"] | None = None
    recipient = ""

    if preferred == "whatsapp" and phone:
        channel = "whatsapp"
        recipient = phone
    elif preferred == "email" and email:
        channel = "email"
        recipient = email
    elif phone:
        channel = "whatsapp"
        recipient = phone
    elif email:
        channel = "email"
        recipient = email

    if not channel or not recipient:
        raise RuntimeError("Lipsește phone sau email pentru alegerea canalului.")

    subject = ""
    if channel == "email":
        subject = f"Propunere colaborare B2B — {state['company_name'] or state['lead_name'] or 'Dobrogea'}"

    return {
        "channel": channel,
        "recipient": recipient,
        "subject": subject,
    }


def send_message_node(state: LeadOutreachState) -> dict[str, Any]:
    result = send_lead_message_direct(
        user_id=state["user_id"],
        channel=state["channel"],  # type: ignore[arg-type]
        recipient=state["recipient"],
        message=state["message"],
        subject=state.get("subject") or None,
    )
    return {"sent": True, "send_result": result}


def route_after_compose(state: LeadOutreachState) -> str:
    mode = (state.get("mode") or "draft").strip().lower()
    if mode == "send":
        return "send"
    return "end"


def _build_lead_outreach_graph():
    graph = StateGraph(LeadOutreachState)
    graph.add_node("analyze", analyze_lead_node)
    graph.add_node("compose", compose_message_node)
    graph.add_node("choose_channel", choose_channel_node)
    graph.add_node("send", send_message_node)

    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "compose")
    graph.add_edge("compose", "choose_channel")
    graph.add_conditional_edges(
        "choose_channel",
        route_after_compose,
        {"send": "send", "end": END},
    )
    graph.add_edge("send", END)
    return graph.compile()


_lead_outreach_graph = None


def run_lead_outreach(
    *,
    user_id: str,
    lead_name: str = "",
    company_name: str = "",
    phone: str = "",
    email: str = "",
    context: str = "",
    preferred_channel: str = "",
    mode: str = "draft",
) -> dict[str, Any]:
    global _lead_outreach_graph
    if _lead_outreach_graph is None:
        _lead_outreach_graph = _build_lead_outreach_graph()

    initial: LeadOutreachState = {
        "user_id": user_id,
        "lead_name": lead_name,
        "company_name": company_name,
        "phone": phone,
        "email": email,
        "context": context,
        "preferred_channel": preferred_channel,
        "mode": mode or "draft",
        "analysis": "",
        "message": "",
        "channel": "",
        "recipient": "",
        "subject": "",
        "sent": False,
        "send_result": {},
    }

    try:
        result = _lead_outreach_graph.invoke(initial)
    except RuntimeError:
        raise
    except Exception as exc:
        logger.exception("Lead outreach graph failed: %s", exc)
        raise RuntimeError("AI generation error") from exc

    return {
        "mode": result.get("mode") or mode or "draft",
        "channel": result.get("channel") or "",
        "recipient": result.get("recipient") or "",
        "subject": result.get("subject") or "",
        "message": result.get("message") or "",
        "analysis": result.get("analysis") or "",
        "sent": bool(result.get("sent")),
        "sendResult": result.get("send_result") or {},
    }
