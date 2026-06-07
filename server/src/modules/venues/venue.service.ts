import { prisma } from "../../shared/prisma.js";
import type { UpdateVenueProfileInput, UpdateVenueSearchIntentInput } from "./venue.schema.js";
import { mapVenueProfile, mapVenueSearchIntent } from "./venue.mapper.js";

async function getOrCreateProfile(userId: string) {
  const existing = await prisma.venueProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.venueProfile.create({
    data: { userId },
  });
}

export async function getMyProfile(userId: string) {
  const profile = await getOrCreateProfile(userId);
  return mapVenueProfile(profile);
}

export async function updateMyProfile(userId: string, input: UpdateVenueProfileInput) {
  await getOrCreateProfile(userId);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { accountType: "VENUE" },
    });

    return tx.venueProfile.update({
      where: { userId },
      data: input,
    });
  });

  return mapVenueProfile(updated);
}

function normalizeSearchIntent(input: UpdateVenueSearchIntentInput) {
  return {
    productsNeeded: input.productsNeeded.trim(),
    supplyFrequency: input.supplyFrequency.trim(),
    preferredDays: input.preferredDays.trim(),
  };
}

function searchIntentChanged(
  current: { productsNeeded: string; supplyFrequency: string; preferredDays: string },
  next: ReturnType<typeof normalizeSearchIntent>,
) {
  return (
    current.productsNeeded !== next.productsNeeded ||
    current.supplyFrequency !== next.supplyFrequency ||
    current.preferredDays !== next.preferredDays
  );
}

export async function upsertVenueSearchIntent(userId: string, input: UpdateVenueSearchIntentInput) {
  const profile = await getOrCreateProfile(userId);
  const next = normalizeSearchIntent(input);

  if (!searchIntentChanged(profile, next)) {
    return mapVenueSearchIntent(profile);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.venueSearchHistory.create({
      data: {
        venueUserId: userId,
        productsNeeded: next.productsNeeded,
        supplyFrequency: next.supplyFrequency,
        preferredDays: next.preferredDays,
      },
    });

    return tx.venueProfile.update({
      where: { userId },
      data: {
        ...next,
        needsUpdatedAt: new Date(),
      },
    });
  });

  return mapVenueSearchIntent(updated);
}

export async function getVenueSearchIntent(userId: string) {
  const profile = await getOrCreateProfile(userId);
  return mapVenueSearchIntent(profile);
}
