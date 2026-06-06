from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.mocks import (
    MOCK_EMBEDDING_DIM,
    mock_embedding,
    mock_lead_enrichment,
    mock_message_draft,
    mock_onboarding_reply,
)
from app.models import (
    ChatReplyRequest,
    ChatReplyResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    HealthResponse,
    LeadEnrichRequest,
    LeadEnrichResponse,
    MessageDraftRequest,
    MessageDraftResponse,
)

app = FastAPI(
    title="Warm Leads AI",
    description="Mock AI service — real models + pgvector embeddings coming later.",
    version="0.1.0",
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
    return HealthResponse()


@app.post("/v1/chat/reply", response_model=ChatReplyResponse)
def chat_reply(body: ChatReplyRequest) -> ChatReplyResponse:
    reply = mock_onboarding_reply(body.step, body.userAnswer, body.profileHint)
    return ChatReplyResponse(reply=reply)


@app.post("/v1/messages/draft", response_model=MessageDraftResponse)
def message_draft(body: MessageDraftRequest) -> MessageDraftResponse:
    message = mock_message_draft(
        body.businessName,
        body.productSummary,
        body.locality,
        body.tone,
    )
    return MessageDraftResponse(message=message)


@app.post("/v1/leads/enrich", response_model=LeadEnrichResponse)
def lead_enrich(body: LeadEnrichRequest) -> LeadEnrichResponse:
    data = mock_lead_enrichment(body.leadName, body.leadType, body.productSummary)
    return LeadEnrichResponse(**data)


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
def create_embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    seed = body.entityId or body.text[:64]
    vector = mock_embedding(seed)
    return EmbeddingResponse(
        entityType=body.entityType,
        entityId=body.entityId,
        dimensions=MOCK_EMBEDDING_DIM,
        preview=vector[:8],
        stored=False,
    )
