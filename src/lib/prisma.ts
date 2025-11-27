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
  
  console.log('[Prisma] Resolving DATABASE_URL:', {
    hasEnvVar: !!process.env.DATABASE_URL,
    hasGlobalCache: !!global.__dbUrl,
    isBuildTime,
    NEXT_PHASE: process.env.NEXT_PHASE,
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY_FUNCTION: process.env.NETLIFY_FUNCTION
  });
  
  if (process.env.DATABASE_URL) {
    console.log('[Prisma] Using DATABASE_URL from environment variable');
    return ensurePreparedStatementsDisabled(process.env.DATABASE_URL);
  }
  if (global.__dbUrl) {
    console.log('[Prisma] Using DATABASE_URL from global cache');
    return ensurePreparedStatementsDisabled(global.__dbUrl);
  }

  // ビルド時には Secret Manager を呼び出さない
  if (isBuildTime) {
    console.error('[Prisma] Build time detected, DATABASE_URL required but not found');
    throw new Error(
      "ビルド時には DATABASE_URL 環境変数が必要です。Secret Manager は使用できません。"
    );
  }

  console.log('[Prisma] Attempting to fetch DATABASE_URL from Secret Manager...');
  
  // Secret Manager を使うためのADC設定
  await ensureGcpCredsFile();

  const name = buildDatabaseUrlSecretName();
  if (!name) {
    console.error('[Prisma] GOOGLE_PROJECT_ID not set');
    throw new Error(
      "GOOGLE_PROJECT_ID が未設定です。ENVの DATABASE_URL を直接設定するか、GOOGLE_PROJECT_ID とサービスアカウントJSONを設定してください。"
    );
  }

  console.log('[Prisma] Secret name:', name);

  // 動的にインポート（ビルド時の問題を回避）
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient({ fallback: true }); // gRPC→RESTフォールバックで安定化
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    console.error('[Prisma] Secret payload is empty');
    throw new Error("GSM: DATABASE_URL シークレットのpayloadが空です。");
  }

  console.log('[Prisma] Successfully fetched DATABASE_URL from Secret Manager');
  const finalUrl = ensurePreparedStatementsDisabled(payload);
  global.__dbUrl = finalUrl;
  return finalUrl;
}

/**
 * Connection Pooling을 사용할 때 prepared statements를 비활성화
 * Supabase Connection Pooling (포트 6543) 또는 pgbouncer를 사용하는 경우 필요
 */
function ensurePreparedStatementsDisabled(url: string): string {
  // 이미 prepared_statements 파라미터가 있으면 그대로 반환
  if (url.includes('prepared_statements=')) {
    return url;
  }
  
  // Connection Pooling을 사용하는지 확인 (포트 6543 또는 pgbouncer=true)
  const isConnectionPooling = url.includes(':6543') || url.includes('pgbouncer=true');
  
  if (isConnectionPooling) {
    // Connection Pooling을 사용하는 경우 prepared_statements=false 추가
    const separator = url.includes('?') ? '&' : '?';
    const newUrl = `${url}${separator}prepared_statements=false`;
    console.log('[Prisma] Added prepared_statements=false for Connection Pooling');
    return newUrl;
  }
  
  return url;
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

  console.log('[Prisma] Creating PrismaClient...');

  const instance = new PrismaClient({
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // 연결 테스트 (서버리스 환경에서 연결이 실제로 작동하는지 확인)
  try {
    console.log('[Prisma] Testing database connection...');
    // 타임아웃 설정 (5초)
    const connectPromise = instance.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('[Prisma] Database connection test successful');
  } catch (connectError) {
    console.error('[Prisma] Database connection test failed:', connectError);
    
    // P1001 에러인 경우 Connection Pooling 사용을 권장
    if (connectError instanceof Error && 
        (connectError as any).code === 'P1001' || 
        connectError.message.includes("Can't reach database server")) {
      const dbUrl = url.includes('@') ? url.split('@')[1] : url;
      console.error('[Prisma] ⚠️ Connection failed to:', dbUrl);
      console.error('[Prisma] 💡 Recommendation: Use Connection Pooling (port 6543) instead of direct connection (port 5432)');
      console.error('[Prisma] 💡 Get Connection Pooling URL from Supabase Dashboard → Settings → Database → Connection string → Connection pooling');
    }
    
    await instance.$disconnect().catch(() => {}); // 에러 무시
    throw connectError;
  }

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
  const buildTimeCheck = isBuildTime();
  if (buildTimeCheck) {
    console.error('[Prisma] Build time detected:', {
      NEXT_PHASE: process.env.NEXT_PHASE,
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY_FUNCTION: process.env.NETLIFY_FUNCTION,
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set'
    });
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
      console.log('[Prisma] Starting initialization...');
      prismaInstance = await createPrisma();
      initPromise = null;
      console.log('[Prisma] Initialization successful');
      return prismaInstance;
    } catch (error) {
      initError = error instanceof Error ? error : new Error(String(error));
      initPromise = null;
      console.error('[Prisma] Initialization failed:', error);
      if (error instanceof Error) {
        console.error('[Prisma] Error message:', error.message);
        console.error('[Prisma] Error stack:', error.stack);
      }
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
}) as PrismaClient;
