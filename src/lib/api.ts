import { API_BASE } from "./config";
import type { VenueMatchDiagnostics } from "./venueChatUtils";
import { ApiError, messageFromApiResponse, messageFromUnknownError } from "./errors";
import { formatAvailableFromDisplay } from "./availableFrom";
import { getPackagingLabel, getPriceUnitShort, normalizeLegacyProduct } from "./productCatalog";
import type {
  AccountType,
  Lead,
  LeadStats,
  LeadStatus,
  PlanContext,
  ProducerProduct,
  ProducerSetup,
  Profile,
  SimulatedCampaignStep,
  VenueSetup,
} from "./types";

const LEAD_DISCOVERY_TIMEOUT_MS = 300_000;

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
  businessName: string;
  phone: string;
  location: string;
  locationChoice: string | null;
  latitude: number | null;
  longitude: number | null;
  rangeKm: number;
  deliveryDays: string;
  extraDetails: string;
  approvalStatus: "pending" | "approved" | "rejected";
  products: ApiProduct[];
};

export type ApiVenueProfile = {
  id: string;
  businessName: string;
  venueType: string;
  phone: string;
  location: string;
  locationChoice: string | null;
  latitude: number | null;
  longitude: number | null;
  approvalStatus: "pending" | "approved" | "rejected";
};

export type ApiAccount = {
  accountType: AccountType;
  approvalStatus: "pending" | "approved" | "rejected" | null;
};

export type AdminRegistration = {
  userId: string;
  accountType: "producer" | "venue";
  approvalStatus: "pending" | "approved" | "rejected";
  contactName: string;
  email: string;
  phone: string;
  businessName: string;
  location: string;
  locationChoice: string | null;
  registeredAt: string;
  updatedAt: string;
  producer?: {
    rangeKm: number;
    deliveryDays: string;
    extraDetails: string;
    products: Array<{
      name: string;
      estimatedQuantity: string;
      unit: string;
      pricePerKg: string;
      availableFrom: string;
    }>;
  };
  venue?: {
    venueType: string;

  };
};

async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = 30_000): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
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
    businessName: ("businessName" in setup && setup.businessName) || "",
    phone: ("phone" in setup && setup.phone) || "",
    location: setup.location ?? "",
    locationChoice: locationChoice?.label ?? null,
    latitude: locationChoice?.lat ? Number.parseFloat(locationChoice.lat) : null,
    longitude: locationChoice?.lon ? Number.parseFloat(locationChoice.lon) : null,
    rangeKm: parseRangeKm(("range" in setup && setup.range) || "35 km"),
    deliveryDays: setup.days ?? "",
    extraDetails: ("extraDetails" in setup && setup.extraDetails) || "",
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
        const priceUnit = getPriceUnitShort(product.baseUnit || "kg");
        const packaging = product.packaging
          ? getPackagingLabel(product.category || "legume_fructe", product.packaging)
          : product.unit.trim() || "ambalaj de confirmat";
        const price = product.pricePerKg.trim()
          ? `${product.pricePerKg.trim()} lei/${priceUnit}`
          : "preț de confirmat";
        const available = formatAvailableFromDisplay(product.availableFrom) || "curând";
        return `${product.name.trim()} (${quantity}, ${price} în ${packaging}, disponibil: ${available})`;
      })
      .join("; "),
  };
}

export function setupVenueToApiPayload(setup: VenueSetup) {
  const locationChoice = setup.locationChoice;

  return {
    businessName: setup.businessName,
    venueType: setup.venueType,
    phone: setup.phone,
    location: setup.location,
    locationChoice: locationChoice?.label ?? null,
    latitude: locationChoice?.lat ? Number.parseFloat(locationChoice.lat) : null,
    longitude: locationChoice?.lon ? Number.parseFloat(locationChoice.lon) : null,
  };
}

