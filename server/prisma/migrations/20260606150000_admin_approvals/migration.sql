-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "producer_profile" ADD COLUMN "businessName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "producer_profile" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "producer_profile" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "venue_profile" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- Existing registrations before moderation go live stay usable
UPDATE "producer_profile" SET "approvalStatus" = 'APPROVED';
UPDATE "venue_profile" SET "approvalStatus" = 'APPROVED';
