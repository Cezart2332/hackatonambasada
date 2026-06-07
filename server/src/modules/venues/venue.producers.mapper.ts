import type { LeadIcon } from "@prisma/client";
import type { MatchedProducer } from "./producer-for-venue.matcher.js";

export function mapProducerMatchToDto(producer: MatchedProducer) {
  return {
    id: producer.userId,
    name: producer.businessName.trim() || producer.contactName.trim() || "Producător local",
    type: "producător local",
    location: producer.location,
    distance: `${Math.round(producer.distanceKm)} km`,
    match: producer.match,
    reason: producer.reason,
    sell: producer.sell,
    bestDay: producer.bestDay,
    contact: producer.contact,
    tone: producer.tone,
    icon: "shop" as LeadIcon,
    coordinates: [
      producer.latitude ?? 44.1699,
      producer.longitude ?? 28.6348,
    ] as [number, number],
    phone: producer.phone,
    contactPerson: producer.contactName,
    menuItems: producer.sell,
    supplyFrequency: producer.deliveryDays,
    notes: `Livrare până la ${Math.round(producer.rangeKm)} km`,
    needs: producer.products.map((product) => product.name),
    matchedNeeds: producer.matchedNeeds,
    matchFactors: producer.matchFactors,
    verified: producer.verified,
    platformRegistered: true,
    website: "",
    sourceUrls: [],
  };
}
