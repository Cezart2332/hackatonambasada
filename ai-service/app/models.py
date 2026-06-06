from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "warm-leads-ai"
    mode: str = "mock"


class ChatReplyRequest(BaseModel):
    step: str = Field(..., description="Onboarding step key: product, quantity, location, range, days")
    userAnswer: str
    profileHint: str | None = None


class ChatReplyResponse(BaseModel):
    reply: str
    model: str = "mock-v1"


class MessageDraftRequest(BaseModel):
    businessName: str
    productSummary: str = ""
    locality: str = ""
    tone: str = "cald, direct"


class MessageDraftResponse(BaseModel):
    message: str
    model: str = "mock-v1"


class LeadEnrichRequest(BaseModel):
    leadName: str
    leadType: str = ""
    productSummary: str = ""


class LeadEnrichResponse(BaseModel):
    leadName: str
    leadType: str
    matchScore: int
    reason: str
    suggestedPitch: str
    bestDay: str
    tone: str
    model: str = "mock-v1"


class EmbeddingRequest(BaseModel):
    text: str
    entityType: str = "lead"
    entityId: str | None = None


class EmbeddingResponse(BaseModel):
    entityType: str
    entityId: str | None
    dimensions: int
    model: str = "mock-v1"
    preview: list[float] = Field(..., description="First 8 dims only (full vector stored later)")
    stored: bool = False
