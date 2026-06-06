export type AccountType = "producer" | "venue" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type VenueType = "restaurant" | "hotel" | "cafe" | "shop" | "deli";

export type ProfileKey = "product" | "quantity" | "location" | "range" | "days";

export type ProducerProduct = {
  id: string;
  name: string;
  category: string;
  estimatedQuantity: string;
  baseUnit: string;
  packaging: string;
  unit: string;
  pricePerKg: string;
  availableFrom: string;
};

export type LocationChoice = {
  label: string;
  lat: string;
  lon: string;
};

export type Profile = Partial<Record<ProfileKey, string>> & {
  producerName?: string;
  businessName?: string;
  phone?: string;
  extraDetails?: string;
  venueType?: VenueType;
  products?: ProducerProduct[];
  locationChoice?: LocationChoice;
};

export type ProducerAccount = {
  name: string;
  email: string;
  accountType: AccountType;
};

export type VenueSetup = {
  contactName: string;
  businessName: string;
  venueType: VenueType;
  phone: string;
  location: string;
  locationChoice?: LocationChoice;
  productsNeeded: string;
  supplyFrequency: string;
  preferredDays: string;
};

export type ProducerSetup = {
  producerName: string;
  businessName: string;
  phone: string;
  products: ProducerProduct[];
  location: string;
  locationChoice?: LocationChoice;
  range: string;
  days: string;
  extraDetails?: string;
};

export type LeadStatus =
  | "Bun"
  | "Nu e potrivit"
  | "Contactat"
  | "A răspuns"
  | "A cumpărat";

export type Lead = {
  id: string;
  name: string;
  type: string;
  location: string;
  distance: string;
  match: number;
  reason: string;
  sell: string;
  bestDay: string;
  contact: string;
  tone: string;
  icon: "restaurant" | "hotel" | "cafe" | "shop" | "deli";
  coordinates: [number, number];
  phone?: string;
  contactPerson?: string;
  menuItems?: string;
  supplyFrequency?: string;
  notes?: string;
  status?: LeadStatus | null;
};

export type ChatMessage =
  | {
      id: string;
      role: "agent" | "user";
      kind: "text";
      text: string;
      time: string;
    }
  | {
      id: string;
      role: "agent";
      kind: "lead";
      leadId: string;
      time: string;
    };

export type AppScreen = "auth" | "producer-onboarding" | "pending-approval" | "chat";
export type DashboardView = "chat" | "map" | "profile";
