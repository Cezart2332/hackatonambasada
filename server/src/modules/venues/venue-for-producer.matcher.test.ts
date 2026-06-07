import { describe, expect, it } from "vitest";
import {
  collectHistoryNeedTokens,
  isLikelySameBusiness,
  matchPlatformVenuesForProducer,
} from "./venue-for-producer.matcher.js";

const baseVenue = {
  id: "vp1",
  userId: "venue-1",
  contactName: "Maria",
  businessName: "Restaurant Delta",
  venueType: "restaurant" as const,
  phone: "0700000000",
  location: "Constanța",
  locationChoice: null,
  latitude: 44.17,
  longitude: 28.63,
  approvalStatus: "APPROVED" as const,
  productsNeeded: "",
  supplyFrequency: "",
  preferredDays: "",
  needsUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const honeyProduct = {
  id: "p1",
  profileId: "prof1",
  name: "Miere polifloră",
  estimatedQuantity: "100",
  unit: "kg",
  pricePerKg: "25",
  availableFrom: "Saptamana asta",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("venue-for-producer.matcher", () => {
  it("gives high score when venue declared needs match producer products", () => {
    const withNeeds = matchPlatformVenuesForProducer({
      venues: [{ ...baseVenue, productsNeeded: "miere" }],
      producerLatitude: 44.1699,
      producerLongitude: 28.6348,
      rangeKm: 35,
      producerName: "ApiProd",
      productSummary: "miere",
      producerProducts: [honeyProduct],
    });

    const withoutNeeds = matchPlatformVenuesForProducer({
      venues: [baseVenue],
      producerLatitude: 44.1699,
      producerLongitude: 28.6348,
      rangeKm: 35,
      producerName: "ApiProd",
      productSummary: "miere",
      producerProducts: [honeyProduct],
    });

    expect(withNeeds).toHaveLength(1);
    expect(withoutNeeds).toHaveLength(1);
    expect(withNeeds[0]?.match).toBeGreaterThan(withoutNeeds[0]?.match ?? 0);
    expect(withNeeds[0]?.match).toBeGreaterThanOrEqual(40);
    expect(withoutNeeds[0]?.match).toBeLessThanOrEqual(45);
    expect(withoutNeeds[0]?.match).toBeGreaterThanOrEqual(20);
    expect(withNeeds[0]?.matchedNeeds).toContain("miere");
  });

  it("applies history bonus for past searches not in active needs", () => {
    const activeOnly = matchPlatformVenuesForProducer({
      venues: [{ ...baseVenue, productsNeeded: "lapte" }],
      producerLatitude: 44.1699,
      producerLongitude: 28.6348,
      rangeKm: 35,
      producerName: "ApiProd",
      productSummary: "miere",
      producerProducts: [honeyProduct],
    });

    const withHistory = matchPlatformVenuesForProducer({
      venues: [{ ...baseVenue, productsNeeded: "lapte", historyNeeds: ["miere"] }],
      producerLatitude: 44.1699,
      producerLongitude: 28.6348,
      rangeKm: 35,
      producerName: "ApiProd",
      productSummary: "miere",
      producerProducts: [honeyProduct],
    });

    expect(withHistory[0]?.match).toBeGreaterThan(activeOnly[0]?.match ?? 0);
    expect(withHistory[0]?.matchFactors.historyScore).toBeGreaterThan(0);
  });

  it("excludes venues outside producer range", () => {
    const matched = matchPlatformVenuesForProducer({
      venues: [{ ...baseVenue, latitude: 45.5, longitude: 29.5, productsNeeded: "miere" }],
      producerLatitude: 44.1699,
      producerLongitude: 28.6348,
      rangeKm: 35,
      producerName: "ApiProd",
      productSummary: "miere",
      producerProducts: [honeyProduct],
    });

    expect(matched).toHaveLength(0);
  });

  it("collects history tokens excluding active needs", () => {
    expect(
      collectHistoryNeedTokens(
        [{ productsNeeded: "miere, lapte" }, { productsNeeded: "ouă" }],
        "miere",
      ),
    ).toEqual(expect.arrayContaining(["lapte", "ouă"]));
  });

  it("detects duplicate scraped names against platform venues", () => {
    expect(isLikelySameBusiness("Restaurant Delta SRL", "Restaurant Delta")).toBe(true);
    expect(isLikelySameBusiness("Hotel Dobrogea", "Cafenea Luna")).toBe(false);
  });
});
