from typing import Any

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "warm-leads-ai"
    mode: str = "unavailable"


class ChatProfileSnapshot(BaseModel):
    product: str = ""
    quantity: str = ""
    products: list[Any] = Field(default_factory=list)
    location: str = ""
    latitude: float | None = None
    longitude: float | None = None
    rangeKm: float = 35
    range: str = ""
    days: str = ""
    deliveryDays: str = ""


class ChatReplyRequest(BaseModel):
    userId: str | None = None
    message: str | None = None
    profile: ChatProfileSnapshot | None = None
    accountType: str | None = Field(default="producer", description="producer | venue")
    step: str | None = Field(default=None, description="Legacy onboarding step key")
    userAnswer: str | None = None
    profileHint: str | None = None


class MessageDraftRequest(BaseModel):
    businessName: str
    productSummary: str = ""
    locality: str = ""
    tone: str = "cald, direct"
    leadType: str = ""
    website: str = ""
    menuItems: str = ""
    notes: str = ""
    accountType: str = "producer"
    venueBusinessName: str = ""
    supplyFrequency: str = ""
    preferredDays: str = ""


class CampaignLeadInput(BaseModel):
    id: str
    name: str
    type: str = ""
    website: str = ""
    menuItems: str = ""
    notes: str = ""


class CampaignSimulateRequest(BaseModel):
    userId: str
    leads: list[CampaignLeadInput]
    productSummary: str = ""
    locality: str = ""
    tone: str = "cald, direct"
    maxLeads: int = 5
    senderEmail: str = ""
    senderPhone: str = ""


class SimulatedStep(BaseModel):
    leadId: str
    leadName: str
    draftMessage: str
    simulatedOutcome: str
    simulatedAction: str
    reasoning: str = ""
    deliveries: list[dict[str, str]] = Field(default_factory=list)


class CampaignSimulateResponse(BaseModel):
    steps: list[SimulatedStep]
    disclaimer: str
    model: str = "openrouter"


class MessageDraftResponse(BaseModel):
    message: str
    model: str = "openrouter"


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
    model: str = "openrouter"


class EmbeddingRequest(BaseModel):
    text: str
    entityType: str = "lead"
    entityId: str | None = None


class EmbeddingResponse(BaseModel):
    entityType: str
    entityId: str | None
    dimensions: int
    model: str = "openrouter"
    preview: list[float] = Field(..., description="First 8 dims only")
    stored: bool = False


class DiscoverLeadsRequest(BaseModel):
    userId: str
    products: list[str] = Field(default_factory=list)
    locality: str = "Dobrogea"
    latitude: float = 44.17
    longitude: float = 28.63
    rangeKm: float = 35
    limit: int = 3
    forceRefresh: bool = False
    discoverMore: bool = False


class DiscoveredLead(BaseModel):
    id: str
    name: str
    type: str
    location: str
    distance: str
    match: int
    reason: str
    sell: str
    bestDay: str
    contact: str
    tone: str
    icon: str
    coordinates: list[float]
    needs: list[str] = Field(default_factory=list)
    matchedNeeds: list[str] = Field(default_factory=list)
    website: str = ""
    phone: str = ""
    contactPerson: str = ""
    menuItems: str = ""
    notes: str = ""
    sourceUrls: list[str] = Field(default_factory=list)
    fromCache: bool = False
    status: str | None = None


class ChatReplyResponse(BaseModel):
    reply: str
    model: str = "openrouter"
    profileUpdates: dict[str, Any] | None = None
    leads: list[DiscoveredLead] | None = None
    onboardingComplete: bool = False


class DiscoverLeadsResponse(BaseModel):
    leads: list[DiscoveredLead]
    areaKey: str
    fromCache: bool
    producerNeeds: list[str] = Field(default_factory=list)


class ListDiscoveredRequest(BaseModel):
    userId: str
    latitude: float = 44.17
    longitude: float = 28.63
    products: list[Any] = Field(default_factory=list)


class BuyerStatusRequest(BaseModel):
    userId: str
    buyerId: str
    status: str
    reason: str | None = None


class DiscoverSuppliersRequest(BaseModel):
    userId: str
    productsNeeded: list[str] = Field(default_factory=list)
    locality: str = "Dobrogea"
    latitude: float = 44.17
    longitude: float = 28.63
    rangeKm: float = 35
    limit: int = 5
    forceRefresh: bool = False
    venueBusinessName: str = ""


class DiscoveredSupplier(BaseModel):
    id: str
    name: str
    type: str
    location: str
    distance: str
    match: int
    reason: str
    sell: str
    bestDay: str
    contact: str
    tone: str
    icon: str
    coordinates: list[float]
    needs: list[str] = Field(default_factory=list)
    matchedNeeds: list[str] = Field(default_factory=list)
    website: str = ""
    phone: str = ""
    contactPerson: str = ""
    menuItems: str = ""
    notes: str = ""
    sourceUrls: list[str] = Field(default_factory=list)
    fromCache: bool = False
    status: str | None = None


class DiscoverSuppliersResponse(BaseModel):
    producers: list[DiscoveredSupplier]
    areaKey: str
    fromCache: bool
    venueNeeds: list[str] = Field(default_factory=list)


class ListDiscoveredSuppliersRequest(BaseModel):
    userId: str
    latitude: float = 44.17
    longitude: float = 28.63
    venueBusinessName: str = ""


class SupplierStatusRequest(BaseModel):
    userId: str
    supplierId: str
    status: str
    reason: str | None = None


class LeadOutreachRequest(BaseModel):
    userId: str
    leadName: str = ""
    companyName: str = ""
    phone: str = ""
    email: str = ""
    context: str = ""
    preferredChannel: str = ""
    mode: str = "draft"


class LeadOutreachResponse(BaseModel):
    mode: str = "draft"
    channel: str = ""
    recipient: str = ""
    subject: str = ""
    message: str = ""
    analysis: str = ""
    sent: bool = False
    sendResult: dict[str, Any] = Field(default_factory=dict)
    model: str = "openrouter"
