import type { ProducerProduct, ProducerProfile, User, VenueProfile } from "@prisma/client";

export type AdminRegistrationDto = {
  userId: string;
  accountType: "producer" | "venue";
  approvalStatus: "pending" | "approved" | "rejected";
  contactName: string;
  email: string;
  phone: string;
  businessName: string;
  location: string;
  locationChoice: string | null;
  registeredAt: string;
  updatedAt: string;
  producer?: {
    rangeKm: number;
    deliveryDays: string;
    extraDetails: string;
    products: Array<{
      name: string;
      estimatedQuantity: string;
      unit: string;
      pricePerKg: string;
      availableFrom: string;
    }>;
  };
  venue?: {
    venueType: string;
  };
};

function mapApprovalStatus(status: string): AdminRegistrationDto["approvalStatus"] {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

export function mapProducerRegistration(
  user: User,
  profile: ProducerProfile & { products: ProducerProduct[] },
): AdminRegistrationDto {
  return {
    userId: user.id,
    accountType: "producer",
    approvalStatus: mapApprovalStatus(profile.approvalStatus),
    contactName: user.name,
    email: user.email,
    phone: profile.phone,
    businessName: profile.businessName,
    location: profile.location,
    locationChoice: profile.locationChoice,
    registeredAt: user.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    producer: {
      rangeKm: profile.rangeKm,
      deliveryDays: profile.deliveryDays,
      extraDetails: profile.extraDetails,
      products: profile.products.map((product) => ({
        name: product.name,
        estimatedQuantity: product.estimatedQuantity,
        unit: product.unit,
        pricePerKg: product.pricePerKg,
        availableFrom: product.availableFrom,
      })),
    },
  };
}

export function mapVenueRegistration(user: User, profile: VenueProfile): AdminRegistrationDto {
  return {
    userId: user.id,
    accountType: "venue",
    approvalStatus: mapApprovalStatus(profile.approvalStatus),
    contactName: user.name,
    email: user.email,
    phone: profile.phone,
    businessName: profile.businessName,
    location: profile.location,
    locationChoice: profile.locationChoice,
    registeredAt: user.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    venue: {
      venueType: profile.venueType,
    },
  };
}
