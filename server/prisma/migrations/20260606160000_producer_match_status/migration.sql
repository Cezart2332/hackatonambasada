-- CreateTable
CREATE TABLE "producer_match_status_record" (
    "id" TEXT NOT NULL,
    "producerUserId" TEXT NOT NULL,
    "venueUserId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producer_match_status_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "producer_match_status_record_producerUserId_venueUserId_key" ON "producer_match_status_record"("producerUserId", "venueUserId");

-- AddForeignKey
ALTER TABLE "producer_match_status_record" ADD CONSTRAINT "producer_match_status_record_venueUserId_fkey" FOREIGN KEY ("venueUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
