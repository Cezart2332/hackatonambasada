import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  assertCanDiscover,
  assertCanSimulate,
  discoveryLimitForPlan,
  getPlanContext,
  recordDiscovery,
  recordSimulation,
} from "../billing/plan.service.js";
import {
  discoverLeads,
  isBuyerLeadId,
  listDiscoveredLeads,
  simulateCampaign,
  updateBuyerStatus,
} from "./lead.ai.js";
import {
  mapDiscoveredLeadToDto,
  mapLeadForPlan,
} from "./lead.mapper.js";
import type { CampaignSimulateInput, MatchLeadsInput } from "./lead.schema.js";

const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;

async function getProfileContext(userId: string) {
  let profile = await prisma.producerProfile.findUnique({
    where: { userId },
    include: { products: true },
  });

  if (!profile) {
    profile = await prisma.producerProfile.create({
      data: { userId },
      include: { products: true },
    });
  }

  return profile;
}

async function discoverAiLeads(
  userId: string,
  input: MatchLeadsInput = {},
  options: { discoverMore?: boolean } = {},
) {
  const profile = await getProfileContext(userId);
  const latitude = input.latitude ?? profile.latitude ?? DEFAULT_LAT;
  const longitude = input.longitude ?? profile.longitude ?? DEFAULT_LON;
  const rangeKm = input.rangeKm ?? profile.rangeKm ?? 35;
  const locality = profile.location || profile.locationChoice || "Dobrogea";
  const products = profile.products.map((p) => p.name);
  const limit = input.limit ?? 3;

  const discovered = await discoverLeads({
    userId,
    products,
    locality,
    latitude,
    longitude,
    rangeKm,
    limit,
    forceRefresh: input.forceRefresh,
    discoverMore: options.discoverMore ?? false,
  });

  if (!discovered?.length) {
    return null;
  }

  return discovered.map(mapDiscoveredLeadToDto);
}

export async function matchForUser(
  userId: string,
  input: MatchLeadsInput = {},
  accountType?: string,
) {
  const ctx = await assertCanDiscover(userId, { accountType });
  const limit = discoveryLimitForPlan(ctx);
  if (limit <= 0) {
    return [];
  }

  const aiLeads = await discoverAiLeads(userId, { ...input, limit });
  if (aiLeads?.length) {
    if (accountType !== "VENUE" && accountType !== "venue") {
      await recordDiscovery(userId);
    }
    return aiLeads;
  }

  return [];
}

export async function matchMoreForUser(
  userId: string,
  input: MatchLeadsInput = {},
  accountType?: string,
) {
  const ctx = await assertCanDiscover(userId, { discoverMore: true, accountType });
  const limit = discoveryLimitForPlan(ctx);
  if (limit <= 0) {
    return [];
  }

  const aiLeads = await discoverAiLeads(userId, { ...input, limit }, { discoverMore: true });
  if (aiLeads?.length) {
    if (accountType !== "VENUE" && accountType !== "venue") {
      await recordDiscovery(userId);
    }
    return aiLeads;
  }

  return [];
}

export async function listLeadsForUser(userId: string, accountType?: string) {
  const profile = await getProfileContext(userId);
  const latitude = profile.latitude ?? DEFAULT_LAT;
  const longitude = profile.longitude ?? DEFAULT_LON;
  const plan = await getPlanContext(userId, accountType);

  const aiListed = await listDiscoveredLeads(userId, latitude, longitude);
  if (aiListed?.length) {
    return aiListed.map((lead) =>
      mapLeadForPlan(
        {
          ...mapDiscoveredLeadToDto(lead),
          status: lead.status ?? null,
        },
        plan.tier,
        lead.status,
      ),
    );
  }

  try {
    const discovered = await matchForUser(userId, {}, accountType);
    if (discovered?.length) {
      return discovered.map((lead) => ({ ...lead, status: null }));
    }
  } catch {
    return [];
  }

  return [];
}

export async function getLeadById(userId: string, leadId: string, accountType?: string) {
  if (isBuyerLeadId(leadId)) {
    const profile = await getProfileContext(userId);
    const plan = await getPlanContext(userId, accountType);
    const listed = await listDiscoveredLeads(
      userId,
      profile.latitude ?? DEFAULT_LAT,
      profile.longitude ?? DEFAULT_LON,
    );
    const found = listed?.find((l) => l.id === leadId);
    if (found) {
      return mapLeadForPlan(
        {
          ...mapDiscoveredLeadToDto(found),
          status: found.status ?? null,
        },
        plan.tier,
        found.status,
      );
    }
    throw new AppError("Lead not found", 404, "NOT_FOUND");
  }

  throw new AppError("Lead not found", 404, "NOT_FOUND");
}

export async function simulateCampaignForUser(
  userId: string,
  input: CampaignSimulateInput = {},
  accountType?: string,
) {
  if (accountType === "venue" || accountType === "VENUE") {
    throw new AppError(
      "Simularea campaniei este disponibilă doar pentru producători.",
      403,
      "VENUE_NOT_SUPPORTED",
    );
  }

  await assertCanSimulate(userId, accountType);

  const profile = await getProfileContext(userId);
  const allLeads = await listLeadsForUser(userId, accountType);
  const maxLeads = input.maxLeads ?? 5;

  let selected = allLeads.filter((lead) => lead.status !== "Nu e potrivit");
  if (input.leadIds?.length) {
    const idSet = new Set(input.leadIds);
    selected = allLeads.filter((lead) => idSet.has(lead.id));
  }

  selected = selected.slice(0, maxLeads);
  if (!selected.length) {
    throw new AppError("Nu există lead-uri de simulat.", 400, "NO_LEADS");
  }

  const productSummary = profile.products.map((p) => p.name).filter(Boolean).join(", ");
  const locality = profile.location || profile.locationChoice || "Dobrogea";

  const result = await simulateCampaign({
    userId,
    leads: selected.map((lead) => {
      const enriched = lead as typeof lead & {
        website?: string;
        menuItems?: string;
        notes?: string;
      };
      return {
        id: lead.id,
        name: lead.name,
        type: lead.type,
        website: enriched.website ?? "",
        menuItems: enriched.menuItems ?? "",
        notes: enriched.notes ?? "",
      };
    }),
    productSummary: productSummary || "produse locale",
    locality,
    maxLeads,
  });

  if (!result) {
    throw new AppError("Simularea campaniei a eșuat.", 502, "AI_SIMULATE_FAILED");
  }

  if (accountType !== "VENUE" && accountType !== "venue") {
    await recordSimulation(userId);
  }

  return result;
}

export async function updateLeadStatus(
  userId: string,
  leadId: string,
  status: string,
  reason?: string,
) {
  if (isBuyerLeadId(leadId)) {
    const ok = await updateBuyerStatus(userId, leadId, status, reason);
    if (!ok) {
      throw new AppError("Nu am putut salva statusul lead-ului.", 502, "AI_STATUS_FAILED");
    }
    return { leadId, status };
  }

  throw new AppError("Lead not found", 404, "NOT_FOUND");
}
