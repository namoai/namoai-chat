// Fix vector indexes using Prisma
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixVectorIndexes() {
  try {
    console.log('既存のbtreeインデックスを削除中...');
    
    // Drop existing btree indexes
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "chat_message_embedding_idx"`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "chat_backMemoryEmbedding_idx"`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "detailed_memories_embedding_idx"`);
    
    console.log('ivfflatインデックスを作成中...');
    
    // Create proper ivfflat indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "chat_message_embedding_idx" 
      ON "chat_message" USING ivfflat ("embedding" vector_cosine_ops)
      WITH (lists = 100)
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "chat_backMemoryEmbedding_idx" 
      ON "chat" USING ivfflat ("backMemoryEmbedding" vector_cosine_ops)
      WITH (lists = 10)
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "detailed_memories_embedding_idx" 
      ON "detailed_memories" USING ivfflat ("embedding" vector_cosine_ops)
      WITH (lists = 10)
    `);
    
    console.log('✅ ベクトルインデックスの修正が完了しました');
  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixVectorIndexes();

