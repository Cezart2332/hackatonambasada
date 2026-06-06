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

export type MatchedProducer = ProducerCandidate & {
  distanceKm: number;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
};

const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function keywordBoost(productsNeeded: string, products: ProducerProduct[]): number {
  const need = normalizeText(productsNeeded);
  if (!need.trim()) return 0;

  let boost = 0;
  for (const product of products) {
    const name = normalizeText(product.name);
    if (!name.trim()) continue;

    if (need.includes(name) || name.split(/\s+/).some((word) => word.length > 3 && need.includes(word))) {
      boost += 8;
      continue;
    }

    if (name.includes("miere") && /miere|borcan|dulce/.test(need)) boost += 6;
    if (/branza|brânz/.test(name) && /branza|brânz|lactate|platou/.test(need)) boost += 6;
    if (/vin/.test(name) && /vin|bautur|băutur/.test(need)) boost += 5;
    if (/legum|rosii|roșii|fruct/.test(name) && /legum|fruct|verde/.test(need)) boost += 5;
  }

  return Math.min(boost, 20);
}

export function matchProducersForVenue(params: {
  producers: ProducerCandidate[];
  venueLatitude: number;
  venueLongitude: number;
  productsNeeded: string;
  venueBusinessName?: string;
  searchRadiusKm?: number;
}): MatchedProducer[] {
  const {
    producers,
    venueLatitude,
    venueLongitude,
    productsNeeded,
    venueBusinessName = "",
    searchRadiusKm = 100,
  } = params;

  return producers
    .map((producer) => {
      const latitude = producer.latitude ?? DEFAULT_LAT;
      const longitude = producer.longitude ?? DEFAULT_LON;
      const distanceKm = haversineKm(venueLatitude, venueLongitude, latitude, longitude);
      const withinProducerRange = distanceKm <= producer.rangeKm;
      const withinVenueSearch = distanceKm <= searchRadiusKm;

      if (!withinProducerRange || !withinVenueSearch) {
        return null;
      }

      const productNames = producer.products
        .map((product) => product.name.trim())
        .filter(Boolean)
        .join(", ");
      const keywordScore = keywordBoost(productsNeeded, producer.products);
      const proximityBonus = distanceKm <= 20 ? 5 : distanceKm <= 35 ? 2 : 0;
      const base = productNames ? 72 : 58;
      const match = Math.max(50, Math.min(99, base + keywordScore + proximityBonus));

      const displayName = producer.businessName.trim() || producer.contactName.trim() || "Producător local";
      const reason = productNames
        ? `Oferă ${productNames} și livrează din ${producer.location || "Dobrogea"}.`
        : `Producător local din ${producer.location || "Dobrogea"} cu livrare în zonă.`;

      const sell = producer.products
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
      const contact = `Bună ziua, sunt de la ${venueLabel}. Căutăm ${venueNeed} pentru aprovizionare în Dobrogea. Ce aveți disponibil săptămâna aceasta și la ce preț puteți livra?`;

      return {
        ...producer,
        distanceKm,
        match,
        reason,
        sell,
        bestDay: producer.deliveryDays.trim() || "De confirmat telefonic",
        contact,
        tone: "direct, potrivit pentru o primă comandă locală",
      };
    })
    .filter((producer): producer is MatchedProducer => producer !== null)
    .sort((a, b) => b.match - a.match || a.distanceKm - b.distanceKm);
}
