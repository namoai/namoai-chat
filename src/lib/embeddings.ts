import OpenAI from 'openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// OpenAIクライアントを遅延初期化
let openaiClient: OpenAI | null = null;

/**
 * GCP認証情報ファイルを設定
 */
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

  if (!jsonRaw && !jsonB64) return;

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const credPath = path.join('/tmp', 'gcp-sa.json');
  const json = jsonRaw ?? Buffer.from(jsonB64!, 'base64').toString('utf8');
  await fs.writeFile(credPath, json, 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

/**
 * Secret Managerからシークレットを取得
 */
async function loadSecret(name: string, version = 'latest'): Promise<string | null> {
  try {
    await ensureGcpCredsFile();
    const projectId = process.env.GOOGLE_PROJECT_ID;
    if (!projectId) {
      return null;
    }
    const client = new SecretManagerServiceClient({ fallback: true });
    const secretName = `projects/${projectId}/secrets/${name}/versions/${version}`;
    const [versionData] = await client.accessSecretVersion({ name: secretName });
    const payload = versionData.payload?.data?.toString();
    return payload?.trim() || null;
  } catch (error) {
    console.warn(`[embeddings] Failed to load secret ${name}:`, error);
    return null;
  }
}

/**
 * OpenAI APIキーを取得（Secret Manager優先、環境変数フォールバック）
 */
async function getOpenAIApiKey(): Promise<string> {
  // まず環境変数をチェック
  let apiKey = process.env.OPENAI_API_KEY;
  
  // 環境変数がない、または無効な場合はSecret Managerから取得を試行
  if (!apiKey || !apiKey.startsWith('sk-')) {
    try {
      const secretKey = await loadSecret('OPENAI_API_KEY');
      if (secretKey && secretKey.startsWith('sk-')) {
        apiKey = secretKey;
        console.log('[embeddings] OPENAI_API_KEY loaded from Secret Manager');
      }
    } catch (error) {
      console.warn('[embeddings] Failed to load OPENAI_API_KEY from Secret Manager:', error);
    }
  }
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  
  // APIキーから空白・改行・タブを削除
  const cleanedApiKey = apiKey
    .replace(/\s/g, '')
    .replace(/\\n|\\r|\\t/g, '');
  
  return cleanedApiKey;
}

async function getOpenAIClient(): Promise<OpenAI> {
  if (!openaiClient) {
    const cleanedApiKey = await getOpenAIApiKey();
    
    openaiClient = new OpenAI({
      apiKey: cleanedApiKey,
      baseURL: 'https://api.openai.com/v1', // ▼▼▼【重要】Netlify AI Gatewayをバイパスして直接OpenAI APIを呼び出す
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
  const openai = await getOpenAIClient();
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
  // PostgreSQL vector型は '[1,2,3]' 형식
  return `[${embedding.join(',')}]`;
}

/**
 * Prisma에서 사용할 수 있는 벡터 값을 반환 (SQL 파라미터용)
 */
export function embeddingToPrismaVector(embedding: number[]): string {
  // Prisma $executeRaw에서 사용할 때는 문자열로 변환
  return `[${embedding.join(',')}]::vector`;
}

