import { prisma } from './prisma';

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

  // テーブル名とカラム名の検証（SQL Injection防止）
  const validTables = ['chat_message', 'detailed_memories', 'chat'];
  const validColumns = ['embedding', 'backMemoryEmbedding'];
  if (!validTables.includes(table) || !validColumns.includes(embeddingColumn)) {
    throw new Error('Invalid table or column name');
  }

  // PostgreSQL vector型の形式に変換（文字列として）
  const vectorString = `[${queryEmbedding.join(',')}]`;
  
  // WHERE句を構成（whereClauseは信頼できるソースからのみ使用）
  const whereSQL = whereClause ? `WHERE ${whereClause} AND` : 'WHERE';
  
  // クエリ実行 (cosine distance使用)
  // pgvectorのcosine distanceは1 - cosine similarity
  // したがって小さいほど類似 (0 = 完全に類似, 2 = 反対)
  // ベクトル値を文字列で扱い、::vectorでキャスト
  const query = `
    SELECT *, 
           1 - ("${embeddingColumn}" <=> $1::vector) as similarity
    FROM "${table}"
    ${whereSQL} "${embeddingColumn}" IS NOT NULL
      AND (1 - ("${embeddingColumn}" <=> $1::vector)) >= ${1 - similarityThreshold}
    ORDER BY "${embeddingColumn}" <=> $1::vector
    LIMIT ${limit}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<T[]>(query, vectorString);
    return results;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`ベクトル検索エラー (${table}):`, error);
    }
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

  // SQL Injection防止: 数値のみ許可
  const safeChatId = Number.parseInt(String(chatId), 10);
  if (isNaN(safeChatId)) {
    return [];
  }
  const safeExcludeTurnIds = excludeTurnIds
    .map(id => Number.parseInt(String(id), 10))
    .filter(id => !isNaN(id));
  
  const excludeClause = safeExcludeTurnIds.length > 0 
    ? `"chatId" = ${safeChatId} AND "isActive" = true AND "turnId" NOT IN (${safeExcludeTurnIds.join(',')})`
    : `"chatId" = ${safeChatId} AND "isActive" = true`;
  
  // PostgreSQL vector型の形式に変換（文字列として）
  const vectorString = `[${queryEmbedding.join(',')}]`;
  
  const query = `
    SELECT "id", "content", "role", "createdAt"
    FROM "chat_message"
    WHERE ${excludeClause}
      AND "embedding" IS NOT NULL
      AND (1 - ("embedding" <=> $1::vector)) >= 0.7
    ORDER BY "embedding" <=> $1::vector
    LIMIT ${limit}
  `;

  try {
    const results = await prisma.$queryRawUnsafe<Array<{ id: number; content: string; role: string; createdAt: Date }>>(query, vectorString);
    return results;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('メッセージベクトル検索エラー:', error);
    }
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
  // SQL Injection防止: 数値のみ許可
  const safeChatId = Number.parseInt(String(chatId), 10);
  if (isNaN(safeChatId)) {
    return [];
  }
  
  return vectorSimilaritySearch(
    queryEmbedding,
    'detailed_memories',
    'embedding',
    `"chatId" = ${safeChatId}`,
    limit,
    0.2 // 20%以上類似したメモリのみ (より厳格)
  ) as Promise<Array<{ id: number; content: string; keywords: string[]; similarity: number }>>;
}
