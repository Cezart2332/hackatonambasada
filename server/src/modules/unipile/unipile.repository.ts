import type { Integration, IntegrationProvider } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";

export async function listLinkedExternalAccountIds(): Promise<string[]> {
  const rows = await prisma.integration.findMany({
    where: { externalAccountId: { not: null } },
    select: { externalAccountId: true },
  });
  return rows
    .map((row) => row.externalAccountId)
    .filter((value): value is string => Boolean(value));
}

export async function findIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<Integration | null> {
  return prisma.integration.findUnique({
    where: {
      userId_provider: { userId, provider },
    },
  });
}

export async function findIntegrationByExternalAccountId(
  externalAccountId: string,
): Promise<Integration | null> {
  return prisma.integration.findFirst({
    where: { externalAccountId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertPendingIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<Integration> {
  return prisma.integration.upsert({
    where: {
      userId_provider: { userId, provider },
    },
    create: {
      userId,
      provider,
      status: "PENDING",
    },
    update: {
      status: "PENDING",
      externalAccountId: null,
    },
  });
}

export async function markConnected(
  userId: string,
  provider: IntegrationProvider,
  externalAccountId: string,
): Promise<Integration> {
  return prisma.integration.upsert({
    where: {
      userId_provider: { userId, provider },
    },
    create: {
      userId,
      provider,
      externalAccountId,
      status: "CONNECTED",
    },
    update: {
      externalAccountId,
      status: "CONNECTED",
    },
  });
}

export async function markDisconnected(externalAccountId: string): Promise<Integration | null> {
  const existing = await findIntegrationByExternalAccountId(externalAccountId);
  if (!existing) return null;
  return prisma.integration.update({
    where: { id: existing.id },
    data: { status: "DISCONNECTED" },
  });
}

export async function markError(externalAccountId: string): Promise<Integration | null> {
  const existing = await findIntegrationByExternalAccountId(externalAccountId);
  if (!existing) return null;
  return prisma.integration.update({
    where: { id: existing.id },
    data: { status: "ERROR" },
  });
}

export async function markConnectedByExternalAccountId(
  externalAccountId: string,
  userId?: string,
  provider?: IntegrationProvider,
): Promise<Integration | null> {
  const existing = await findIntegrationByExternalAccountId(externalAccountId);
  if (existing) {
    return prisma.integration.update({
      where: { id: existing.id },
      data: { status: "CONNECTED", externalAccountId },
    });
  }
  if (!userId || !provider) return null;
  return markConnected(userId, provider, externalAccountId);
}
