const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export type AiDiscoveredLead = {
  id: string;
  name: string;
  type: string;
  location: string;
  distance: string;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  icon: string;
  coordinates: [number, number];
  needs?: string[];
  matchedNeeds?: string[];
  matchFactors?: {
    productScore: number;
    historyScore?: number;
    distanceKm: number;
    producerRangeKm: number;
    inRange: boolean;
    proximityBonus: number;
  };
  website?: string;
  phone?: string;
  contactPerson?: string;
  menuItems?: string;
  notes?: string;
  sourceUrls?: string[];
  fromCache?: boolean;
  platformRegistered?: boolean;
  status?: string | null;
};

export type DiscoverParams = {
  userId: string;
  products: string[];
  locality: string;
  latitude: number;
  longitude: number;
  rangeKm: number;
  limit?: number;
  discoverMore?: boolean;
  forceRefresh?: boolean;
};

async function aiPost<T>(
  path: string,
  body: unknown,
  timeoutMs = 120_000,
): Promise<T | null> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      console.warn(`AI service ${path} failed: ${response.status}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`AI service ${path} unreachable`, error);
    return null;
  }
}

export async function discoverLeads(
  params: DiscoverParams,
): Promise<AiDiscoveredLead[] | null> {
  const data = await aiPost<{ leads: AiDiscoveredLead[] }>(
    "/v1/leads/discover",
    {
      userId: params.userId,
      products: params.products,
      locality: params.locality,
      latitude: params.latitude,
      longitude: params.longitude,
      rangeKm: params.rangeKm,
      limit: params.limit ?? 3,
      forceRefresh: params.forceRefresh ?? false,
      discoverMore: params.discoverMore ?? false,
    },
    300_000,
  );

  return data?.leads ?? null;
}

export async function listDiscoveredLeads(
  userId: string,
  latitude: number,
  longitude: number,
  products: string[] = [],
): Promise<AiDiscoveredLead[] | null> {
  const data = await aiPost<{ leads: AiDiscoveredLead[] }>(
    "/v1/leads/list",
    {
      userId,
      latitude,
      longitude,
      products,
    },
    15_000,
  );

  return data?.leads ?? null;
}

export async function updateBuyerStatus(
  userId: string,
  buyerId: string,
  status: string,
  reason?: string,
): Promise<boolean> {
  const data = await aiPost<{ leadId: string; status: string }>("/v1/leads/status", {
    userId,
    buyerId,
    status,
    reason: reason ?? null,
  });

  return Boolean(data);
}

export type SimulatedStep = {
  leadId: string;
  leadName: string;
  draftMessage: string;
  simulatedOutcome: string;
  simulatedAction: string;
  reasoning: string;
  deliveries?: Array<{
    channel: string;
    target: string;
    status: string;
    detail?: string;
    providerId?: string;
  }>;
};

export async function simulateCampaign(params: {
  userId: string;
  senderEmail?: string;
  senderPhone?: string;
  leads: Array<{
    id: string;
    name: string;
    type: string;
    website?: string;
    menuItems?: string;
    notes?: string;
  }>;
  productSummary: string;
  locality: string;
  maxLeads?: number;
}): Promise<{ steps: SimulatedStep[]; disclaimer: string } | null> {
  const data = await aiPost<{ steps: SimulatedStep[]; disclaimer: string }>(
    "/v1/campaign/simulate",
    {
      userId: params.userId,
      leads: params.leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        type: lead.type,
        website: lead.website ?? "",
        menuItems: lead.menuItems ?? "",
        notes: lead.notes ?? "",
      })),
      productSummary: params.productSummary,
      locality: params.locality,
      maxLeads: params.maxLeads ?? 5,
      senderEmail: params.senderEmail ?? "",
      senderPhone: params.senderPhone ?? "",
    },
    300_000,
  );

  return data;
}

export function isBuyerLeadId(leadId: string): boolean {
  return leadId.startsWith("buyer_");
}

export function isPlatformVenueLeadId(leadId: string): boolean {
  return Boolean(leadId) && !isBuyerLeadId(leadId);
}
