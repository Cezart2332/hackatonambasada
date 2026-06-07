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
  needs?: string[];
  matchedNeeds?: string[];
  matchFactors?: {
    productScore: number;
    historyScore?: number;
    distanceKm: number;
    producerRangeKm: number;
    inRange: boolean;
    proximityBonus: number;
  };
  verified?: boolean;
  platformRegistered?: boolean;
  website?: string;
  sourceUrls?: string[];
  phone?: string;
  contactPerson?: string;
  menuItems?: string;
  supplyFrequency?: string;
  notes?: string;
  status?: LeadStatus | null;
  proDetails?: {
    sourceUrls: string[];
    notes: string;
    menuItems: string;
    contactPerson: string;
    matchedNeeds: string[];
    extendedReason: string;
    statusTimeline: Array<{ step: LeadStatus; reached: boolean; current: boolean }>;
  };
};

export type PlanTier = "free" | "pro";

export type PlanLimits = {
  weeklyDiscoveries: number;
  activeLeads: number;
  weeklySimulations: number;
  discoverMore: boolean;
  stats: boolean;
  richDetails: boolean;
};

export type PlanContext = {
  tier: PlanTier;
  limits: PlanLimits;
  usage: {
    weeklyDiscoveries: number;
    weeklySimulations: number;
    activeLeads: number;
  };
  weekKey: string;
  resetsAt: string;
  proActivatedAt: string | null;
};

export type LeadStats = {
  pipeline: Record<string, number>;
  weekly: {
    discoveredThisWeek: number;
    weeklyLimit: number | null;
    activeLeads: number;
    activeLimit: number | null;
  };
  matchQuality: {
    averageMatch: number;
    averageDistanceKm: number;
    totalLeads: number;
  };
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
export type DashboardView = "chat" | "director" | "messages" | "profile";

export type ConversationLastMessage = {
  body: string;
  createdAt: string;
  senderUserId: string;
};

export type ConversationSummary = {
  id: string;
  counterpartUserId: string;
  counterpartName: string;
  counterpartBusinessName: string;
  lastMessage: ConversationLastMessage | null;
  unreadCount: number;
  updatedAt: string;
};

export type DirectMessage = {
  id: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export type SimulatedCampaignStep = {
  leadId: string;
  leadName: string;
  draftMessage: string;
  simulatedOutcome: string;
  simulatedAction: string;
  reasoning: string;
  deliveries?: Array<{
    channel: string;
    target: string;
    status: string;
    detail?: string;
    providerId?: string;
  }>;
};

export type UnipileIntegrationChannelStatus = {
  status: string;
  connected: boolean;
};

export type UnipileIntegrationsStatus = {
  whatsapp: UnipileIntegrationChannelStatus;
  gmail: UnipileIntegrationChannelStatus;
};
