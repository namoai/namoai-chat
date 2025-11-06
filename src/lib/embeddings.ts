import OpenAI from 'openai';

// OpenAIクライアントを遅延初期化
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openaiClient;
}

/**
 * テキストをベクトルに変換するヘルパー関数
 * @param text ベクトル化するテキスト
 * @returns テキストのベクトル表現
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) return [];
  const sanitizedText = text.replace(/\n/g, ' ').trim();
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: sanitizedText,
  });
  return response.data[0].embedding;
}

/**
 * ベクトルをPostgreSQL vector型文字列に変換
 * @param embedding ベクトル配列
 * @returns PostgreSQL vector型文字列
 */
export function embeddingToVectorString(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

