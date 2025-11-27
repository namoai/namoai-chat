import OpenAI from 'openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import crypto from 'crypto';

// OpenAIクライアントを遅延初期化
let openaiClient: OpenAI | null = null;

// ▼▼▼【性能向上】Embeddingキャッシュ（in-memory）
// テキストのハッシュをキーとしてembeddingをキャッシュ
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24時間（ミリ秒）
const MAX_CACHE_SIZE = 1000; // 最大キャッシュサイズ（メモリ保護）

/**
 * テキストのハッシュを計算
 */
function getTextHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * キャッシュから古いエントリを削除（LRU方式）
 */
function cleanupCache(): void {
  if (embeddingCache.size <= MAX_CACHE_SIZE) return;
  
  const entries = Array.from(embeddingCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp); // 古い順にソート
  
  // 最も古いエントリを削除（最大サイズの50%まで削減）
  const removeCount = Math.floor(MAX_CACHE_SIZE / 2);
  for (let i = 0; i < removeCount && i < entries.length; i++) {
    embeddingCache.delete(entries[i][0]);
  }
  
  console.log(`[embeddings] キャッシュクリーンアップ: ${embeddingCache.size}件のエントリを保持`);
}
// ▲▲▲

/**
 * GCP認証情報ファイルを設定
 */
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

  if (!jsonRaw && !jsonB64) return;

    const fs = await import('fs/promises');
    const path = await import('path');
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
  
  // ▼▼▼【修正】text-embedding-3-smallの最大トークン数(8192)を考慮してテキスト長を制限
  // 8192トークン ≈ 6000文字程度（安全マージン込み）
  const MAX_TEXT_LENGTH = 6000;
  const truncatedText = sanitizedText.length > MAX_TEXT_LENGTH 
    ? sanitizedText.substring(0, MAX_TEXT_LENGTH) 
    : sanitizedText;
  
  if (sanitizedText.length > MAX_TEXT_LENGTH) {
    console.warn(`[embeddings] テキストが長すぎるため切り詰めました: ${sanitizedText.length}文字 → ${truncatedText.length}文字`);
  }
  // ▲▲▲
  
  // ▼▼▼【性能向上】キャッシュから取得を試行
  const textHash = getTextHash(truncatedText);
  const cached = embeddingCache.get(textHash);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    // キャッシュヒット（ログは本番では削減可能）
    return cached.embedding;
  }
  // ▲▲▲
  
  // ▼▼▼【性能向上】キャッシュにない場合はAPI呼び出し
  const openai = await getOpenAIClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: truncatedText,
  });
  const embedding = response.data[0].embedding;
  
  // ▼▼▼【性能向上】キャッシュに保存
  // キャッシュサイズが上限に達した場合はクリーンアップ
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    cleanupCache();
  }
  
  embeddingCache.set(textHash, {
    embedding,
    timestamp: now,
  });
  // ▲▲▲
  
  return embedding;
}

/**
 * ベクトルをPostgreSQL vector型文字列に変換
 * @param embedding ベクトル配列
 * @returns PostgreSQL vector型文字列
 */
export function embeddingToVectorString(embedding: number[]): string {
  // PostgreSQL vector型は '[1,2,3]' 形式
  return `[${embedding.join(',')}]`;
}

/**
 * Prismaで使用可能なベクトル値を返す（SQLパラメータ用）
 */
export function embeddingToPrismaVector(embedding: number[]): string {
  // Prisma $executeRawで使用する際は文字列に変換
  return `[${embedding.join(',')}]::vector`;
}

