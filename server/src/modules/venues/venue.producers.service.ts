import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { mapApiStatusToDb, mapLeadStatusToApi } from "../leads/lead.mapper.js";
import {
  computeMatchDiagnostics,
  matchProducersForVenue,
  type VenueProducerMatchScope,
  type VenueMatchDiagnostics,
} from "./producer-for-venue.matcher.js";
import { mapProducerMatchToDto } from "./venue.producers.mapper.js";

const DEFAULT_LAT = 44.1787;
const DEFAULT_LON = 28.6538;

async function getVenueContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { venueProfile: true },
  });

  if (!user?.venueProfile) {
    throw new AppError("Profilul localului nu a fost găsit.", 404, "NOT_FOUND");
  }

  return { user, profile: user.venueProfile };
}

async function fetchApprovedProducerCandidates() {
  const producers = await prisma.user.findMany({
    where: {
      accountType: "PRODUCER",
      producerProfile: {
        is: { approvalStatus: "APPROVED" },
      },
    },
    include: {
      producerProfile: {
        include: { products: true },
      },
    },
  });

  return producers
    .filter((entry) => entry.producerProfile)
    .map((entry) => ({
      userId: entry.id,
      contactName: entry.name,
      businessName: entry.producerProfile!.businessName,
      phone: entry.producerProfile!.phone,
      location: entry.producerProfile!.location,
      latitude: entry.producerProfile!.latitude,
      longitude: entry.producerProfile!.longitude,
      rangeKm: entry.producerProfile!.rangeKm,
      deliveryDays: entry.producerProfile!.deliveryDays,
      products: entry.producerProfile!.products,
      verified: entry.producerProfile!.verified,
    }));
}

async function listPlatformProducers(
  userId: string,
  scope: VenueProducerMatchScope = "matched",
  productsNeeded = "",
) {
  const { profile } = await getVenueContext(userId);
  const latitude = profile.latitude ?? DEFAULT_LAT;
  const longitude = profile.longitude ?? DEFAULT_LON;

  const candidates = await fetchApprovedProducerCandidates();
  const matched = matchProducersForVenue({
    producers: candidates,
    venueLatitude: latitude,
    venueLongitude: longitude,
    productsNeeded,
    venueBusinessName: profile.businessName,
    scope,
  });

  const statuses = await prisma.producerMatchStatusRecord.findMany({
    where: { venueUserId: userId },
  });
  const statusByProducer = new Map(statuses.map((item) => [item.producerUserId, item]));

  const diagnostics =
    scope === "matched"
      ? computeMatchDiagnostics({
          producers: candidates,
          venueLatitude: latitude,
          venueLongitude: longitude,
          productsNeeded,
        })
      : undefined;

  return {
    producers: matched.map((producer) => ({
      ...mapProducerMatchToDto(producer),
      status: statusByProducer.get(producer.userId)
        ? mapLeadStatusToApi(statusByProducer.get(producer.userId)!.status)
        : null,
    })),
    diagnostics,
  };
}

export async function listMatchedProducersForVenue(
  userId: string,
  options: { scope?: VenueProducerMatchScope; productsNeeded?: string } = {},
) {
  const scope = options.scope === "all" ? "all" : "matched";
  return listPlatformProducers(userId, scope, options.productsNeeded?.trim() ?? "");
}

export async function refreshMatchedProducersForVenue(
  userId: string,
  options: { productsNeeded?: string } = {},
) {
  return listPlatformProducers(userId, "matched", options.productsNeeded?.trim() ?? "");
}

/** @deprecated Use refreshMatchedProducersForVenue — no AI scraping */
export async function discoverMatchedProducersForVenue(userId: string) {
  return refreshMatchedProducersForVenue(userId);
}

/** @deprecated Use listMatchedProducersForVenue with scope=all */
export async function discoverMoreProducersForVenue(userId: string) {
  return listPlatformProducers(userId, "all");
}

export async function updateProducerMatchStatus(
  venueUserId: string,
  producerUserId: string,
  status: string,
) {
  const producer = await prisma.user.findFirst({
    where: {
      id: producerUserId,
      accountType: "PRODUCER",
      producerProfile: { is: { approvalStatus: "APPROVED" } },
    },
  });

  if (!producer) {
    throw new AppError("Producătorul nu a fost găsit.", 404, "NOT_FOUND");
  }

  const dbStatus = mapApiStatusToDb(status);
  const record = await prisma.producerMatchStatusRecord.upsert({
    where: {
      producerUserId_venueUserId: {
        producerUserId,
        venueUserId,
      },
    },
    create: {
      producerUserId,
      venueUserId,
      status: dbStatus,
    },
    update: { status: dbStatus },
  });

  return {
    producerUserId,
    status: mapLeadStatusToApi(record.status),
  };
}
