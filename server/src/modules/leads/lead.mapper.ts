import type { Lead, LeadIcon, LeadStatus, LeadStatusRecord } from "@prisma/client";
import type { PlanTier } from "../billing/plan.service.js";
import type { AiDiscoveredLead } from "./lead.ai.js";
import type { MatchedLead } from "./lead.matcher.js";
import { buildStatusTimeline } from "./lead.stats.service.js";

const statusToApi: Record<LeadStatus, string> = {
  BUN: "Bun",
  NU_E_POTRIVIT: "Nu e potrivit",
  CONTACTAT: "Contactat",
  A_RASPUNS: "A r\u0103spuns",
  A_CUMPARAT: "A cump\u0103rat",
};

const apiToStatus: Record<string, LeadStatus> = {
  Bun: "BUN",
  "Nu e potrivit": "NU_E_POTRIVIT",
  Contactat: "CONTACTAT",
  "A raspuns": "A_RASPUNS",
  "A r\u0103spuns": "A_RASPUNS",
  "A cumparat": "A_CUMPARAT",
  "A cump\u0103rat": "A_CUMPARAT",
};

export function mapLeadStatusToApi(status: LeadStatus): string {
  return statusToApi[status];
}

export function mapApiStatusToDb(status: string): LeadStatus {
  const mapped = apiToStatus[status];
  if (!mapped) {
    throw new Error(`Unknown status: ${status}`);
  }
  return mapped;
}

export function mapDiscoveredLeadToDto(lead: AiDiscoveredLead) {
  const validIcons: LeadIcon[] = ["restaurant", "hotel", "cafe", "shop", "deli"];
  const icon = validIcons.includes(lead.icon as LeadIcon)
    ? (lead.icon as LeadIcon)
    : "shop";

  return {
    id: lead.id,
    name: lead.name,
    type: lead.type,
    location: lead.location,
    distance: lead.distance,
    match: lead.match,
    reason: lead.reason,
    sell: lead.sell,
    bestDay: lead.bestDay,
    contact: lead.contact,
    tone: lead.tone,
    icon,
    coordinates: lead.coordinates,
    needs: lead.needs ?? [],
    matchedNeeds: lead.matchedNeeds ?? [],
    website: lead.website ?? "",
    phone: lead.phone ?? "",
    contactPerson: lead.contactPerson ?? "",
    menuItems: lead.menuItems ?? "",
    notes: lead.notes ?? "",
    sourceUrls: lead.sourceUrls ?? [],
  };
}

export function mapLeadToDto(lead: MatchedLead) {
  return {
    id: lead.id,
    name: lead.name,
    type: lead.type,
    location: lead.location,
    distance: `${Math.round(lead.distanceKm)} km`,
    match: lead.match,
    reason: lead.reason,
    sell: lead.sell,
    bestDay: lead.bestDay,
    contact: lead.contact,
    tone: lead.tone,
    icon: lead.icon as LeadIcon,
    coordinates: [lead.latitude, lead.longitude] as [number, number],
  };
}

export function mapLeadForPlan<T extends ReturnType<typeof mapDiscoveredLeadToDto>>(
  lead: T,
  tier: PlanTier,
  status?: string | null,
) {
  if (tier !== "pro") {
    return lead;
  }

  return {
    ...lead,
    proDetails: {
      sourceUrls: lead.sourceUrls ?? [],
      notes: lead.notes ?? "",
      menuItems: lead.menuItems ?? "",
      contactPerson: lead.contactPerson ?? "",
      matchedNeeds: lead.matchedNeeds ?? [],
      extendedReason: lead.reason,
      statusTimeline: buildStatusTimeline(status),
    },
  };
}

export function mapLeadDetail(
  lead: Lead,
  statusRecord?: LeadStatusRecord | null,
) {
  return {
    ...mapLeadToDto({
      ...lead,
      distanceKm: 0,
      match: lead.baseMatch,
    }),
    status: statusRecord ? mapLeadStatusToApi(statusRecord.status) : null,
  };
}