import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.agent.chat_agent import run_chat_turn
from app.agent.venue_chat_agent import run_venue_chat_turn
from app.config import get_settings
from app.db import close_pool, init_schema
from app.gemini import embed
from app.models import (
    BuyerStatusRequest,
    ChatReplyRequest,
    ChatReplyResponse,
    DiscoverLeadsRequest,
    DiscoverLeadsResponse,
    DiscoverSuppliersRequest,
    DiscoverSuppliersResponse,
    DiscoveredLead,
    DiscoveredSupplier,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    LeadEnrichRequest,
    LeadEnrichResponse,
    ListDiscoveredRequest,
    ListDiscoveredSuppliersRequest,
    MessageDraftRequest,
    MessageDraftResponse,
    CampaignSimulateRequest,
    CampaignSimulateResponse,
    SimulatedStep,
    SupplierStatusRequest,
    LeadOutreachRequest,
    LeadOutreachResponse,
)
from app.services.matching import discover_leads, list_discovered_leads, update_buyer_status
from app.services.supplier_matching import (
    discover_suppliers,
    list_discovered_suppliers,
    update_supplier_status,
)
from app.agent.outreach_agent import draft_outreach_message
from app.agent.campaign_graph import DISCLAIMER, run_campaign_simulation
from app.agent.lead_outreach_graph import run_lead_outreach

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_schema()
        logger.info("Database schema initialized")
    except Exception as exc:
        logger.exception("Schema init failed: %s", exc)
    yield
    close_pool()


