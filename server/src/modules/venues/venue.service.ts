import { prisma } from "../../shared/prisma.js";
import type { UpdateVenueProfileInput } from "./venue.schema.js";
import { mapVenueProfile } from "./venue.mapper.js";

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
