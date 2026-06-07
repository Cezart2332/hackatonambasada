import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { listDiscoveredLeads } from "../leads/lead.ai.js";

const TIMEZONE = "Europe/Bucharest";

export const FREE_WEEKLY_DISCOVERIES = 3;
export const FREE_ACTIVE_LEADS = 3;
export const FREE_WEEKLY_SIMULATIONS = 1;
export const PRO_DISCOVERY_BATCH_SIZE = 10;

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

function getZonedParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number.parseInt(read("year"), 10),
    month: Number.parseInt(read("month"), 10),
    day: Number.parseInt(read("day"), 10),
    weekday: read("weekday"),
  };
}

export function getWeekKey(date = new Date()): string {
  const { year, month, day } = getZonedParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getNextMondayReset(date = new Date()): Date {
  const { year, month, day, weekday } = getZonedParts(date);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysUntilMonday = weekdayIndex === 0 ? 1 : weekdayIndex === 1 ? 7 : 8 - weekdayIndex;
  const target = new Date(Date.UTC(year, month - 1, day + daysUntilMonday, 0, 0, 0));
  return target;
}

async function getProducerTier(userId: string): Promise<PlanTier> {
  const profile = await prisma.producerProfile.findUnique({
    where: { userId },
    select: { subscriptionTier: true },
  });
  if (!profile) return "free";
  return profile.subscriptionTier === "PRO" ? "pro" : "free";
}

export function limitsForTier(tier: PlanTier): PlanLimits {
  if (tier === "pro") {
    return {
      weeklyDiscoveries: Number.MAX_SAFE_INTEGER,
      activeLeads: Number.MAX_SAFE_INTEGER,
      weeklySimulations: Number.MAX_SAFE_INTEGER,
      discoverMore: true,
      stats: true,
      richDetails: true,
    };
  }
  return {
    weeklyDiscoveries: FREE_WEEKLY_DISCOVERIES,
    activeLeads: FREE_ACTIVE_LEADS,
    weeklySimulations: FREE_WEEKLY_SIMULATIONS,
    discoverMore: false,
    stats: false,
    richDetails: false,
  };
}

export async function countActiveLeads(userId: string): Promise<number> {
  const listed = await listDiscoveredLeads(userId, 44.17, 28.63);
  if (!listed?.length) return 0;
  return listed.filter((lead) => lead.status !== "Nu e potrivit").length;
}

async function getOrCreateQuota(userId: string, weekKey: string) {
  return prisma.usageQuota.upsert({
    where: { userId_weekKey: { userId, weekKey } },
    create: { userId, weekKey },
    update: {},
  });
}

export async function getPlanContext(userId: string, accountType?: string): Promise<PlanContext> {
  if (accountType === "venue" || accountType === "VENUE") {
    return {
      tier: "pro",
      limits: {
        weeklyDiscoveries: Number.MAX_SAFE_INTEGER,
        activeLeads: Number.MAX_SAFE_INTEGER,
        weeklySimulations: Number.MAX_SAFE_INTEGER,
        discoverMore: true,
        stats: false,
        richDetails: true,
      },
      usage: { weeklyDiscoveries: 0, weeklySimulations: 0, activeLeads: 0 },
      weekKey: getWeekKey(),
      resetsAt: getNextMondayReset().toISOString(),
      proActivatedAt: null,
    };
  }

  const weekKey = getWeekKey();
  const [tier, quota, profile, activeLeads] = await Promise.all([
    getProducerTier(userId),
    getOrCreateQuota(userId, weekKey),
    prisma.producerProfile.findUnique({
      where: { userId },
      select: { proActivatedAt: true },
    }),
    countActiveLeads(userId),
  ]);

  const limits = limitsForTier(tier);

  return {
    tier,
    limits,
    usage: {
      weeklyDiscoveries: quota.discoveries,
      weeklySimulations: quota.simulations,
      activeLeads,
    },
    weekKey,
    resetsAt: getNextMondayReset().toISOString(),
    proActivatedAt: profile?.proActivatedAt?.toISOString() ?? null,
  };
}

export async function assertCanDiscover(
  userId: string,
  options: { discoverMore?: boolean; accountType?: string } = {},
) {
  const ctx = await getPlanContext(userId, options.accountType);

  if (options.accountType === "venue" || options.accountType === "VENUE") {
    return ctx;
  }

  if (options.discoverMore) {
    if (!ctx.limits.discoverMore) {
      throw new AppError(
        "Căutarea de lead-uri suplimentare este disponibilă doar în planul Pro.",
        402,
        "PLAN_PRO_REQUIRED",
      );
    }
    if (ctx.tier !== "pro" && ctx.usage.activeLeads >= ctx.limits.activeLeads) {
      throw new AppError(
        `Ai ${ctx.limits.activeLeads} lead-uri active. Marchează unele ca „Nu e potrivit” pentru a face loc.`,
        402,
        "PLAN_LIMIT_ACTIVE",
      );
    }
    return ctx;
  }

  if (ctx.tier === "free" && ctx.usage.weeklyDiscoveries >= ctx.limits.weeklyDiscoveries) {
    throw new AppError(
      "Ai folosit cele 3 recomandări din această săptămână. Revin luni sau treci la Pro.",
      402,
      "PLAN_LIMIT_WEEKLY",
    );
  }

  if (ctx.tier !== "pro" && ctx.usage.activeLeads >= ctx.limits.activeLeads) {
    throw new AppError(
      `Ai atins limita de ${ctx.limits.activeLeads} lead-uri active. Marchează unele ca „Nu e potrivit” pentru a face loc.`,
      402,
      "PLAN_LIMIT_ACTIVE",
    );
  }

  return ctx;
}

export async function recordDiscovery(userId: string) {
  const weekKey = getWeekKey();
  await prisma.usageQuota.upsert({
    where: { userId_weekKey: { userId, weekKey } },
    create: { userId, weekKey, discoveries: 1 },
    update: { discoveries: { increment: 1 } },
  });
}

export async function assertCanSimulate(userId: string, accountType?: string) {
  const ctx = await getPlanContext(userId, accountType);
  if (accountType === "venue" || accountType === "VENUE") {
    return ctx;
  }
  if (ctx.tier === "pro") return ctx;
  if (ctx.usage.weeklySimulations >= ctx.limits.weeklySimulations) {
    throw new AppError(
      "Ai folosit simularea gratuită din această săptămână. Treci la Pro pentru simulări nelimitate.",
      402,
      "PLAN_LIMIT_SIMULATION",
    );
  }
  return ctx;
}

export async function recordSimulation(userId: string) {
  const weekKey = getWeekKey();
  await prisma.usageQuota.upsert({
    where: { userId_weekKey: { userId, weekKey } },
    create: { userId, weekKey, simulations: 1 },
    update: { simulations: { increment: 1 } },
  });
}

export async function upgradeToPro(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.accountType !== "PRODUCER") {
    throw new AppError("Upgrade Pro este disponibil doar pentru producători.", 403, "FORBIDDEN");
  }

  await prisma.producerProfile.upsert({
    where: { userId },
    create: {
      userId,
      subscriptionTier: "PRO",
      proActivatedAt: new Date(),
    },
    update: {
      subscriptionTier: "PRO",
      proActivatedAt: new Date(),
    },
  });

  return getPlanContext(userId);
}

export async function downgradeToFree(userId: string) {
  await prisma.producerProfile.updateMany({
    where: { userId },
    data: { subscriptionTier: "FREE", proActivatedAt: null },
  });
  return getPlanContext(userId);
}

export function discoveryLimitForPlan(ctx: PlanContext): number {
  if (ctx.tier === "pro") {
    return Math.min(remainingActive, 3);
    return PRO_DISCOVERY_BATCH_SIZE;
  }
  const remainingActive = Math.max(0, ctx.limits.activeLeads - ctx.usage.activeLeads);
  const remainingWeekly = Math.max(
    0,
    ctx.limits.weeklyDiscoveries - ctx.usage.weeklyDiscoveries,
  );
  return Math.min(remainingActive, remainingWeekly, 3);
}