export function apiVenueProfileToFrontend(
  dto: ApiVenueProfile,
  extras?: { contactName?: string },
): Profile {
  return {
    producerName: extras?.contactName,
    businessName: dto.businessName,
    phone: dto.phone,
    venueType: dto.venueType as Profile["venueType"],
    location: dto.location,
    locationChoice:
      dto.latitude != null && dto.longitude != null
        ? {
            label: dto.locationChoice ?? dto.location,
            lat: String(dto.latitude),
            lon: String(dto.longitude),
          }
        : undefined,
  };
}

export function apiProfileToFrontend(
  dto: ApiProfile,
  extras?: { producerName?: string; businessName?: string; phone?: string },
): Profile {
  const products: ProducerProduct[] = dto.products.map((p) => {
    const legacy = normalizeLegacyProduct({
      name: p.name,
      unit: p.unit,
    });
    return {
      id: p.id,
      name: p.name,
      category: legacy.category,
      estimatedQuantity: p.estimatedQuantity,
      baseUnit: legacy.baseUnit,
      packaging: legacy.packaging,
      unit: legacy.unit,
      pricePerKg: p.pricePerKg,
      availableFrom: p.availableFrom,
    };
  });

  const summary = summarizeProducts(products);

  return {
    producerName: extras?.producerName,
    businessName: dto.businessName || extras?.businessName,
    phone: dto.phone || extras?.phone,
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
    extraDetails: dto.extraDetails,
  };
}

