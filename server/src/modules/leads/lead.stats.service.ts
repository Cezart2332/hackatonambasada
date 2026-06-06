import { AppError } from "../../shared/errors/AppError.js";
import { prisma } from "../../shared/prisma.js";
import { getPlanContext } from "../billing/plan.service.js";
import { searchLocations } from "../geo/geo.service.js";
import { listDiscoveredLeads } from "./lead.ai.js";

const STATUS_ORDER = ["Bun", "Contactat", "A răspuns", "A cumpărat"] as const;
const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;
const geocodedLocalityCache = new Map<string, { latitude: number; longitude: number }>();

async function getStatsOrigin(userId: string) {
  const profile = await prisma.producerProfile.findUnique({ where: { userId } });
  if (!profile) return { latitude: DEFAULT_LAT, longitude: DEFAULT_LON };
  if (profile.latitude != null && profile.longitude != null) {
    return { latitude: profile.latitude, longitude: profile.longitude };
  }

  const locality = (profile.locationChoice || profile.location || "").trim();
  if (!locality) return { latitude: DEFAULT_LAT, longitude: DEFAULT_LON };

  const cacheKey = locality.toLowerCase();
  const cached = geocodedLocalityCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [first] = await searchLocations(`${locality}, Dobrogea, România`);
    if (first) {
      const coords = { latitude: first.latitude, longitude: first.longitude };
      geocodedLocalityCache.set(cacheKey, coords);
      await prisma.producerProfile
        .update({
          where: { id: profile.id },
          data: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            locationChoice: profile.locationChoice || first.label,
          },
        })
        .catch(() => undefined);
      return coords;
    }
  } catch {
    return { latitude: DEFAULT_LAT, longitude: DEFAULT_LON };
  }

  return { latitude: DEFAULT_LAT, longitude: DEFAULT_LON };
}

export async function getLeadStatsForUser(userId: string, accountType?: string) {
  const plan = await getPlanContext(userId, accountType);
  if (!plan.limits.stats) {
    throw new AppError(
      "Statisticile sunt disponibile doar în planul Pro.",
      402,
      "PLAN_PRO_REQUIRED",
    );
  }

  const origin = await getStatsOrigin(userId);
  const listed = await listDiscoveredLeads(userId, origin.latitude, origin.longitude);
  const leads = listed ?? [];

  const pipeline: Record<string, number> = {
    Bun: 0,
    "Nu e potrivit": 0,
    Contactat: 0,
    "A răspuns": 0,
    "A cumpărat": 0,
    necunoscut: 0,
  };

  let matchSum = 0;
  let distanceSum = 0;
  let activeCount = 0;

  for (const lead of leads) {
    const status = lead.status ?? "necunoscut";
    pipeline[status] = (pipeline[status] ?? 0) + 1;
    matchSum += lead.match ?? 0;
    const distance = Number.parseFloat(String(lead.distance).replace(" km", "")) || 0;
    distanceSum += distance;
    if (status !== "Nu e potrivit") activeCount += 1;
  }

  const count = leads.length || 1;

  return {
    pipeline,
    weekly: {
      discoveredThisWeek: plan.usage.weeklyDiscoveries,
      weeklyLimit: plan.tier === "pro" ? null : plan.limits.weeklyDiscoveries,
      activeLeads: activeCount,
      activeLimit: plan.limits.activeLeads,
    },
    matchQuality: {
      averageMatch: leads.length ? Math.round(matchSum / leads.length) : 0,
      averageDistanceKm: leads.length ? Math.round(distanceSum / leads.length) : 0,
      totalLeads: leads.length,
    },
  };
}

export function buildStatusTimeline(currentStatus: string | null | undefined) {
  const activeIndex = currentStatus
    ? STATUS_ORDER.indexOf(currentStatus as (typeof STATUS_ORDER)[number])
    : -1;

  return STATUS_ORDER.map((step, index) => ({
    step,
    reached: activeIndex >= 0 && index <= activeIndex,
    current: step === currentStatus,
  }));
}
