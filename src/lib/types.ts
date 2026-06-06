export type ProfileKey = "product" | "quantity" | "location" | "range" | "days";

export type ProducerProduct = {
  id: string;
  name: string;
  estimatedQuantity: string;
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
  products?: ProducerProduct[];
  locationChoice?: LocationChoice;
};

export type ProducerAccount = {
  name: string;
  email: string;
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
  needs?: string[];
  matchedNeeds?: string[];
  website?: string;
  sourceUrls?: string[];
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

export type AppScreen = "auth" | "producer-onboarding" | "chat";
export type DashboardView = "chat" | "map" | "profile";

export type SimulatedCampaignStep = {
  leadId: string;
  leadName: string;
  draftMessage: string;
  simulatedOutcome: string;
  simulatedAction: string;
  reasoning: string;
};
