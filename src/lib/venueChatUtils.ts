import type { ChatMessage, Lead, Profile } from "@/lib/types";

export type VenueMatchDiagnostics = {
  totalApproved: number;
  productRelevant: number;
  inRange: number;
  outOfRangeOnly: number;
  noProductMatch: number;
};

export type VenueChatSession = {
  needs: string;
  supplyFrequency: string;
  preferredDays: string;
};

export const EMPTY_VENUE_SESSION: VenueChatSession = {
  needs: "",
  supplyFrequency: "",
  preferredDays: "",
};

export function venueSessionStorageKey(userId: string) {
  return `venue-chat-session:${userId}`;
}

export function readVenueSessionFromStorage(userId: string): VenueChatSession {
  try {
    const raw = sessionStorage.getItem(venueSessionStorageKey(userId));
    if (!raw) return { ...EMPTY_VENUE_SESSION };
    const parsed = JSON.parse(raw) as Partial<VenueChatSession>;
    return {
      needs: typeof parsed.needs === "string" ? parsed.needs : "",
      supplyFrequency: typeof parsed.supplyFrequency === "string" ? parsed.supplyFrequency : "",
      preferredDays: typeof parsed.preferredDays === "string" ? parsed.preferredDays : "",
    };
  } catch {
    return { ...EMPTY_VENUE_SESSION };
  }
}

export function writeVenueSessionToStorage(userId: string, session: VenueChatSession) {
  try {
    sessionStorage.setItem(venueSessionStorageKey(userId), JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearVenueSessionStorage(userId: string) {
  try {
    sessionStorage.removeItem(venueSessionStorageKey(userId));
  } catch {
    // ignore
  }
}

export function venueProfileToChatSnapshot(profile: Profile, session: VenueChatSession) {
  return {
    productsNeeded: session.needs,
    product: session.needs,
    supplyFrequency: session.supplyFrequency,
    quantity: session.supplyFrequency,
    preferredDays: session.preferredDays,
    days: session.preferredDays,
    location: profile.location ?? "",
    latitude: profile.locationChoice?.lat ? Number.parseFloat(profile.locationChoice.lat) : null,
    longitude: profile.locationChoice?.lon ? Number.parseFloat(profile.locationChoice.lon) : null,
    businessName: profile.businessName ?? "",
  };
}

export function isVenueReadyForMatching(
  session: VenueChatSession,
  location?: string,
  onboardingComplete = false,
) {
  return (
    onboardingComplete ||
    Boolean(
      session.needs.trim() &&
        session.supplyFrequency.trim() &&
        session.preferredDays.trim() &&
        location?.trim(),
    )
  );
}

function normalizeNeedText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitVenueNeedParts(value: string) {
  return value
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractVenueNeedsFromMessage(message: string): string[] {
  const found: string[] = [];
  for (const match of message.matchAll(/nevoie\s+(?:de|și|si)\s+([^.,;!?]+)/gi)) {
    const chunk = match[1]?.trim();
    if (chunk) found.push(chunk);
  }
  for (const match of message.matchAll(/(?:caut|vreau|adaug[aă])\s+(?:și\s+|si\s+)?([^.,;!?]+)/gi)) {
    const chunk = match[1]?.trim();
    if (chunk && chunk.length < 80) found.push(chunk);
  }
  const keywords = [
    { re: /\bmiere\b/i, label: "miere" },
    { re: /\blapte\b/i, label: "lapte" },
    { re: /\b(branza|brânz[aă])\b/i, label: "brânză" },
    { re: /\blegume\b/i, label: "legume" },
    { re: /\b(ou[aă]|oua)\b/i, label: "ouă" },
    { re: /\bvin\b/i, label: "vin" },
    { re: /\bcarne\b/i, label: "carne" },
  ];
  for (const { re, label } of keywords) {
    if (re.test(message)) found.push(label);
  }
  return found;
}

export function mergeVenueProductNeeds(current: string, additions: string[]): string | null {
  if (!additions.length) return null;
  const parts = splitVenueNeedParts(current);
  const before = parts.length;
  for (const addition of additions) {
    for (const piece of splitVenueNeedParts(addition)) {
      const pieceNorm = normalizeNeedText(piece);
      const exists = parts.some((part) => {
        const partNorm = normalizeNeedText(part);
        return partNorm.includes(pieceNorm) || pieceNorm.includes(partNorm);
      });
      if (!exists) parts.push(piece);
    }
  }
  return parts.length > before ? parts.join(", ") : null;
}

export function venueLeadsFromChat(messages: ChatMessage[], leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  const result: Lead[] = [];
  for (const message of messages) {
    if (message.kind !== "lead" || !message.leadId || seen.has(message.leadId)) continue;
    const lead = leads.find((item) => item.id === message.leadId);
    if (!lead) continue;
    seen.add(message.leadId);
    result.push(lead);
    if (result.length >= 3) break;
  }
  return result;
}

export function isVenueNeedsMessage(text: string): boolean {
  return /nevoie|caut[aă]|produc[aă]tor|furnizor|aprovizion|g[aă]se[sș]te|arat[aă]|list[aă]|vreau|miere|lapte|branz|brânz|legum|ou[aă]|vin/i.test(text);
}

export function formatVenueMatchDiagnosticsSummary(diagnostics: VenueMatchDiagnostics): string {
  return [
    `${diagnostics.totalApproved} producător${diagnostics.totalApproved === 1 ? "" : "i"} aprobați`,
    `${diagnostics.productRelevant} cu produs potrivit`,
    `${diagnostics.inRange} în rază`,
  ].join(" · ");
}

export function buildVenueMatchDiagnosticsHint(
  diagnostics: VenueMatchDiagnostics,
  productLabel?: string,
  scope: "matched" | "all" = "matched",
): string {
  const label = productLabel?.trim() || "ce cauți";
  if (diagnostics.totalApproved === 0) {
    return "Platforma nu are încă producători aprobați.";
  }
  if (diagnostics.outOfRangeOnly > 0 && diagnostics.inRange === 0) {
    return `Există ${diagnostics.outOfRangeOnly} producător(i) cu ${label}, dar nu livrează la distanța ta.`;
  }
  if (diagnostics.noProductMatch > 0 && diagnostics.productRelevant === 0) {
    return `Niciun producător înregistrat nu oferă ${label} acum.`;
  }
  if (scope === "matched" && diagnostics.productRelevant > 0 && diagnostics.inRange === 0) {
    return "Producători cu produs potrivit există, dar niciunul nu e în raza de livrare.";
  }
  return `Nu am găsit producători potriviți pentru ${label} în raza selectată.`;
}

export function buildVenueZeroMatchMessage(
  productLabel: string,
  diagnostics?: VenueMatchDiagnostics,
): string {
  if (!diagnostics) {
    return `Nu am găsit producători potriviți pentru ${productLabel} în raza de livrare. Deschide tab-ul Director pentru lista completă sau spune alt produs.`;
  }
  const hint = buildVenueMatchDiagnosticsHint(diagnostics, productLabel);
  if (diagnostics.totalApproved === 0) return hint;
  if (diagnostics.outOfRangeOnly > 0 && diagnostics.inRange === 0) {
    return `${hint} Deschide tab-ul Director pentru lista completă.`;
  }
  if (diagnostics.noProductMatch > 0 && diagnostics.productRelevant === 0) {
    return `${hint} Deschide tab-ul Director sau spune alt produs.`;
  }
  return `${hint} Deschide tab-ul Director pentru lista completă.`;
}