app = FastAPI(
    title="Warm Leads AI",
    description="Gemini-powered buyer discovery with pgvector need matching.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(mode="openrouter" if settings.llm_enabled else "unavailable")


@app.post("/v1/chat/reply", response_model=ChatReplyResponse)
def chat_reply(body: ChatReplyRequest) -> ChatReplyResponse:
    settings = get_settings()

    if body.userId and body.message and settings.llm_enabled:
        profile_dict: dict = {}
        if body.profile:
            profile_dict = body.profile.model_dump(exclude_none=True)
        try:
            account_type = (body.accountType or "producer").strip().lower()
            if account_type == "venue":
                result = run_venue_chat_turn(
                    user_id=body.userId,
                    message=body.message,
                    profile=profile_dict,
                )
            else:
                result = run_chat_turn(
                    user_id=body.userId,
                    message=body.message,
                    profile=profile_dict,
                )
            return ChatReplyResponse(
                reply=result.reply,
                model=result.model,
                profileUpdates=result.profile_updates or None,
                leads=[DiscoveredLead(**lead) for lead in result.leads] if result.leads else None,
                onboardingComplete=result.onboarding_complete,
            )
        except Exception as exc:
            logger.exception("Chat agent failed: %s", exc)
            raise HTTPException(
                status_code=502,
                detail="Agentul de chat nu a putut răspunde acum.",
            ) from exc

    raise HTTPException(
        status_code=503,
        detail="Agentul AI nu este configurat. Setează OPEN_ROUTER_KEY pentru răspunsuri reale.",
    )


@app.post("/v1/messages/draft", response_model=MessageDraftResponse)
def message_draft(body: MessageDraftRequest) -> MessageDraftResponse:
    settings = get_settings()
    if not settings.llm_enabled:
        raise HTTPException(
            status_code=503,
            detail="Generarea de mesaje cere OPEN_ROUTER_KEY configurat.",
        )
    try:
        message = draft_outreach_message(
            business_name=body.businessName,
            business_type=body.leadType,
            website=body.website,
            menu_items=body.menuItems,
            notes=body.notes,
            product_summary=body.productSummary,
            locality=body.locality,
            tone=body.tone,
            account_type=body.accountType,
            venue_business_name=body.venueBusinessName,
            supply_frequency=body.supplyFrequency,
            preferred_days=body.preferredDays,
        )
        return MessageDraftResponse(message=message, model=settings.openrouter_model)
    except Exception as exc:
        logger.exception("Message draft failed: %s", exc)
        raise HTTPException(status_code=502, detail="Nu am putut genera mesajul acum.") from exc


@app.post("/v1/campaign/simulate", response_model=CampaignSimulateResponse)
def campaign_simulate(body: CampaignSimulateRequest) -> CampaignSimulateResponse:
    settings = get_settings()
    try:
        lead_dicts = [lead.model_dump() for lead in body.leads]
        steps = run_campaign_simulation(
            user_id=body.userId,
            leads=lead_dicts,
            product_summary=body.productSummary,
            locality=body.locality,
            tone=body.tone,
            max_leads=body.maxLeads,
            sender_email=body.senderEmail,
            sender_phone=body.senderPhone,
        )
        return CampaignSimulateResponse(
            steps=[SimulatedStep(**step) for step in steps],
            disclaimer=DISCLAIMER,
            model=settings.openrouter_model,
        )
    except Exception as exc:
        logger.exception("Campaign simulate failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Simularea campaniei nu a putut rula acum.",
        ) from exc


@app.post("/v1/lead-outreach", response_model=LeadOutreachResponse)
def lead_outreach(body: LeadOutreachRequest) -> LeadOutreachResponse:
    settings = get_settings()
    if not body.userId:
        raise HTTPException(status_code=422, detail="userId este obligatoriu.")
    if not body.context.strip():
        raise HTTPException(status_code=422, detail="context este obligatoriu.")

    try:
        result = run_lead_outreach(
            user_id=body.userId,
            lead_name=body.leadName,
            company_name=body.companyName,
            phone=body.phone,
            email=body.email,
            context=body.context,
            preferred_channel=body.preferredChannel,
            mode=body.mode or "draft",
        )
        return LeadOutreachResponse(**result, model=settings.openrouter_model)
    except RuntimeError as exc:
        message = str(exc)
        if "Lipsește phone sau email" in message:
            raise HTTPException(status_code=422, detail=message) from exc
        raise HTTPException(status_code=502, detail=message) from exc
    except Exception as exc:
        logger.exception("Lead outreach failed: %s", exc)
        raise HTTPException(status_code=502, detail="Outreach AI nu a putut rula acum.") from exc


@app.post("/v1/leads/enrich", response_model=LeadEnrichResponse)
def lead_enrich(body: LeadEnrichRequest) -> LeadEnrichResponse:
    raise HTTPException(
        status_code=410,
        detail="Endpoint-ul de enrichment separat a fost dezactivat. Folosește lead-urile reale descoperite.",
    )


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
def create_embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    settings = get_settings()
    if settings.gemini_enabled:
        try:
            vector = embed(body.text)
            return EmbeddingResponse(
                entityType=body.entityType,
                entityId=body.entityId,
                dimensions=len(vector),
                model=settings.openrouter_embed_model,
                preview=vector[:8],
                stored=False,
            )
        except Exception as exc:
            logger.warning("Embedding failed: %s", exc)
            raise HTTPException(status_code=502, detail="Embedding-ul real a eșuat.") from exc

    raise HTTPException(
        status_code=503,
        detail="Embedding-ul cere OPEN_ROUTER_KEY configurat.",
    )


@app.post("/v1/leads/discover", response_model=DiscoverLeadsResponse)
def leads_discover(body: DiscoverLeadsRequest) -> DiscoverLeadsResponse:
    try:
        result = discover_leads(
            user_id=body.userId,
            products=body.products,
            locality=body.locality,
            latitude=body.latitude,
            longitude=body.longitude,
            range_km=body.rangeKm,
            limit=body.limit,
            force_refresh=body.forceRefresh,
            discover_more=body.discoverMore,
        )
        return DiscoverLeadsResponse(
            leads=[DiscoveredLead(**lead) for lead in result["leads"]],
            areaKey=result["areaKey"],
            fromCache=result["fromCache"],
            producerNeeds=result["producerNeeds"],
        )
    except Exception as exc:
        logger.exception("Discover failed: %s", exc)
        raise HTTPException(status_code=502, detail="Nu am putut descoperi lead-uri acum.") from exc


@app.post("/v1/leads/list", response_model=DiscoverLeadsResponse)
def leads_list(body: ListDiscoveredRequest) -> DiscoverLeadsResponse:
    leads = list_discovered_leads(body.userId, body.latitude, body.longitude, products=body.products)
    return DiscoverLeadsResponse(
        leads=[DiscoveredLead(**lead) for lead in leads],
        areaKey="",
        fromCache=True,
        producerNeeds=[],
    )


@app.post("/v1/leads/status")
def leads_status(body: BuyerStatusRequest) -> dict[str, str]:
    return update_buyer_status(body.userId, body.buyerId, body.status, body.reason)


@app.post("/v1/suppliers/discover", response_model=DiscoverSuppliersResponse)
def suppliers_discover(body: DiscoverSuppliersRequest) -> DiscoverSuppliersResponse:
    try:
        result = discover_suppliers(
            user_id=body.userId,
            products_needed=body.productsNeeded,
            locality=body.locality,
            latitude=body.latitude,
            longitude=body.longitude,
            range_km=body.rangeKm,
            limit=body.limit,
            force_refresh=body.forceRefresh,
            venue_business_name=body.venueBusinessName,
        )
        return DiscoverSuppliersResponse(
            producers=[DiscoveredSupplier(**producer) for producer in result["producers"]],
            areaKey=result["areaKey"],
            fromCache=result["fromCache"],
            venueNeeds=result["venueNeeds"],
        )
    except Exception as exc:
        logger.exception("Supplier discover failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Nu am putut descoperi producători acum.",
        ) from exc


@app.post("/v1/suppliers/list", response_model=DiscoverSuppliersResponse)
def suppliers_list(body: ListDiscoveredSuppliersRequest) -> DiscoverSuppliersResponse:
    producers = list_discovered_suppliers(
        body.userId,
        body.latitude,
        body.longitude,
        venue_business_name=body.venueBusinessName,
    )
    return DiscoverSuppliersResponse(
        producers=[DiscoveredSupplier(**producer) for producer in producers],
        areaKey="",
        fromCache=True,
        venueNeeds=[],
    )


@app.post("/v1/suppliers/status")
def suppliers_status(body: SupplierStatusRequest) -> dict[str, str]:
    return update_supplier_status(body.userId, body.supplierId, body.status, body.reason)
