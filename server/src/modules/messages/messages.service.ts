import type { AccountType, User } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { updatePlatformVenueLeadStatus } from "../venues/venue-for-producer.service.js";
import { updateProducerMatchStatus } from "../venues/venue.producers.service.js";

type ParticipantPair = {
  producerUserId: string;
  venueUserId: string;
};

async function loadApprovedUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      producerProfile: true,
      venueProfile: true,
    },
  });
}

function isApprovedProducer(user: {
  accountType: AccountType;
  producerProfile: { approvalStatus: string } | null;
}) {
  return (
    user.accountType === "PRODUCER" &&
    user.producerProfile?.approvalStatus === "APPROVED"
  );
}

function isApprovedVenue(user: {
  accountType: AccountType;
  venueProfile: { approvalStatus: string } | null;
}) {
  return (
    user.accountType === "VENUE" && user.venueProfile?.approvalStatus === "APPROVED"
  );
}

async function resolveParticipantPair(
  currentUser: User,
  counterpartUserId: string,
): Promise<ParticipantPair> {
  if (currentUser.accountType === "ADMIN") {
    throw new AppError("Contul de administrator nu poate folosi mesageria.", 403, "FORBIDDEN");
  }

  const actor = await loadApprovedUser(currentUser.id);
  if (!actor) {
    throw new AppError("Contul tău nu a fost găsit.", 404, "NOT_FOUND");
  }

  const counterpart = await loadApprovedUser(counterpartUserId);
  if (!counterpart) {
    throw new AppError("Partenerul nu a fost găsit.", 404, "NOT_FOUND");
  }

  if (actor.accountType === "PRODUCER") {
    if (!isApprovedProducer(actor)) {
      throw new AppError("Contul de producător nu este aprobat.", 403, "FORBIDDEN");
    }
    if (!isApprovedVenue(counterpart)) {
      throw new AppError("Poți contacta doar localuri înregistrate și aprobate.", 403, "FORBIDDEN");
    }
    return { producerUserId: actor.id, venueUserId: counterpart.id };
  }

  if (actor.accountType === "VENUE") {
    if (!isApprovedVenue(actor)) {
      throw new AppError("Contul de local nu este aprobat.", 403, "FORBIDDEN");
    }
    if (!isApprovedProducer(counterpart)) {
      throw new AppError("Poți contacta doar producători înregistrați și aprobați.", 403, "FORBIDDEN");
    }
    return { producerUserId: counterpart.id, venueUserId: actor.id };
  }

  throw new AppError("Tip de cont neacceptat pentru mesagerie.", 403, "FORBIDDEN");
}

async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await prisma.directConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      reads: {
        where: { userId },
        take: 1,
      },
    },
  });

  if (!conversation) {
    throw new AppError("Conversația nu a fost găsită.", 404, "NOT_FOUND");
  }

  if (conversation.producerUserId !== userId && conversation.venueUserId !== userId) {
    throw new AppError("Nu ai acces la această conversație.", 403, "FORBIDDEN");
  }

  return conversation;
}

function counterpartUserIdFor(
  conversation: { producerUserId: string; venueUserId: string },
  userId: string,
) {
  return conversation.producerUserId === userId
    ? conversation.venueUserId
    : conversation.producerUserId;
}

async function loadCounterpartSummary(counterpartUserId: string) {
  const user = await loadApprovedUser(counterpartUserId);
  if (!user) {
    return {
      counterpartUserId,
      counterpartName: "Utilizator",
      counterpartBusinessName: "",
    };
  }

  const businessName =
    user.producerProfile?.businessName?.trim() ||
    user.venueProfile?.businessName?.trim() ||
    "";

  return {
    counterpartUserId,
    counterpartName: user.name.trim() || businessName || "Utilizator",
    counterpartBusinessName: businessName,
  };
}

