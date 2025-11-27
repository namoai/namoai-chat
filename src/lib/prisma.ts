// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

/**
 * グローバルキャッシュ（開発環境のHot Reload対策）
 */
declare global {
  var __prisma: PrismaClient | undefined;
  var __dbUrl: string | undefined;
}

/**
 * サービスアカウントJSONを /tmp に展開して ADC を設定
 * - GOOGLE_APPLICATION_CREDENTIALS が既にあれば何もしない
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON（平文） or
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64（Base64）をサポート
 */
async function ensureGcpCredsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

  if (!jsonRaw && !jsonB64) return;

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const credPath = path.join("/tmp", "gcp-sa.json");
  const json = jsonRaw ?? Buffer.from(jsonB64!, "base64").toString("utf8");
  await fs.writeFile(credPath, json, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

/**
 * Secret Manager のリソース名を構築
 * - 画面のシークレット命名に合わせて、IDは常に "DATABASE_URL" を使用
 * - projects/{GOOGLE_PROJECT_ID}/secrets/DATABASE_URL/versions/latest
 */
function buildDatabaseUrlSecretName(): string | undefined {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) return undefined;
  return `projects/${projectId}/secrets/DATABASE_URL/versions/latest`;
}

/**
 * 実行時またはビルド時に DB URL を取得
 * 1) ENV: DATABASE_URL（存在すれば最優先で使用）
 * 2) GSM: projects/{GOOGLE_PROJECT_ID}/secrets/DATABASE_URL/versions/latest から取得
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  // Secret Manager を使うためのADC設定
  await ensureGcpCredsFile();

  const name = buildDatabaseUrlSecretName();
  if (!name) {
    throw new Error(
      "GOOGLE_PROJECT_ID が未設定です。ENVの DATABASE_URL を直接設定するか、GOOGLE_PROJECT_ID とサービスアカウントJSONを設定してください。"
    );
  }

  const client = new SecretManagerServiceClient({ fallback: true }); // gRPC→RESTフォールバックで安定化
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload)
    throw new Error("GSM: DATABASE_URL シークレットのpayloadが空です。");

  global.__dbUrl = payload;
  return payload;
}

/**
 * PrismaClient を生成（開発はグローバルにキャッシュ）
 */
async function createPrisma(): Promise<PrismaClient> {
  const url = await resolveDatabaseUrl();
  
  // ▼▼▼【로컬 환경 디버깅】실제 사용 중인 DATABASE_URL 로그 출력 ▼▼▼
  if (process.env.NODE_ENV === "development") {
    console.log('[prisma] DATABASE_URL:', url.substring(0, 50) + '...');
    console.log('[prisma] DATABASE_URL from env:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  }
  // ▲▲▲

  // 기존 인스턴스가 있고 같은 URL을 사용하는 경우 재사용
  if (global.__prisma) {
    const currentUrl = await resolveDatabaseUrl();
    if (currentUrl === url) {
      return global.__prisma;
    }
    // URL이 변경된 경우 기존 인스턴스 종료
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
  }

  const instance = new PrismaClient({
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    global.__prisma = instance;
  }
  return instance;
}

/**
 * PrismaClient の遅延初期化
 * - Netlify Functions での初期化エラーを防ぐため、最上位レベルの await を避ける
 */
let prismaInstance: PrismaClient | null = null;
let initPromise: Promise<PrismaClient> | null = null;

async function initializePrisma(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = createPrisma().then(instance => {
    prismaInstance = instance;
    if (process.env.NODE_ENV !== "production") {
      global.__prisma = instance;
    }
    initPromise = null;
    return instance;
  }).catch(error => {
    initPromise = null;
    console.error('[Prisma] Initialization failed:', error);
    throw error;
  });
  
  return initPromise;
}

// 非ブロッキング初期化を試みる
let _prisma: PrismaClient | null = null;
initializePrisma().then(instance => {
  _prisma = instance;
}).catch(error => {
  console.error('[Prisma] Top-level initialization failed, will retry on first use:', error);
});

/**
 * 互換エクスポート:
 * - 既存コードの `import { prisma } from "@/lib/prisma"` をそのまま利用可能
 * - 初回使用時に初期化される（遅延初期化）
 * 
 * 注意: この実装では、prisma オブジェクトへの直接アクセスは
 * 初期化が完了するまでエラーになる可能性があります。
 * 安全に使用するには、getPrisma() を使用してください。
 */
export const prisma = _prisma || ({} as PrismaClient);

export async function getPrisma(): Promise<PrismaClient> {
  if (_prisma) return _prisma;
  return initializePrisma();
}
