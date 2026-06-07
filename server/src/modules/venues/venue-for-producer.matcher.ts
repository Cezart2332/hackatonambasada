import type { ProducerProduct, VenueProfile } from "@prisma/client";
import { haversineKm } from "../leads/lead.matcher.js";
import type { MatchFactors } from "./producer-for-venue.matcher.js";
import {
  collectMatchedNeeds,
  hasActiveSearchIntent,
  keywordBoost,
  splitNeedTokens,
} from "./platform-product-match.js";

export type VenueCandidate = VenueProfile & {
  userId: string;
  contactName: string;
  historyNeeds?: string[];
};

export type MatchedPlatformVenue = VenueCandidate & {
  distanceKm: number;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  matchedNeeds: string[];
  matchFactors: MatchFactors;
};

const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;

function proximityBonus(distanceKm: number): number {
  if (distanceKm <= 20) return 5;
  if (distanceKm <= 35) return 2;
  return 0;
}

function distancePenalty(distanceKm: number): number {
  return Math.min(8, Math.floor(distanceKm / 8));
}

function historyBonus(historyNeeds: string[], producerProducts: ProducerProduct[]): number {
  if (!historyNeeds.length) return 0;
  const joined = historyNeeds.join(", ");
  return Math.min(15, keywordBoost(joined, producerProducts));
}

export function matchPlatformVenuesForProducer(params: {
  venues: VenueCandidate[];
  producerLatitude: number;
  producerLongitude: number;
  rangeKm: number;
  producerName: string;
  productSummary: string;
  producerProducts: ProducerProduct[];
}): MatchedPlatformVenue[] {
  const {
    venues,
    producerLatitude,
    producerLongitude,
    rangeKm,
    producerName,
    productSummary,
    producerProducts,
  } = params;

  return venues
    .map((venue) => {
      const latitude = venue.latitude ?? DEFAULT_LAT;
      const longitude = venue.longitude ?? DEFAULT_LON;
      const distanceKm = haversineKm(producerLatitude, producerLongitude, latitude, longitude);
      if (distanceKm > rangeKm) return null;

      const businessName = venue.businessName.trim() || venue.contactName.trim() || "Local HoReCa";
      const productsLabel = productSummary.trim() || "produse locale";
      const activeNeeds = venue.productsNeeded.trim();
      const hasNeeds = hasActiveSearchIntent(activeNeeds);
      const proxBonus = proximityBonus(distanceKm);
      const distPenalty = distancePenalty(distanceKm);

      const productScore = hasNeeds ? keywordBoost(activeNeeds, producerProducts) : 0;
      const histScore = historyBonus(venue.historyNeeds ?? [], producerProducts);
      const matchedNeeds = hasNeeds
        ? collectMatchedNeeds(activeNeeds, producerProducts)
        : [];

      const match = hasNeeds
        ? Math.min(
            99,
            Math.max(
              40,
              42 + productScore * 2 + histScore + proxBonus - distPenalty,
            ),
          )
        : Math.min(45, Math.max(20, 28 + proxBonus - distPenalty));

      const needsLabel = hasNeeds ? activeNeeds : "";
      const reason = hasNeeds
        ? `${businessName} caută ${needsLabel} pe platformă — potrivire ${matchedNeeds.length ? `pe ${matchedNeeds.join(", ")}` : "parțială"} la ${Math.round(distanceKm)} km.`
        : `${businessName} este înregistrat pe Warm Leads, dar nu și-a declarat încă nevoile în Asistent — potrivire slabă, doar pe proximitate.`;

      const sell = hasNeeds
        ? `Localul caută: ${needsLabel}. Poți propune: ${productsLabel}${matchedNeeds.length ? ` (potrivire: ${matchedNeeds.join(", ")})` : ""}.`
        : `Local înregistrat la ${Math.round(distanceKm)} km — încă fără cerere activă în Asistent.`;

      const matched: MatchedPlatformVenue = {
        ...venue,
        distanceKm,
        match,
        reason,
        sell,
        bestDay: venue.preferredDays.trim() || "Marți sau miercuri dimineața, înainte de aprovizionare.",
        contact:
          `Bună ziua, sunt ${producerName} de pe Warm Leads. Văd că ${businessName} e înregistrat în platformă` +
          (hasNeeds ? ` și căutați ${needsLabel}` : "") +
          ` — aș dori să discutăm despre ${productsLabel}.`,
        tone: hasNeeds
          ? "profesional, direct, cu referire la nevoile declarate"
          : "profesional, direct, cu referire la platformă",
        matchedNeeds,
        matchFactors: {
          productScore,
          historyScore: histScore > 0 ? histScore : undefined,
          distanceKm,
          producerRangeKm: rangeKm,
          inRange: true,
          proximityBonus: proxBonus,
        },
      };
      return matched;
    })
    .filter((venue): venue is MatchedPlatformVenue => venue !== null)
    .sort((a, b) => b.match - a.match || a.distanceKm - b.distanceKm);
}

export function normalizeLeadBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelySameBusiness(left: string, right: string): boolean {
  const a = normalizeLeadBusinessName(left);
  const b = normalizeLeadBusinessName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

export function collectHistoryNeedTokens(
  historyEntries: Array<{ productsNeeded: string }>,
  activeNeeds: string,
): string[] {
  const activeTokens = new Set(splitNeedTokens(activeNeeds));
  const tokens = new Set<string>();

  for (const entry of historyEntries) {
    for (const token of splitNeedTokens(entry.productsNeeded)) {
      if (!activeTokens.has(token)) {
        tokens.add(token);
      }
    }
  }

  return [...tokens];
}
