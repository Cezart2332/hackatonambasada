-- Runs once on first Postgres container start (pgvector image)
CREATE EXTENSION IF NOT EXISTS vector;