export const api = {
  getAccount: () => apiFetch<ApiAccount>("/api/account/me"),

  getPlan: () => apiFetch<{ plan: PlanContext }>("/api/account/plan"),

  upgradePro: () =>
    apiFetch<{ plan: PlanContext }>("/api/account/upgrade-pro", {
      method: "POST",
      body: "{}",
    }),

  downgradeFree: () =>
    apiFetch<{ plan: PlanContext }>("/api/account/downgrade-free", {
      method: "POST",
      body: "{}",
    }),

  getLeadStats: () => apiFetch<{ stats: LeadStats }>("/api/leads/stats"),

  getProfile: () => apiFetch<ApiProfile>("/api/producers/me"),

  updateProfile: (payload: ReturnType<typeof setupToApiPayload>) =>
    apiFetch<ApiProfile>("/api/producers/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getVenueProfile: () => apiFetch<ApiVenueProfile>("/api/venues/me"),

  updateVenueProfile: (payload: ReturnType<typeof setupVenueToApiPayload>) =>
    apiFetch<ApiVenueProfile>("/api/venues/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  matchLeads: () =>
    apiFetch<{ leads: Lead[] }>(
      "/api/leads/match",
      { method: "POST", body: "{}" },
      LEAD_DISCOVERY_TIMEOUT_MS,
    ),

  matchMoreLeads: () =>
    apiFetch<{ leads: Lead[] }>(
      "/api/leads/match/more",
      { method: "POST", body: "{}" },
      LEAD_DISCOVERY_TIMEOUT_MS,
    ),

  listLeads: () => apiFetch<{ leads: Array<Lead & { status?: LeadStatus | null }> }>("/api/leads"),

  updateLeadStatus: (leadId: string, status: LeadStatus, reason?: string) =>
    apiFetch<{ leadId: string; status: LeadStatus; storedPreferences?: string }>(
      `/api/leads/${leadId}/status`,
      {
        method: "PUT",
        body: JSON.stringify({ status, reason }),
      },
    ),

  simulateCampaign: (payload?: { leadIds?: string[]; maxLeads?: number }) =>
    apiFetch<{ steps: SimulatedCampaignStep[]; disclaimer: string }>(
      "/api/leads/campaign/simulate",
      {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      },
      LEAD_DISCOVERY_TIMEOUT_MS,
    ),

  listMatchedProducers: (scope: "matched" | "all" = "matched", productsNeeded?: string) => {
    const params = new URLSearchParams({ scope });
    if (productsNeeded?.trim()) params.set("productsNeeded", productsNeeded.trim());
    return apiFetch<{
      producers: Array<Lead & { status?: LeadStatus | null }>;
      diagnostics?: VenueMatchDiagnostics;
    }>(`/api/venues/me/matched-producers?${params.toString()}`);
  },

  refreshMatchedProducers: (productsNeeded?: string) =>
    apiFetch<{ producers: Lead[]; diagnostics?: VenueMatchDiagnostics }>("/api/venues/me/matched-producers/refresh", {
      method: "POST",
      body: JSON.stringify(
        productsNeeded?.trim() ? { productsNeeded: productsNeeded.trim() } : {},
      ),
    }),

  /** @deprecated Use refreshMatchedProducers */
  discoverMatchedProducers: () =>
    apiFetch<{ producers: Lead[] }>("/api/venues/me/matched-producers/refresh", {
      method: "POST",
      body: "{}",
    }),

  /** @deprecated Use listMatchedProducers('all') */
  discoverMoreProducers: () =>
    apiFetch<{ producers: Lead[] }>("/api/venues/me/matched-producers?scope=all"),

  updateProducerMatchStatus: (producerUserId: string, status: LeadStatus) =>
    apiFetch<{ producerUserId: string; status: LeadStatus }>(
      `/api/venues/me/matched-producers/${producerUserId}/status`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
    ),

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

  chatReply: (payload: {
    userId: string;
    message: string;
    accountType?: "producer" | "venue";
    profile?: {
      product?: string;
      quantity?: string;
      products?: string[];
      location?: string;
      latitude?: number | null;
      longitude?: number | null;
      rangeKm?: number;
      range?: string;
      days?: string;
      deliveryDays?: string;
    };
  }) =>
    apiFetch<{
      reply: string;
      profileUpdates?: Record<string, unknown>;
      leads?: Lead[];
      onboardingComplete?: boolean;
    }>("/api/ai/v1/chat/reply", {
      method: "POST",
      body: JSON.stringify(payload),
    }, LEAD_DISCOVERY_TIMEOUT_MS),

  draftMessage: (payload: {
    businessName: string;
    productSummary?: string;
    locality?: string;
    tone?: string;
    leadType?: string;
    website?: string;
    menuItems?: string;
    notes?: string;
    accountType?: "venue" | "producer";
    venueBusinessName?: string;
    supplyFrequency?: string;
    preferredDays?: string;
  }) =>
    apiFetch<{ message: string }>("/api/ai/v1/messages/draft", {
      method: "POST",
      body: JSON.stringify({
        businessName: payload.businessName,
        productSummary: payload.productSummary ?? "",
        locality: payload.locality ?? "",
        tone: payload.tone ?? "cald, direct",
        leadType: payload.leadType ?? "",
        website: payload.website ?? "",
        menuItems: payload.menuItems ?? "",
        notes: payload.notes ?? "",
        accountType: payload.accountType ?? "producer",
        venueBusinessName: payload.venueBusinessName ?? "",
        supplyFrequency: payload.supplyFrequency ?? "",
        preferredDays: payload.preferredDays ?? "",
      }),
    }),

  listAdminRegistrations: (status?: "pending" | "approved" | "rejected") => {
    const query = status ? `?status=${status}` : "";
    return apiFetch<{ registrations: AdminRegistration[] }>(`/api/admin/registrations${query}`);
  },

  reviewRegistration: (userId: string, status: "approved" | "rejected") =>
    apiFetch<{ userId: string; status: "approved" | "rejected" }>(
      `/api/admin/registrations/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
    ),

  listAdminActiveAccounts: (type?: "producer" | "venue" | "all") => {
    const query =
      type && type !== "all" ? `?type=${type}` : type === "all" ? "" : "";
    return apiFetch<{ accounts: AdminRegistration[] }>(`/api/admin/active-accounts${query}`);
  },

  updateAdminActiveAccount: (userId: string, status: "approved" | "rejected") =>
    apiFetch<{ userId: string; status: "approved" | "rejected" }>(
      `/api/admin/active-accounts/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
    ),

};
