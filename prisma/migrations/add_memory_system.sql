-- Migration: Add memory system fields
-- This migration adds backMemory, autoSummarize, and embedding fields to support the memory system

-- Add columns to chat table
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "backMemory" TEXT;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "backMemoryEmbedding" vector;
ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS "autoSummarize" BOOLEAN DEFAULT true;

-- Create index for backMemoryEmbedding
CREATE INDEX IF NOT EXISTS "chat_backMemoryEmbedding_idx" ON "chat" USING ivfflat ("backMemoryEmbedding" vector_cosine_ops);

-- Add embedding column to chat_message table
ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "embedding" vector;

-- Create index for chat_message embedding
CREATE INDEX IF NOT EXISTS "chat_message_embedding_idx" ON "chat_message" USING ivfflat ("embedding" vector_cosine_ops);

-- Create detailed_memories table
CREATE TABLE IF NOT EXISTS "detailed_memories" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[],
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastApplied" TIMESTAMP(3),

    CONSTRAINT "detailed_memories_pkey" PRIMARY KEY ("id")
);

-- Create foreign key constraint
ALTER TABLE "detailed_memories" ADD CONSTRAINT "detailed_memories_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for detailed_memories
CREATE INDEX IF NOT EXISTS "detailed_memories_chatId_createdAt_idx" ON "detailed_memories"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "detailed_memories_embedding_idx" ON "detailed_memories" USING ivfflat ("embedding" vector_cosine_ops);

