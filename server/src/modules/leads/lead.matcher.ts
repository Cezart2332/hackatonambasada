import type { Lead, ProducerProduct } from "@prisma/client";

export type MatchedLead = Lead & {
  distanceKm: number;
  match: number;
};

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function productBoost(products: ProducerProduct[], leadType: string): number {
  const names = products.map((p) => p.name.toLowerCase()).join(" ");
  let boost = 0;

  if (names.includes("miere") && /restaurant|cafe|deli|b\u0103c/.test(leadType)) {
    boost += 3;
  }
  if (names.includes("br") && /restaurant|hotel|deli/.test(leadType)) {
    boost += 2;
  }
  if (names.includes("vin") && /deli|hotel/.test(leadType)) {
    boost += 2;
  }

  return boost;
}

export function matchLeads(params: {
  leads: Lead[];
  latitude: number;
  longitude: number;
  rangeKm: number;
  products?: ProducerProduct[];
}): MatchedLead[] {
  const { leads, latitude, longitude, rangeKm, products = [] } = params;

  return leads
    .map((lead) => {
      const distanceKm = haversineKm(
        latitude,
        longitude,
        lead.latitude,
        lead.longitude,
      );

      const proximityPenalty = Math.min(15, Math.floor(distanceKm / rangeKm) * 5);
      const proximityBonus = distanceKm <= rangeKm * 0.5 ? 2 : 0;
      const boost = productBoost(products, `${lead.type} ${lead.name}`.toLowerCase());
      const match = Math.max(
        50,
        Math.min(99, lead.baseMatch - proximityPenalty + proximityBonus + boost),
      );

      return {
        ...lead,
        distanceKm,
        match,
      };
    })
    .filter((lead) => lead.distanceKm <= rangeKm)
    .sort((a, b) => b.match - a.match || a.distanceKm - b.distanceKm);
}