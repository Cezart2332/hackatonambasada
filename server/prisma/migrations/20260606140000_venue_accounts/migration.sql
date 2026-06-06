-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PRODUCER', 'VENUE');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'PRODUCER';

-- CreateTable
CREATE TABLE "venue_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "venueType" "LeadIcon" NOT NULL DEFAULT 'restaurant',
    "phone" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "locationChoice" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "productsNeeded" TEXT NOT NULL DEFAULT '',
    "supplyFrequency" TEXT NOT NULL DEFAULT '',
    "preferredDays" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venue_profile_userId_key" ON "venue_profile"("userId");

-- AddForeignKey
ALTER TABLE "venue_profile" ADD CONSTRAINT "venue_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
