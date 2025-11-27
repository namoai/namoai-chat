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
    const fs = await import("fs/promises");
    const path = await import("path");
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
    const processedUrl = ensurePreparedStatementsDisabled(process.env.DATABASE_URL);
    console.log('[Prisma] After ensurePreparedStatementsDisabled, URL has prepared_statements:', processedUrl.includes('prepared_statements='));
    return processedUrl;
  }
  if (global.__dbUrl) {
    console.log('[Prisma] Using DATABASE_URL from global cache');
    const processedUrl = ensurePreparedStatementsDisabled(global.__dbUrl);
    console.log('[Prisma] After ensurePreparedStatementsDisabled, URL has prepared_statements:', processedUrl.includes('prepared_statements='));
    return processedUrl;
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
 * Connection Poolingを使用する際にprepared statementsを無効化
 * Supabaseを使用する場合は常にprepared_statements=falseを追加（安全な方法）
 */
function ensurePreparedStatementsDisabled(url: string): string {
  console.log('[Prisma] ensurePreparedStatementsDisabled called');
  console.log('[Prisma] Input URL preview:', url.substring(0, 100) + '...');
  
  // 既にprepared_statementsパラメータがあればそのまま返す
  if (url.includes('prepared_statements=')) {
    console.log('[Prisma] ✅ prepared_statements parameter already exists in URL');
    return url;
  }
  
  // Supabaseを使用しているか確認（.supabase.coドメイン）
  const isSupabase = url.includes('.supabase.co');
  
  // Connection Poolingを使用しているか確認（ポート6543またはpgbouncer=true）
  const isConnectionPooling = url.includes(':6543') || url.includes('pgbouncer=true');
  
  console.log('[Prisma] Checking database connection:', {
    urlPreview: url.substring(0, 100) + '...',
    isSupabase,
    hasPort6543: url.includes(':6543'),
    hasPort5432: url.includes(':5432'),
    hasPgbouncer: url.includes('pgbouncer=true'),
    isConnectionPooling,
    willAddPreparedStatements: isSupabase || isConnectionPooling
  });
  
  // Supabaseを使用するかConnection Poolingを使用する場合、設定を追加
  if (isSupabase || isConnectionPooling) {
    let newUrl = url;
    const separator = newUrl.includes('?') ? '&' : '?';
    
    // Session modeを使用（Prismaは書き込み作業が必要なためSession mode必須）
    // Transaction modeは読み取り専用のため使用しない
    // pgbouncer=trueはSession modeを明示的に指定
    if (!newUrl.includes('pgbouncer=')) {
      newUrl = `${newUrl}${separator}pgbouncer=true`;
      console.log('[Prisma] Added pgbouncer=true (Session mode)');
    }
    
    // Session modeでもprepared_statementsの問題が発生する可能性があるため無効化
    // （Connection Pooling環境で安全に動作するように）
    const nextSeparator = newUrl.includes('?') ? '&' : '?';
    newUrl = `${newUrl}${nextSeparator}prepared_statements=false`;
    console.log('[Prisma] ✅ Added prepared_statements=false for Session mode');
    console.log('[Prisma] Modified URL preview:', newUrl.substring(0, 100) + '...');
    console.log('[Prisma] Modified URL has pgbouncer:', newUrl.includes('pgbouncer=true'));
    console.log('[Prisma] Modified URL has prepared_statements:', newUrl.includes('prepared_statements=false'));
    return newUrl;
  }
  
  console.log('[Prisma] ⚠️ Not Supabase or Connection Pooling, prepared_statements not modified');
  return url;
}

/**
 * PrismaClient を生成（開発はグローバルにキャッシュ）
 */
async function createPrisma(): Promise<PrismaClient> {
  const url = await resolveDatabaseUrl();
  
  // ▼▼▼【ローカル環境デバッグ】実際に使用中のDATABASE_URLログ出力 ▼▼▼
  if (process.env.NODE_ENV === "development") {
    console.log('[prisma] DATABASE_URL:', url.substring(0, 50) + '...');
    console.log('[prisma] DATABASE_URL from env:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  }
  // ▲▲▲

  // 既存インスタンスがあり同じURLを使用する場合、再利用
  if (global.__prisma) {
    const currentUrl = await resolveDatabaseUrl();
    if (currentUrl === url) {
      return global.__prisma;
    }
    // URLが変更された場合、既存インスタンスを終了
    await global.__prisma.$disconnect();
    global.__prisma = undefined;
  }

  console.log('[Prisma] Creating PrismaClient...');
  console.log('[Prisma] Final DATABASE_URL preview:', url.substring(0, 80) + '...');
  console.log('[Prisma] URL has prepared_statements:', url.includes('prepared_statements='));
  console.log('[Prisma] URL has port 6543:', url.includes(':6543'));
  console.log('[Prisma] URL has pgbouncer:', url.includes('pgbouncer='));

  const instance = new PrismaClient({
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // 接続テスト（サーバーレス環境で接続が実際に動作するか確認）
  try {
    console.log('[Prisma] Testing database connection...');
    // タイムアウト設定（5秒）
    const connectPromise = instance.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
    );
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('[Prisma] Database connection test successful');
  } catch (connectError) {
    console.error('[Prisma] Database connection test failed:', connectError);
    
    // P1001エラーの場合、Connection Poolingの使用を推奨
    const isP1001Error = connectError instanceof Error && 
        ('code' in connectError && connectError.code === 'P1001');
    
    if (connectError instanceof Error && 
        (isP1001Error || 
         connectError.message.includes("Can't reach database server"))) {
      const dbUrl = url.includes('@') ? url.split('@')[1] : url;
      console.error('[Prisma] ⚠️ Connection failed to:', dbUrl);
      console.error('[Prisma] 💡 Recommendation: Use Connection Pooling (port 6543) instead of direct connection (port 5432)');
      console.error('[Prisma] 💡 Get Connection Pooling URL from Supabase Dashboard → Settings → Database → Connection string → Connection pooling');
    }
    
    await instance.$disconnect().catch(() => {}); // エラーを無視
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
