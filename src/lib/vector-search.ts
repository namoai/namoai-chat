import { prisma } from './prisma';
import { embeddingToVectorString } from './embeddings';

/**
 * ベクトル類似度検索 (cosine distance使用)
 * @param queryEmbedding 検索するベクトル
 * @param table テーブル名
 * @param embeddingColumn embeddingカラム名
 * @param whereClause 追加WHERE条件
 * @param limit 結果数
 * @param similarityThreshold 類似度閾値 (0-1, 低いほど類似)
 * @returns 検索結果
 */
export async function vectorSimilaritySearch<T extends { id: number }>(
  queryEmbedding: number[],
  table: 'chat_message' | 'detailed_memories' | 'chat',
  embeddingColumn: 'embedding' | 'backMemoryEmbedding',
  whereClause: string = '',
  limit: number = 10,
  similarityThreshold: number = 0.3
): Promise<T[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const embeddingString = embeddingToVectorString(queryEmbedding);
  const similarityOperator = '<=';
  
  // WHERE句を構成
  const whereSQL = whereClause ? `WHERE ${whereClause} AND` : 'WHERE';
  
  // クエリ実行 (cosine distance使用)
  // pgvectorのcosine distanceは1 - cosine similarity
  // したがって小さいほど類似 (0 = 完全に類似, 2 = 反対)
  const query = `
    SELECT *, 
           1 - (${embeddingColumn} <=> ${embeddingString}::vector) as similarity
    FROM "${table}"
    ${whereSQL} ${embeddingColumn} IS NOT NULL
      AND (1 - (${embeddingColumn} <=> ${embeddingString}::vector)) >= ${1 - similarityThreshold}
    ORDER BY ${embeddingColumn} <=> ${embeddingString}::vector
    LIMIT ${limit}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<T[]>(query);
    return results;
  } catch (error) {
    console.error(`ベクトル検索エラー (${table}):`, error);
    return [];
  }
}

/**
 * チャットメッセージベクトル検索
 */
export async function searchSimilarMessages(
  queryEmbedding: number[],
  chatId: number,
  excludeTurnIds: number[] = [],
  limit: number = 10
): Promise<Array<{ id: number; content: string; role: string; createdAt: Date }>> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const embeddingString = embeddingToVectorString(queryEmbedding);
  const excludeClause = excludeTurnIds.length > 0 
    ? `"chatId" = ${chatId} AND "isActive" = true AND "turnId" NOT IN (${excludeTurnIds.join(',')})`
    : `"chatId" = ${chatId} AND "isActive" = true`;
  
  const query = `
    SELECT "id", "content", "role", "createdAt"
    FROM "chat_message"
    WHERE ${excludeClause}
      AND "embedding" IS NOT NULL
      AND (1 - ("embedding" <=> ${embeddingString}::vector)) >= 0.7
    ORDER BY "embedding" <=> ${embeddingString}::vector
    LIMIT ${limit}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<{ id: number; content: string; role: string; createdAt: Date }>>(query);
    return results;
  } catch (error) {
    console.error('メッセージベクトル検索エラー:', error);
    return [];
  }
}

/**
 * 詳細記憶ベクトル検索
 */
export async function searchSimilarDetailedMemories(
  queryEmbedding: number[],
  chatId: number,
  limit: number = 3
): Promise<Array<{ id: number; content: string; keywords: string[]; similarity: number }>> {
  return vectorSimilaritySearch(
    queryEmbedding,
    'detailed_memories',
    'embedding',
    `"chatId" = ${chatId}`,
    limit,
    0.2 // 20%以上類似したメモリのみ (より厳格)
  ) as Promise<Array<{ id: number; content: string; keywords: string[]; similarity: number }>>;
}

