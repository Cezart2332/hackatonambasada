import type { AiDiscoveredLead } from "../leads/lead.ai.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";

export type AiDiscoveredSupplier = AiDiscoveredLead;

export type DiscoverSuppliersParams = {
  userId: string;
  productsNeeded: string[];
  locality: string;
  latitude: number;
  longitude: number;
  rangeKm: number;
  limit?: number;
  forceRefresh?: boolean;
  venueBusinessName?: string;
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

export async function discoverSuppliers(
  params: DiscoverSuppliersParams,
): Promise<AiDiscoveredSupplier[] | null> {
  const data = await aiPost<{ producers: AiDiscoveredSupplier[] }>(
    "/v1/suppliers/discover",
    {
      userId: params.userId,
      productsNeeded: params.productsNeeded,
      locality: params.locality,
      latitude: params.latitude,
      longitude: params.longitude,
      rangeKm: params.rangeKm,
      limit: params.limit ?? 5,
      forceRefresh: params.forceRefresh ?? false,
      venueBusinessName: params.venueBusinessName ?? "",
    },
    300_000,
  );

  return data?.producers ?? null;
}

export async function listDiscoveredSuppliers(
  userId: string,
  latitude: number,
  longitude: number,
  venueBusinessName = "",
): Promise<AiDiscoveredSupplier[] | null> {
  const data = await aiPost<{ producers: AiDiscoveredSupplier[] }>(
    "/v1/suppliers/list",
    {
      userId,
      latitude,
      longitude,
      venueBusinessName,
    },
    15_000,
  );

  return data?.producers ?? null;
}

export async function updateSupplierStatus(
  userId: string,
  supplierId: string,
  status: string,
  reason?: string,
): Promise<boolean> {
  const data = await aiPost<{ producerUserId: string; status: string }>(
    "/v1/suppliers/status",
    {
      userId,
      supplierId,
      status,
      reason: reason ?? null,
    },
  );

  return Boolean(data);
}

export function isSupplierLeadId(leadId: string): boolean {
  return leadId.startsWith("supplier_");
}
