import { describe, expect, it } from "vitest";
import {
  collectMatchedNeeds,
  computeMatchDiagnostics,
  hasRelevantProductMatch,
  matchProducersForVenue,
  productMatchesNeed,
  type ProducerCandidate,
} from "./producer-for-venue.matcher.js";

const baseProducer = (overrides: Partial<ProducerCandidate> = {}): ProducerCandidate => ({
  userId: "p1",
  contactName: "Ana",
  businessName: "Stupina",
  phone: "+40123456789",
  location: "Murfatlar",
  latitude: 44.18,
  longitude: 28.65,
  rangeKm: 60,
  deliveryDays: "Marți",
  products: [{ id: "1", name: "Miere polifloră", profileId: "x", unit: "borcan", estimatedQuantity: "10", pricePerKg: "28", availableFrom: "", createdAt: new Date(), updatedAt: new Date() } as never],
  ...overrides,
});

describe("producer-for-venue.matcher", () => {
  it("matches miere need to miere product", () => {
    expect(productMatchesNeed("miere", "Miere polifloră")).toBe(true);
    expect(hasRelevantProductMatch("miere", baseProducer().products)).toBe(true);
  });

  it("does not match lapte to miere-only producer", () => {
    expect(hasRelevantProductMatch("lapte", baseProducer().products)).toBe(false);
  });

  it("matches dairy heuristic for lapte de vaca", () => {
    const producer = baseProducer({
      products: [{ id: "2", name: "lapte de vaca", profileId: "x", unit: "l", estimatedQuantity: "20", pricePerKg: "5", availableFrom: "", createdAt: new Date(), updatedAt: new Date() } as never],
    });
    expect(hasRelevantProductMatch("lapte", producer.products)).toBe(true);
  });

  it("excludes producer outside range for matched scope", () => {
    const far = baseProducer({ rangeKm: 10, latitude: 45.5, longitude: 30.2 });
    const result = matchProducersForVenue({
      producers: [far],
      venueLatitude: 44.17,
      venueLongitude: 28.63,
      productsNeeded: "miere",
      scope: "matched",
    });
    expect(result).toHaveLength(0);
  });

  it("includes producer in all scope regardless of distance", () => {
    const far = baseProducer({ rangeKm: 5 });
    const result = matchProducersForVenue({
      producers: [far],
      venueLatitude: 44.17,
      venueLongitude: 28.63,
      productsNeeded: "miere",
      scope: "all",
    });
    expect(result).toHaveLength(1);
  });

  it("returns diagnostics with outOfRangeOnly", () => {
    const near = baseProducer({ rangeKm: 100 });
    const far = baseProducer({ userId: "p2", rangeKm: 5, latitude: 45.5, longitude: 30.2 });
    const diagnostics = computeMatchDiagnostics({
      producers: [near, far],
      venueLatitude: 44.17,
      venueLongitude: 28.63,
      productsNeeded: "miere",
    });
    expect(diagnostics.totalApproved).toBe(2);
    expect(diagnostics.productRelevant).toBe(2);
    expect(diagnostics.inRange).toBe(1);
    expect(diagnostics.outOfRangeOnly).toBe(1);
  });

  it("populates matchedNeeds on matched producer", () => {
    const result = matchProducersForVenue({
      producers: [baseProducer()],
      venueLatitude: 44.17,
      venueLongitude: 28.63,
      productsNeeded: "miere",
      scope: "matched",
    });
    expect(result[0]?.matchedNeeds).toContain("miere");
    expect(result[0]?.verified).toBe(true);
    expect(result[0]?.matchFactors.inRange).toBe(true);
  });

  it("collectMatchedNeeds splits comma-separated needs", () => {
    const needs = collectMatchedNeeds("miere, lapte", [
      { id: "1", name: "Miere polifloră", profileId: "x", unit: "", estimatedQuantity: "", pricePerKg: "", availableFrom: "", createdAt: new Date(), updatedAt: new Date() } as never,
      { id: "2", name: "lapte de vaca", profileId: "x", unit: "", estimatedQuantity: "", pricePerKg: "", availableFrom: "", createdAt: new Date(), updatedAt: new Date() } as never,
    ]);
    expect(needs).toEqual(expect.arrayContaining(["miere", "lapte"]));
  });
});
