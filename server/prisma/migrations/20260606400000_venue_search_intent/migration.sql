-- AlterTable
ALTER TABLE "venue_profile" ADD COLUMN "productsNeeded" TEXT NOT NULL DEFAULT '';
ALTER TABLE "venue_profile" ADD COLUMN "supplyFrequency" TEXT NOT NULL DEFAULT '';
ALTER TABLE "venue_profile" ADD COLUMN "preferredDays" TEXT NOT NULL DEFAULT '';
ALTER TABLE "venue_profile" ADD COLUMN "needsUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "venue_search_history" (
    "id" TEXT NOT NULL,
    "venueUserId" TEXT NOT NULL,
    "productsNeeded" TEXT NOT NULL DEFAULT '',
    "supplyFrequency" TEXT NOT NULL DEFAULT '',
    "preferredDays" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_search_history_venueUserId_createdAt_idx" ON "venue_search_history"("venueUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "venue_search_history" ADD CONSTRAINT "venue_search_history_venueUserId_fkey" FOREIGN KEY ("venueUserId") REFERENCES "venue_profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