async function countUnreadForConversation(
  conversationId: string,
  userId: string,
  lastReadAt: Date | null,
) {
  return prisma.directMessage.count({
    where: {
      conversationId,
      senderUserId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

function mapConversationSummary(
  conversation: {
    id: string;
    producerUserId: string;
    venueUserId: string;
    lastMessageAt: Date;
    updatedAt: Date;
    messages: Array<{
      body: string;
      createdAt: Date;
      senderUserId: string;
    }>;
    reads: Array<{ lastReadAt: Date }>;
  },
  userId: string,
  counterpart: {
    counterpartUserId: string;
    counterpartName: string;
    counterpartBusinessName: string;
  },
  unreadCount: number,
) {
  const lastMessage = conversation.messages[0] ?? null;

  return {
    id: conversation.id,
    ...counterpart,
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          createdAt: lastMessage.createdAt.toISOString(),
          senderUserId: lastMessage.senderUserId,
        }
      : null,
    unreadCount,
    updatedAt: conversation.lastMessageAt.toISOString(),
  };
}

export async function openConversation(user: User, counterpartUserId: string) {
  const pair = await resolveParticipantPair(user, counterpartUserId);

  const conversation = await prisma.directConversation.upsert({
    where: {
      producerUserId_venueUserId: pair,
    },
    create: pair,
    update: {},
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      reads: {
        where: { userId: user.id },
        take: 1,
      },
    },
  });

  const counterpartId = counterpartUserIdFor(conversation, user.id);
  const counterpart = await loadCounterpartSummary(counterpartId);
  const lastReadAt = conversation.reads[0]?.lastReadAt ?? null;
  const unreadCount = await countUnreadForConversation(
    conversation.id,
    user.id,
    lastReadAt,
  );

  return mapConversationSummary(conversation, user.id, counterpart, unreadCount);
}

export async function listConversations(user: User) {
  if (user.accountType === "ADMIN") {
    throw new AppError("Contul de administrator nu poate folosi mesageria.", 403, "FORBIDDEN");
  }

  const conversations = await prisma.directConversation.findMany({
    where:
      user.accountType === "PRODUCER"
        ? { producerUserId: user.id }
        : { venueUserId: user.id },
    orderBy: { lastMessageAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      reads: {
        where: { userId: user.id },
        take: 1,
      },
    },
  });

  const summaries = await Promise.all(
    conversations.map(async (conversation) => {
      const counterpartId = counterpartUserIdFor(conversation, user.id);
      const counterpart = await loadCounterpartSummary(counterpartId);
      const lastReadAt = conversation.reads[0]?.lastReadAt ?? null;
      const unreadCount = await countUnreadForConversation(
        conversation.id,
        user.id,
        lastReadAt,
      );
      return mapConversationSummary(conversation, user.id, counterpart, unreadCount);
    }),
  );

  return summaries;
}

export async function listConversationMessages(
  user: User,
  conversationId: string,
  options: { limit?: number; before?: string } = {},
) {
  const conversation = await getConversationForUser(conversationId, user.id);
  const limit = options.limit ?? 50;

  const messages = await prisma.directMessage.findMany({
    where: {
      conversationId,
      ...(options.before
        ? {
            createdAt: {
              lt: new Date(options.before),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    messages: messages
      .slice()
      .reverse()
      .map((message) => ({
        id: message.id,
        senderUserId: message.senderUserId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        isMine: message.senderUserId === user.id,
      })),
  };
}

async function markContactedOnFirstMessage(
  conversation: { producerUserId: string; venueUserId: string },
  senderUserId: string,
  isFirstMessage: boolean,
) {
  if (!isFirstMessage) return;

  if (senderUserId === conversation.producerUserId) {
    await updatePlatformVenueLeadStatus(
      conversation.producerUserId,
      conversation.venueUserId,
      "Contactat",
    );
    return;
  }

  await updateProducerMatchStatus(
    conversation.venueUserId,
    conversation.producerUserId,
    "Contactat",
  );
}

export async function sendMessage(user: User, conversationId: string, body: string) {
  const conversation = await getConversationForUser(conversationId, user.id);

  const existingCount = await prisma.directMessage.count({
    where: { conversationId },
  });
  const isFirstMessage = existingCount === 0;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.directMessage.create({
      data: {
        conversationId,
        senderUserId: user.id,
        body,
      },
    });

    await tx.directConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: created.createdAt,
      },
    });

    await tx.directConversationRead.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      create: {
        conversationId,
        userId: user.id,
        lastReadAt: created.createdAt,
      },
      update: {
        lastReadAt: created.createdAt,
      },
    });

    return created;
  });

  await markContactedOnFirstMessage(conversation, user.id, isFirstMessage);

  return {
    id: message.id,
    senderUserId: message.senderUserId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    isMine: true,
  };
}

export async function markConversationRead(user: User, conversationId: string) {
  await getConversationForUser(conversationId, user.id);

  const latestMessage = await prisma.directMessage.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
  });

  const lastReadAt = latestMessage?.createdAt ?? new Date();

  await prisma.directConversationRead.upsert({
    where: {
      conversationId_userId: {
        conversationId,
        userId: user.id,
      },
    },
    create: {
      conversationId,
      userId: user.id,
      lastReadAt,
    },
    update: {
      lastReadAt,
    },
  });

  return { ok: true };
}

export async function getUnreadCount(user: User) {
  if (user.accountType === "ADMIN") {
    return { unreadCount: 0 };
  }

  const conversations = await prisma.directConversation.findMany({
    where:
      user.accountType === "PRODUCER"
        ? { producerUserId: user.id }
        : { venueUserId: user.id },
    select: {
      id: true,
      reads: {
        where: { userId: user.id },
        take: 1,
        select: { lastReadAt: true },
      },
    },
  });

  let unreadCount = 0;
  for (const conversation of conversations) {
    const lastReadAt = conversation.reads[0]?.lastReadAt ?? null;
    unreadCount += await countUnreadForConversation(
      conversation.id,
      user.id,
      lastReadAt,
    );
  }

  return { unreadCount };
}
