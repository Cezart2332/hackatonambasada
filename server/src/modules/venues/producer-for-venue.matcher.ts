import type { ProducerProduct } from "@prisma/client";
import { haversineKm } from "../leads/lead.matcher.js";
import {
  collectMatchedNeeds,
  hasRelevantProductMatch,
  keywordBoost,
  productMatchesNeed,
} from "./platform-product-match.js";

export { collectMatchedNeeds, hasRelevantProductMatch, productMatchesNeed };

export type ProducerCandidate = {
  userId: string;
  contactName: string;
  businessName: string;
  phone: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  rangeKm: number;
  deliveryDays: string;
  products: ProducerProduct[];
  verified: boolean;
};

export type MatchFactors = {
  productScore: number;
  historyScore?: number;
  distanceKm: number;
  producerRangeKm: number;
  inRange: boolean;
  proximityBonus: number;
};

export type MatchedProducer = ProducerCandidate & {
  distanceKm: number;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  matchedNeeds: string[];
  matchFactors: MatchFactors;
  verified: boolean;
};

export type VenueMatchDiagnostics = {
  totalApproved: number;
  productRelevant: number;
  inRange: number;
  outOfRangeOnly: number;
  noProductMatch: number;
};

const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;

export type VenueProducerMatchScope = "matched" | "all";
const MIN_MATCHED_SCORE = 40;

export function computeMatchDiagnostics(params: {
  producers: ProducerCandidate[];
  venueLatitude: number;
  venueLongitude: number;
  productsNeeded: string;
  searchRadiusKm?: number;
}): VenueMatchDiagnostics {
  const { producers, venueLatitude, venueLongitude, productsNeeded, searchRadiusKm = 100 } = params;
  let productRelevant = 0;
  let inRange = 0;
  let outOfRangeOnly = 0;
  let noProductMatch = 0;
  const needSpecified = Boolean(productsNeeded.trim());

  for (const producer of producers) {
    const latitude = producer.latitude ?? DEFAULT_LAT;
    const longitude = producer.longitude ?? DEFAULT_LON;
    const distanceKm = haversineKm(venueLatitude, venueLongitude, latitude, longitude);
    const withinProducerRange = distanceKm <= producer.rangeKm;
    const withinVenueSearch = distanceKm <= searchRadiusKm;
    const relevant = !needSpecified || hasRelevantProductMatch(productsNeeded, producer.products);

    if (!relevant) {
      noProductMatch += 1;
      continue;
    }
    productRelevant += 1;
    if (withinProducerRange && withinVenueSearch) {
      inRange += 1;
    } else {
      outOfRangeOnly += 1;
    }
  }

  return {
    totalApproved: producers.length,
    productRelevant,
    inRange,
    outOfRangeOnly,
    noProductMatch,
  };
}

export function matchProducersForVenue(params: {
  producers: ProducerCandidate[];
  venueLatitude: number;
  venueLongitude: number;
  productsNeeded: string;
  venueBusinessName?: string;
  searchRadiusKm?: number;
  scope?: VenueProducerMatchScope;
}): MatchedProducer[] {
  const {
    producers,
    venueLatitude,
    venueLongitude,
    productsNeeded,
    venueBusinessName = "",
    searchRadiusKm = 100,
    scope = "matched",
  } = params;

  return producers
    .map((producer) => {
      const latitude = producer.latitude ?? DEFAULT_LAT;
      const longitude = producer.longitude ?? DEFAULT_LON;
      const distanceKm = haversineKm(venueLatitude, venueLongitude, latitude, longitude);
      const withinProducerRange = distanceKm <= producer.rangeKm;
      const withinVenueSearch = distanceKm <= searchRadiusKm;
      const inRange = withinProducerRange && withinVenueSearch;

      if (scope === "matched" && !inRange) return null;

      const productNames = producer.products
        .map((product) => product.name.trim())
        .filter(Boolean)
        .join(", ");
      const needSpecified = Boolean(productsNeeded.trim());
      const relevant =
        scope === "all" || !needSpecified || hasRelevantProductMatch(productsNeeded, producer.products);
      if (!relevant) return null;

      const keywordScore = keywordBoost(productsNeeded, producer.products);
      const proximityBonus =
        scope === "all" ? 0 : distanceKm <= 20 ? 5 : distanceKm <= 35 ? 2 : 0;
      const verifiedBonus = producer.verified ? 4 : 0;

      const match =
        scope === "all"
          ? Math.max(35, Math.min(99, (productNames ? 50 : 40) + keywordScore + proximityBonus + verifiedBonus))
          : needSpecified
            ? Math.max(MIN_MATCHED_SCORE, Math.min(99, 42 + keywordScore * 2 + proximityBonus + verifiedBonus))
            : Math.max(MIN_MATCHED_SCORE, Math.min(99, 55 + keywordScore + proximityBonus + verifiedBonus));

      if (scope === "matched" && needSpecified && keywordScore === 0) return null;
      if (scope === "matched" && match < MIN_MATCHED_SCORE) return null;

      const sell =
        producer.products
          .map((product) => {
            const qty = product.estimatedQuantity.trim()
              ? `${product.estimatedQuantity.trim()} ${product.unit.trim() || "kg"}`
              : "cantitate de confirmat";
            const price = product.pricePerKg.trim() ? `${product.pricePerKg.trim()} lei` : "preț de confirmat";
            return `${product.name.trim()} (${qty}, ${price})`;
          })
          .filter(Boolean)
          .join("; ") || "Produse locale de sezon";

      const venueNeed = productsNeeded.trim() || "produse locale";
      const venueLabel = venueBusinessName.trim() || "localul nostru";
      const reason = productNames
        ? `Oferă ${productNames} și livrează din ${producer.location || "Dobrogea"}.`
        : `Producător local din ${producer.location || "Dobrogea"} cu livrare în zonă.`;

      return {
        ...producer,
        distanceKm,
        match,
        reason,
        sell,
        bestDay: producer.deliveryDays.trim() || "De confirmat telefonic",
        contact: `Bună ziua, sunt de la ${venueLabel}. Căutăm ${venueNeed} pentru aprovizionare în Dobrogea. Ce aveți disponibil săptămâna aceasta și la ce preț puteți livra?`,
        tone: "direct, potrivit pentru o primă comandă locală",
        matchedNeeds: collectMatchedNeeds(productsNeeded, producer.products),
        matchFactors: {
          productScore: keywordScore,
          distanceKm,
          producerRangeKm: producer.rangeKm,
          inRange,
          proximityBonus,
        },
        verified: producer.verified,
      };
    })
    .filter((producer): producer is MatchedProducer => producer !== null)
    .sort((a, b) => b.match - a.match || a.distanceKm - b.distanceKm);
}
