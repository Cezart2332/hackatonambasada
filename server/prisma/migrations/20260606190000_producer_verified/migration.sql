-- Curated "Verificat" badge — separate from approval status
ALTER TABLE "producer_profile" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
