-- CreateTable
CREATE TABLE "direct_conversation" (
    "id" TEXT NOT NULL,
    "producerUserId" TEXT NOT NULL,
    "venueUserId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direct_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_conversation_read" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_conversation_read_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direct_conversation_producerUserId_venueUserId_key" ON "direct_conversation"("producerUserId", "venueUserId");

-- CreateIndex
CREATE INDEX "direct_message_conversationId_createdAt_idx" ON "direct_message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "direct_conversation_read_conversationId_userId_key" ON "direct_conversation_read"("conversationId", "userId");

-- AddForeignKey
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "direct_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_conversation_read" ADD CONSTRAINT "direct_conversation_read_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "direct_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
