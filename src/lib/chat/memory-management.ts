/**
 * Detailed memory management functionality
 * Create and manage detailed memories from summaries
 */

import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/embeddings";

const MAX_MEMORY_LENGTH = 2000;

/**
 * Create detailed memories from summary (with splitting support)
 * @param chatId Chat ID
 * @param summary Summary text
 * @param keywords Keywords array
 * @param messageStartIndex Message start index
 * @param messageEndIndex Message end index
 */
export async function createDetailedMemories(
  chatId: number,
  summary: string,
  keywords: string[],
  messageStartIndex: number,
  messageEndIndex: number
): Promise<void> {
  if (summary.length > MAX_MEMORY_LENGTH) {
    // Split if over 2000 characters
    let remainingSummary = summary;
    
    while (remainingSummary.length > 0) {
      const memoryContent = remainingSummary.substring(0, MAX_MEMORY_LENGTH);
      remainingSummary = remainingSummary.substring(MAX_MEMORY_LENGTH);
      
      // Add message range info as metadata in keywords (format: __META:start:1:end:5__)
      const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
      
      const newMemory = await prisma.detailed_memories.create({
        data: {
          chatId,
          content: memoryContent,
          keywords: metaKeywords,
        },
      });
      
      // Generate embedding asynchronously
      (async () => {
        try {
          const embedding = await getEmbedding(memoryContent);
          const embeddingString = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
            embeddingString,
            newMemory.id
          );
        } catch (error) {
          console.error('Detailed memory embedding generation error:', error);
        }
      })();
      
      // Exit if remaining is 2000 characters or less
      if (remainingSummary.length <= MAX_MEMORY_LENGTH) {
        if (remainingSummary.length > 0) {
          const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
          await prisma.detailed_memories.create({
            data: {
              chatId,
              content: remainingSummary,
              keywords: metaKeywords,
            },
          });
        }
        break;
      }
    }
  } else {
    // Save as single memory if 2000 characters or less
    const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
    
    const newMemory = await prisma.detailed_memories.create({
      data: {
        chatId,
        content: summary,
        keywords: metaKeywords,
      },
    });
    
    // Generate embedding asynchronously
    (async () => {
      try {
        const embedding = await getEmbedding(summary);
        const embeddingString = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
          embeddingString,
          newMemory.id
        );
      } catch (error) {
        console.error('Detailed memory embedding generation error:', error);
      }
    })();
  }
}

