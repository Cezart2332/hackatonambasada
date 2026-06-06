import type { VenueProfile } from "@prisma/client";

export type VenueProfileDto = {
  id: string;
  businessName: string;
  venueType: string;
  phone: string;
  location: string;
  locationChoice: string | null;
  latitude: number | null;
  longitude: number | null;
  productsNeeded: string;
  supplyFrequency: string;
  preferredDays: string;
  approvalStatus: "pending" | "approved" | "rejected";
};

export function mapVenueProfile(profile: VenueProfile): VenueProfileDto {
  return {
    id: profile.id,
    businessName: profile.businessName,
    venueType: profile.venueType,
    phone: profile.phone,
    location: profile.location,
    locationChoice: profile.locationChoice,
    latitude: profile.latitude,
    longitude: profile.longitude,
    productsNeeded: profile.productsNeeded,
    supplyFrequency: profile.supplyFrequency,
    preferredDays: profile.preferredDays,
    approvalStatus:
      profile.approvalStatus === "APPROVED"
        ? "approved"
        : profile.approvalStatus === "REJECTED"
          ? "rejected"
          : "pending",
  };
}
