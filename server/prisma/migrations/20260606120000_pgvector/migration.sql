-- pgvector for future lead / producer similarity search (used by AI service)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "lead_embedding" (
    "lead_id" TEXT NOT NULL,
    "embedding" vector(1536),
    "model" TEXT NOT NULL DEFAULT 'openrouter',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_embedding_pkey" PRIMARY KEY ("lead_id"),
    CONSTRAINT "lead_embedding_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
