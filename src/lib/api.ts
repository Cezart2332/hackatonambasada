import { API_BASE } from "./config";
import { ApiError, messageFromApiResponse, messageFromUnknownError } from "./errors";
import type { Lead, LeadStatus, ProducerProduct, ProducerSetup, Profile } from "./types";

export type ApiProduct = {
  id: string;
  name: string;
  estimatedQuantity: string;
  unit: string;
  pricePerKg: string;
  availableFrom: string;
};

export type ApiProfile = {
  id: string;
  location: string;
  locationChoice: string | null;
  latitude: number | null;
  longitude: number | null;
  rangeKm: number;
  deliveryDays: string;
  products: ApiProduct[];
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const parsed = typeof body === "object" && body && "error" in body
        ? (body as { error?: { code?: string } }).error
        : undefined;
      throw new ApiError(
        messageFromApiResponse(body, response.status),
        response.status,
        parsed?.code,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      messageFromUnknownError(error, "Nu am putut finaliza cererea. Încearcă din nou."),
    );
  }
}

export function parseRangeKm(range: string): number {
  const match = range.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 35;
}

export function setupToApiPayload(setup: ProducerSetup | Profile) {
  const locationChoice =
    "locationChoice" in setup && setup.locationChoice ? setup.locationChoice : undefined;

  return {
    location: setup.location ?? "",
    locationChoice: locationChoice?.label ?? null,
    latitude: locationChoice?.lat ? Number.parseFloat(locationChoice.lat) : null,
    longitude: locationChoice?.lon ? Number.parseFloat(locationChoice.lon) : null,
    rangeKm: parseRangeKm(("range" in setup && setup.range) || "35 km"),
    deliveryDays: setup.days ?? "",
    products: (setup.products ?? []).map((product) => ({
      name: product.name,
      estimatedQuantity: product.estimatedQuantity,
      unit: product.unit,
      pricePerKg: product.pricePerKg,
      availableFrom: product.availableFrom,
    })),
  };
}

export function summarizeProducts(products: ProducerProduct[] = []) {
  const filledProducts = products.filter((product) => product.name.trim());

  if (!filledProducts.length) {
    return { product: "", quantity: "", full: "" };
  }

  return {
    product: filledProducts.map((p) => p.name.trim()).join(", "),
    quantity: filledProducts
      .map((p) =>
        p.estimatedQuantity.trim()
          ? `${p.estimatedQuantity.trim()} ${p.unit.trim() || "kg"}`
          : "cantitate de confirmat",
      )
      .join("; "),
    full: filledProducts
      .map((product) => {
        const quantity = product.estimatedQuantity.trim()
          ? `${product.estimatedQuantity.trim()} ${product.unit.trim() || "kg"}`
          : "cantitate de confirmat";
        const price = product.pricePerKg.trim()
          ? `${product.pricePerKg.trim()} lei/kg`
          : "preț de confirmat";
        return `${product.name.trim()} (${quantity}, ${price}, disponibil: ${product.availableFrom.trim() || "curând"})`;
      })
      .join("; "),
  };
}

export function apiProfileToFrontend(
  dto: ApiProfile,
  extras?: { producerName?: string; businessName?: string; phone?: string },
): Profile {
  const products: ProducerProduct[] = dto.products.map((p) => ({
    id: p.id,
    name: p.name,
    estimatedQuantity: p.estimatedQuantity,
    unit: p.unit,
    pricePerKg: p.pricePerKg,
    availableFrom: p.availableFrom,
  }));

  const summary = summarizeProducts(products);

  return {
    producerName: extras?.producerName,
    businessName: extras?.businessName,
    phone: extras?.phone,
    products,
    product: summary.product,
    quantity: summary.quantity,
    location: dto.location,
    locationChoice:
      dto.latitude != null && dto.longitude != null
        ? {
            label: dto.locationChoice ?? dto.location,
            lat: String(dto.latitude),
            lon: String(dto.longitude),
          }
        : undefined,
    range: `${Math.round(dto.rangeKm)} km`,
    days: dto.deliveryDays,
  };
}

export const api = {
  getProfile: () => apiFetch<ApiProfile>("/api/producers/me"),

  updateProfile: (payload: ReturnType<typeof setupToApiPayload>) =>
    apiFetch<ApiProfile>("/api/producers/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  matchLeads: () =>
    apiFetch<{ leads: Lead[] }>("/api/leads/match", { method: "POST", body: "{}" }),

  listLeads: () => apiFetch<{ leads: Array<Lead & { status?: LeadStatus | null }> }>("/api/leads"),

  updateLeadStatus: (leadId: string, status: LeadStatus) =>
    apiFetch<{ leadId: string; status: LeadStatus }>(`/api/leads/${leadId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  geoSearch: async (query: string) => {
    const data = await apiFetch<{
      results: Array<{ label: string; latitude: number; longitude: number }>;
    }>(`/api/geo/search?q=${encodeURIComponent(query)}`);
    return data.results.map((item, index) => ({
      place_id: index,
      display_name: item.label,
      lat: String(item.latitude),
      lon: String(item.longitude),
    }));
  },

  chatReply: (payload: { step: string; userAnswer: string; profileHint?: string }) =>
    apiFetch<{ reply: string }>("/api/ai/v1/chat/reply", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  draftMessage: (payload: {
    businessName: string;
    productSummary?: string;
    locality?: string;
    tone?: string;
  }) =>
    apiFetch<{ message: string }>("/api/ai/v1/messages/draft", {
      method: "POST",
      body: JSON.stringify({
        businessName: payload.businessName,
        productSummary: payload.productSummary ?? "",
        locality: payload.locality ?? "",
        tone: payload.tone ?? "cald, direct",
      }),
    }),

  enrichLead: (payload: { leadName: string; leadType?: string; productSummary?: string }) =>
    apiFetch<{
      reason: string;
      suggestedPitch: string;
      bestDay: string;
      tone: string;
      matchScore: number;
    }>("/api/ai/v1/leads/enrich", {
      method: "POST",
      body: JSON.stringify({
        leadName: payload.leadName,
        leadType: payload.leadType ?? "",
        productSummary: payload.productSummary ?? "",
      }),
    }),
};
