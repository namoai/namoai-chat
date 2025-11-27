// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
// SecretManagerServiceClientは動的にインポート（ビルド時の問題を回避）

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
 * - Edge Function では実行しない（Node.js runtime でのみ実行）
 */
async function ensureGcpCredsFile() {
  // Edge Function では実行しない（Node.js runtime でのみ実行）
  if (typeof process === 'undefined' || !process.versions?.node) {
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const jsonB64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;

  if (!jsonRaw && !jsonB64) return;

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const credPath = path.join("/tmp", "gcp-sa.json");
    const json = jsonRaw ?? Buffer.from(jsonB64!, "base64").toString("utf8");
    await fs.writeFile(credPath, json, "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  } catch (error) {
    // Edge Function では node:fs が使用できないため、エラーを無視
    if (error instanceof Error && (
      error.message.includes('require is not defined') ||
      error.message.includes('Cannot find module') ||
      error.name === 'ReferenceError'
    )) {
      console.warn('[Prisma] Skipping GCP creds file creation in Edge runtime');
      return;
    }
    throw error;
  }
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
 * 
 * ビルド時には Secret Manager を呼び出さない（環境変数からのみ取得）
 */
async function resolveDatabaseUrl(): Promise<string> {
  // ビルド時には環境変数からのみ取得（Secret Manager を呼び出さない）
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NODE_ENV === 'production' && !process.env.NETLIFY_FUNCTION;
  
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (global.__dbUrl) return global.__dbUrl;

  // ビルド時には Secret Manager を呼び出さない
  if (isBuildTime) {
    throw new Error(
      "ビルド時には DATABASE_URL 環境変数が必要です。Secret Manager は使用できません。"
    );
  }

  // Secret Manager を使うためのADC設定
  await ensureGcpCredsFile();

  const name = buildDatabaseUrlSecretName();
  if (!name) {
    throw new Error(
      "GOOGLE_PROJECT_ID が未設定です。ENVの DATABASE_URL を直接設定するか、GOOGLE_PROJECT_ID とサービスアカウントJSONを設定してください。"
    );
  }

  // 動的にインポート（ビルド時の問題を回避）
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
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
 * 互換エクスポート:
 * - 既存コードの `import { prisma } from "@/lib/prisma"` をそのまま利用可能
 * - 併用用に getPrisma も提供
 * - ビルド時には初期化をスキップ（環境変数 DATABASE_URL が 없으면エラーを避ける）
 */
let prismaInstance: PrismaClient | null = null;
let initError: Error | null = null;
let initPromise: Promise<PrismaClient> | null = null;

// ビルド時かどうかを判定する関数
function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || 
         (process.env.NODE_ENV === 'production' && !process.env.NETLIFY_FUNCTION && !process.env.DATABASE_URL);
}

// Lazy initialization: getPrisma()が最初に呼ばれたときだけ初期化
// Top-level awaitを避けるため、初期化はgetPrisma()内で行う
export async function getPrisma(): Promise<PrismaClient> {
  // ビルド時にはエラーをスロー
  if (isBuildTime()) {
    throw new Error('Prisma is not available during build time');
  }

  if (prismaInstance) {
    return prismaInstance;
  }
  
  // 既に初期化中の場合、そのPromiseを待つ
  if (initPromise) {
    return initPromise;
  }
  
  // 初期化に失敗していた場合は再試行
  if (initError) {
    console.log('[Prisma] Retrying initialization...');
    initError = null;
  }
  
  // 初期化を開始
  initPromise = (async () => {
    try {
      prismaInstance = await createPrisma();
      initPromise = null;
      return prismaInstance;
    } catch (error) {
      initError = error instanceof Error ? error : new Error(String(error));
      initPromise = null;
      console.error('[Prisma] Initialization failed:', error);
      throw error;
    }
  })();
  
  return initPromise;
}

// ビルド時用のダミーProxy（再帰的にダミーオブジェクトを返す）
function createDummyProxy(): unknown {
  return new Proxy({}, {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    get(_target: unknown, _prop: string | symbol) {
      // すべてのプロパティアクセスに対してダミー関数を返す
      return () => Promise.resolve(null);
    },
  });
}

// 互換性のため、prisma exportも提供（lazy getterとして実装）
// 注意: このexportはgetPrisma()を使用することを推奨
// ビルド時にはgetPrisma()を呼び出すようにラップ
export const prisma = new Proxy({} as unknown as PrismaClient, {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- _target is unused but required by Proxy handler signature
  get(_target: unknown, prop: string | symbol) {
    // ビルド時にはgetPrisma()を呼び出さない（エラーをスローしない）
    if (isBuildTime()) {
      // ビルド時には型チェックを通過させるため、ダミー関数を返す
      // ただし、実際の使用時にはgetPrisma()を使用する必要がある
      return createDummyProxy();
    }
    
    // ランタイムではgetPrisma()を使用して初期化
    // ただし、これは非同期なので、実際にはgetPrisma()を直接使用することを推奨
    if (!prismaInstance) {
      // 初期化されていない場合は、getPrisma()を使用するようにエラーをスロー
      throw new Error(
        `Prisma is not initialized. Call await getPrisma() first, or use getPrisma() directly. ` +
        `Attempted to access: ${String(prop)}`
      );
    }
    const value = (prismaInstance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(prismaInstance) : value;
  },
});
