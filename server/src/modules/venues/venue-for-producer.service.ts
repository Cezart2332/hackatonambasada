import type { LeadIcon, ProducerProduct } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { mapLeadStatusToApi, mapApiStatusToDb } from "../leads/lead.mapper.js";
import type { AiDiscoveredLead } from "../leads/lead.ai.js";
import { splitNeedTokens } from "./platform-product-match.js";
import {
  collectHistoryNeedTokens,
  isLikelySameBusiness,
  matchPlatformVenuesForProducer,
} from "./venue-for-producer.matcher.js";

const VENUE_TYPE_LABELS: Record<LeadIcon, string> = {
  restaurant: "Restaurant",
  hotel: "Hotel",
  cafe: "Cafenea",
  shop: "Magazin",
  deli: "Delicatese",
};

const HISTORY_LIMIT = 5;

async function fetchApprovedVenueCandidates() {
  const venues = await prisma.user.findMany({
    where: {
      accountType: "VENUE",
      venueProfile: { is: { approvalStatus: "APPROVED" } },
    },
    include: { venueProfile: true },
  });

  return venues
    .filter((entry) => entry.venueProfile)
    .map((entry) => ({
      ...entry.venueProfile!,
      userId: entry.id,
      contactName: entry.name,
    }));
}

async function loadVenueSearchHistoryByUserIds(venueUserIds: string[]) {
  if (!venueUserIds.length) return new Map<string, Array<{ productsNeeded: string }>>();

  const rows = await prisma.venueSearchHistory.findMany({
    where: { venueUserId: { in: venueUserIds } },
    orderBy: { createdAt: "desc" },
    select: {
      venueUserId: true,
      productsNeeded: true,
      supplyFrequency: true,
      preferredDays: true,
      createdAt: true,
    },
  });

  const byVenue = new Map<string, Array<{ productsNeeded: string }>>();
  for (const row of rows) {
    const bucket = byVenue.get(row.venueUserId) ?? [];
    if (bucket.length >= HISTORY_LIMIT) continue;
    bucket.push({ productsNeeded: row.productsNeeded });
    byVenue.set(row.venueUserId, bucket);
  }

  return byVenue;
}

export async function listPlatformVenueLeadsForProducer(params: {
  producerUserId: string;
  producerName: string;
  latitude: number;
  longitude: number;
  rangeKm: number;
  productSummary: string;
  producerProducts: ProducerProduct[];
}): Promise<AiDiscoveredLead[]> {
  const candidates = await fetchApprovedVenueCandidates();
  const historyByVenue = await loadVenueSearchHistoryByUserIds(
    candidates.map((venue) => venue.userId),
  );

  const venuesWithHistory = candidates.map((venue) => ({
    ...venue,
    historyNeeds: collectHistoryNeedTokens(
      historyByVenue.get(venue.userId) ?? [],
      venue.productsNeeded,
    ),
  }));

  const matched = matchPlatformVenuesForProducer({
    venues: venuesWithHistory,
    producerLatitude: params.latitude,
    producerLongitude: params.longitude,
    rangeKm: params.rangeKm,
    producerName: params.producerName,
    productSummary: params.productSummary,
    producerProducts: params.producerProducts,
  });

  if (!matched.length) return [];

  const statuses = await prisma.venueLeadStatusRecord.findMany({
    where: { producerUserId: params.producerUserId },
  });
  const statusByVenueId = new Map(
    statuses.map((row) => [row.venueUserId, mapLeadStatusToApi(row.status)]),
  );

  return matched.map((venue) => {
    const businessName = venue.businessName.trim() || venue.contactName.trim() || "Local HoReCa";
    const typeLabel = VENUE_TYPE_LABELS[venue.venueType] ?? "Local";

    return {
      id: venue.userId,
      name: businessName,
      type: typeLabel,
      location: venue.locationChoice || venue.location || "Dobrogea",
      distance: `${Math.round(venue.distanceKm)} km`,
      match: venue.match,
      reason: venue.reason,
      sell: venue.sell,
      bestDay: venue.bestDay,
      contact: venue.contact,
      tone: venue.tone,
      icon: venue.venueType,
      coordinates: [venue.latitude ?? params.latitude, venue.longitude ?? params.longitude] as [
        number,
        number,
      ],
      needs: splitNeedTokens(venue.productsNeeded),
      matchedNeeds: venue.matchedNeeds,
      matchFactors: venue.matchFactors,
      website: "",
      phone: venue.phone,
      contactPerson: venue.contactName,
      menuItems: "",
      notes: venue.productsNeeded.trim()
        ? `Local înregistrat — caută: ${venue.productsNeeded.trim()}`
        : "Local înregistrat oficial pe Warm Leads — încă fără cerere activă în Asistent.",
      sourceUrls: [],
      platformRegistered: true,
      status: statusByVenueId.get(venue.userId) ?? null,
    };
  });
}

export function mergeProducerLeadSources(
  platformLeads: AiDiscoveredLead[],
  scrapedLeads: AiDiscoveredLead[],
): AiDiscoveredLead[] {
  const platformNames = platformLeads.map((lead) => lead.name);
  const filteredScraped = scrapedLeads.filter(
    (lead) => !platformNames.some((name) => isLikelySameBusiness(name, lead.name)),
  );
  return [...platformLeads, ...filteredScraped];
}

export async function updatePlatformVenueLeadStatus(
  producerUserId: string,
  venueUserId: string,
  status: string,
) {
  const venue = await prisma.user.findFirst({
    where: {
      id: venueUserId,
      accountType: "VENUE",
      venueProfile: { is: { approvalStatus: "APPROVED" } },
    },
    select: { id: true },
  });

  if (!venue) {
    return null;
  }

  const dbStatus = mapApiStatusToDb(status);
  await prisma.venueLeadStatusRecord.upsert({
    where: {
      producerUserId_venueUserId: {
        producerUserId,
        venueUserId,
      },
    },
    create: {
      producerUserId,
      venueUserId,
      status: dbStatus,
    },
    update: {
      status: dbStatus,
    },
  });

  return { leadId: venueUserId, status };
}
