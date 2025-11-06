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
    // Note: ivfflat indexes can only be created on columns with data
    // We'll create indexes only if there are non-null vectors
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "chat_message_embedding_idx" 
        ON "chat_message" USING ivfflat ("embedding" vector_cosine_ops)
        WITH (lists = 100)
        WHERE "embedding" IS NOT NULL
      `);
      console.log('✅ chat_message_embedding_idx 作成完了');
    } catch (error) {
      console.warn('⚠️ chat_message_embedding_idx 作成スキップ:', error.message);
    }
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "chat_backMemoryEmbedding_idx" 
        ON "chat" USING ivfflat ("backMemoryEmbedding" vector_cosine_ops)
        WITH (lists = 10)
        WHERE "backMemoryEmbedding" IS NOT NULL
      `);
      console.log('✅ chat_backMemoryEmbedding_idx 作成完了');
    } catch (error) {
      console.warn('⚠️ chat_backMemoryEmbedding_idx 作成スキップ:', error.message);
    }
    
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "detailed_memories_embedding_idx" 
        ON "detailed_memories" USING ivfflat ("embedding" vector_cosine_ops)
        WITH (lists = 10)
        WHERE "embedding" IS NOT NULL
      `);
      console.log('✅ detailed_memories_embedding_idx 作成完了');
    } catch (error) {
      console.warn('⚠️ detailed_memories_embedding_idx 作成スキップ:', error.message);
    }
    
    console.log('✅ ベクトルインデックスの修正が完了しました');
  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixVectorIndexes();

