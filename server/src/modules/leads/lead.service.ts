import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { matchLeads } from "./lead.matcher.js";
import {
  mapApiStatusToDb,
  mapLeadDetail,
  mapLeadStatusToApi,
  mapLeadToDto,
} from "./lead.mapper.js";
import type { MatchLeadsInput } from "./lead.schema.js";

const DEFAULT_LAT = 44.1699;
const DEFAULT_LON = 28.6348;

async function getProfileContext(userId: string) {
  let profile = await prisma.producerProfile.findUnique({
    where: { userId },
    include: { products: true },
  });

  if (!profile) {
    profile = await prisma.producerProfile.create({
      data: { userId },
      include: { products: true },
    });
  }

  return profile;
}

export async function matchForUser(userId: string, input: MatchLeadsInput = {}) {
  const profile = await getProfileContext(userId);
  const latitude = input.latitude ?? profile.latitude ?? DEFAULT_LAT;
  const longitude = input.longitude ?? profile.longitude ?? DEFAULT_LON;
  const rangeKm = input.rangeKm ?? profile.rangeKm ?? 35;

  const leads = await prisma.lead.findMany();
  const matched = matchLeads({
    leads,
    latitude,
    longitude,
    rangeKm,
    products: profile.products,
  });

  return matched.map(mapLeadToDto);
}

export async function listLeadsForUser(userId: string) {
  const profile = await getProfileContext(userId);
  const latitude = profile.latitude ?? DEFAULT_LAT;
  const longitude = profile.longitude ?? DEFAULT_LON;
  const rangeKm = profile.rangeKm ?? 35;

  const leads = await prisma.lead.findMany();
  const matched = matchLeads({
    leads,
    latitude,
    longitude,
    rangeKm,
    products: profile.products,
  });

  const statuses = await prisma.leadStatusRecord.findMany({
    where: { userId },
  });
  const statusByLead = new Map(statuses.map((s) => [s.leadId, s]));

  return matched.map((lead) => ({
    ...mapLeadToDto(lead),
    status: statusByLead.get(lead.id)
      ? mapLeadStatusToApi(statusByLead.get(lead.id)!.status)
      : null,
  }));
}

export async function getLeadById(userId: string, leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new AppError("Lead not found", 404, "NOT_FOUND");
  }

  const statusRecord = await prisma.leadStatusRecord.findUnique({
    where: { leadId_userId: { leadId, userId } },
  });

  return mapLeadDetail(lead, statusRecord);
}

export async function updateLeadStatus(
  userId: string,
  leadId: string,
  status: string,
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new AppError("Lead not found", 404, "NOT_FOUND");
  }

  const dbStatus = mapApiStatusToDb(status);

  const record = await prisma.leadStatusRecord.upsert({
    where: { leadId_userId: { leadId, userId } },
    create: { leadId, userId, status: dbStatus },
    update: { status: dbStatus },
  });

  return {
    leadId,
    status: mapLeadStatusToApi(record.status),
  };
}