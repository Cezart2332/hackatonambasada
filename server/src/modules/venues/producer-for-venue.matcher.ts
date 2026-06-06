import type { ProducerProduct } from "@prisma/client";
import { haversineKm } from "../leads/lead.matcher.js";

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
};

export type MatchFactors = {
  productScore: number;
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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DAIRY_NEED = /lapte|lactate|iaurt|branz|brânz|smantana|smântân|kefir|dairy/;
const DAIRY_PRODUCT = /lapte|lactate|iaurt|branz|brânz|smantana|smântân|vac[aă]|capr[aă]|ov[aă]|brânzetur/;

export function productMatchesNeed(needPart: string, productName: string): boolean {
  const need = normalizeText(needPart);
  const name = normalizeText(productName);
  if (!need.trim() || !name.trim()) return false;
  if (need.includes(name) || name.includes(need)) return true;
  const needWords = need.split(/\s+/).filter((word) => word.length > 3);
  const nameWords = name.split(/\s+/).filter((word) => word.length > 3);
  if (nameWords.some((word) => needWords.some((needWord) => needWord.includes(word) || word.includes(needWord)))) {
    return true;
  }
  if (name.includes("miere") && /miere|borcan|dulce|meli|apicultur/.test(need)) return true;
  if (DAIRY_NEED.test(need) && DAIRY_PRODUCT.test(name)) return true;
  if (/branza|brânz/.test(name) && /branza|brânz|lactate|platou|brânzetur/.test(need)) return true;
  if (/vin/.test(name) && /vin|bautur|băutur/.test(need)) return true;
  if (/legum|rosii|roșii|fruct|rosie/.test(name) && /legum|fruct|verde|rosii|roșii/.test(need)) return true;
  if (/ou|oua|ouă/.test(name) && /ou|oua|ouă/.test(need)) return true;
  if (/carne|porc|vit|berb|miel/.test(name) && /carne|porc|vit|berb|miel/.test(need)) return true;
  return false;
}

export function hasRelevantProductMatch(productsNeeded: string, products: ProducerProduct[]): boolean {
  const need = normalizeText(productsNeeded);
  if (!need.trim()) return true;
  for (const product of products) {
    if (productMatchesNeed(productsNeeded, product.name)) return true;
  }
  return false;
}

export function collectMatchedNeeds(productsNeeded: string, products: ProducerProduct[]): string[] {
  const parts = productsNeeded
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const matched: string[] = [];
  for (const part of parts.length ? parts : [productsNeeded.trim()]) {
    if (!part) continue;
    for (const product of products) {
      if (productMatchesNeed(part, product.name) && !matched.includes(part)) {
        matched.push(part);
        break;
      }
    }
  }
  return matched;
}

function keywordBoost(productsNeeded: string, products: ProducerProduct[]): number {
  if (!hasRelevantProductMatch(productsNeeded, products)) return 0;
  const need = normalizeText(productsNeeded);
  if (!need.trim()) return 0;
  let boost = 0;
  for (const product of products) {
    const name = normalizeText(product.name);
    if (!name.trim()) continue;
    if (need.includes(name) || name.split(/\s+/).some((word) => word.length > 3 && need.includes(word))) {
      boost += 10;
      continue;
    }
    if (name.includes("miere") && /miere|borcan|dulce/.test(need)) boost += 8;
    if (DAIRY_NEED.test(need) && DAIRY_PRODUCT.test(name)) boost += 8;
    if (/branza|brânz/.test(name) && /branza|brânz|lactate|platou/.test(need)) boost += 8;
    if (/vin/.test(name) && /vin|bautur|băutur/.test(need)) boost += 6;
    if (/legum|rosii|roșii|fruct/.test(name) && /legum|fruct|verde/.test(need)) boost += 6;
  }
  return Math.min(boost, 30);
}

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

      const match =
        scope === "all"
          ? Math.max(35, Math.min(99, (productNames ? 50 : 40) + keywordScore + proximityBonus))
          : needSpecified
            ? Math.max(MIN_MATCHED_SCORE, Math.min(99, 42 + keywordScore * 2 + proximityBonus))
            : Math.max(MIN_MATCHED_SCORE, Math.min(99, 55 + keywordScore + proximityBonus));

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
        verified: true,
      };
    })
    .filter((producer): producer is MatchedProducer => producer !== null)
    .sort((a, b) => b.match - a.match || a.distanceKm - b.distanceKm);
}
