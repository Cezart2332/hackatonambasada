import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ReviewRegistrationInput, UpdateProducerVerifiedInput } from "./admin.schema.js";
import {
  mapProducerRegistration,
  mapVenueRegistration,
  type AdminRegistrationDto,
} from "./admin.mapper.js";

export async function listRegistrations(status?: string): Promise<AdminRegistrationDto[]> {
  const approvalFilter =
    status === "pending" || status === "approved" || status === "rejected"
      ? (status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED")
      : undefined;

  const [producers, venues] = await Promise.all([
    prisma.user.findMany({
      where: {
        accountType: "PRODUCER",
        producerProfile: approvalFilter ? { approvalStatus: approvalFilter } : { isNot: null },
      },
      include: {
        producerProfile: {
          include: { products: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        accountType: "VENUE",
        venueProfile: approvalFilter ? { approvalStatus: approvalFilter } : { isNot: null },
      },
      include: { venueProfile: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const producerRows = producers
    .filter((user) => user.producerProfile)
    .map((user) => mapProducerRegistration(user, user.producerProfile!));

  const venueRows = venues
    .filter((user) => user.venueProfile)
    .map((user) => mapVenueRegistration(user, user.venueProfile!));

  return [...producerRows, ...venueRows].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
  );
}

export async function reviewRegistration(userId: string, input: ReviewRegistrationInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      producerProfile: true,
      venueProfile: true,
    },
  });

  if (!user || (user.accountType !== "PRODUCER" && user.accountType !== "VENUE")) {
    throw new AppError("Înregistrarea nu a fost găsită.", 404, "NOT_FOUND");
  }

  const nextStatus = input.status === "approved" ? "APPROVED" : "REJECTED";

  if (user.accountType === "PRODUCER" && user.producerProfile) {
    await prisma.producerProfile.update({
      where: { id: user.producerProfile.id },
      data: {
        approvalStatus: nextStatus,
        ...(nextStatus === "REJECTED" ? { verified: false } : {}),
      },
    });
    return { userId, status: input.status };
  }

  if (user.accountType === "VENUE" && user.venueProfile) {
    await prisma.venueProfile.update({
      where: { id: user.venueProfile.id },
      data: { approvalStatus: nextStatus },
    });
    return { userId, status: input.status };
  }

  throw new AppError("Profilul nu a fost găsit.", 404, "NOT_FOUND");
}

export async function listActiveAccounts(type?: string): Promise<AdminRegistrationDto[]> {
  const accountTypeFilter =
    type === "producer" ? ("PRODUCER" as const) : type === "venue" ? ("VENUE" as const) : undefined;

  const rows: AdminRegistrationDto[] = [];

  if (!accountTypeFilter || accountTypeFilter === "PRODUCER") {
    const producers = await prisma.user.findMany({
      where: {
        accountType: "PRODUCER",
        producerProfile: { approvalStatus: "APPROVED" },
      },
      include: {
        producerProfile: {
          include: { products: true },
        },
      },
      orderBy: { producerProfile: { updatedAt: "desc" } },
    });

    rows.push(
      ...producers
        .filter((user) => user.producerProfile)
        .map((user) => mapProducerRegistration(user, user.producerProfile!)),
    );
  }

  if (!accountTypeFilter || accountTypeFilter === "VENUE") {
    const venues = await prisma.user.findMany({
      where: {
        accountType: "VENUE",
        venueProfile: { approvalStatus: "APPROVED" },
      },
      include: { venueProfile: true },
      orderBy: { venueProfile: { updatedAt: "desc" } },
    });

    rows.push(
      ...venues
        .filter((user) => user.venueProfile)
        .map((user) => mapVenueRegistration(user, user.venueProfile!)),
    );
  }

  return rows.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function updateAccountStatus(userId: string, input: ReviewRegistrationInput) {
  return reviewRegistration(userId, input);
}

export async function updateProducerVerified(userId: string, input: UpdateProducerVerifiedInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { producerProfile: true },
  });

  if (!user?.producerProfile || user.accountType !== "PRODUCER") {
    throw new AppError("Producătorul nu a fost găsit.", 404, "NOT_FOUND");
  }

  if (user.producerProfile.approvalStatus !== "APPROVED") {
    throw new AppError("Doar producătorii aprobați pot fi marcați ca verificați.", 400, "INVALID_STATE");
  }

  await prisma.producerProfile.update({
    where: { id: user.producerProfile.id },
    data: { verified: input.verified },
  });

  return { userId, verified: input.verified };
}
