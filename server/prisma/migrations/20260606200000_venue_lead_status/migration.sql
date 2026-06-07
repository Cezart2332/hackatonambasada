-- CreateTable
CREATE TABLE "venue_lead_status_record" (
    "id" TEXT NOT NULL,
    "producerUserId" TEXT NOT NULL,
    "venueUserId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_lead_status_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venue_lead_status_record_producerUserId_venueUserId_key" ON "venue_lead_status_record"("producerUserId", "venueUserId");

-- AddForeignKey
ALTER TABLE "venue_lead_status_record" ADD CONSTRAINT "venue_lead_status_record_venueUserId_fkey" FOREIGN KEY ("venueUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
