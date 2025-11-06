-- Fix vector indexes: Remove btree indexes and create proper ivfflat indexes
-- This fixes the error: "index row size exceeds btree version 4 maximum"

-- Drop existing btree indexes (if they exist)
DROP INDEX IF EXISTS "chat_message_embedding_idx";
DROP INDEX IF EXISTS "chat_backMemoryEmbedding_idx";
DROP INDEX IF EXISTS "detailed_memories_embedding_idx";

-- Create proper ivfflat indexes for vectors
-- Note: ivfflat indexes require the vector extension and work better with large vectors
CREATE INDEX IF NOT EXISTS "chat_message_embedding_idx" 
  ON "chat_message" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS "chat_backMemoryEmbedding_idx" 
  ON "chat" USING ivfflat ("backMemoryEmbedding" vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX IF NOT EXISTS "detailed_memories_embedding_idx" 
  ON "detailed_memories" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);

