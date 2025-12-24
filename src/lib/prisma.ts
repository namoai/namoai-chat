// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * グローバルキャッシュ（開発環境のHot Reload対策）
 */
declare global {
  var __prisma: PrismaClient | undefined;
  var __dbUrl: string | undefined;
}

/**
 * 実行時またはビルド時に DB URL を取得
 * 環境別のDATABASE_URLをサポート（後方互換性を維持）
 * 
 * 優先順位:
 * 1. 環境別URL (STAGING_DATABASE_URL, IT_DATABASE_URL) - APP_ENVに基づく
 * 2. DATABASE_URL (既存コードとの互換性のため)
 * 3. グローバルキャッシュ
 * 
 * Supports environment-specific DATABASE_URL (maintains backward compatibility)
 * Priority:
 * 1. Environment-specific URL (STAGING_DATABASE_URL, IT_DATABASE_URL) - based on APP_ENV
 * 2. DATABASE_URL (for compatibility with existing code)
 * 3. Global cache
 */
async function resolveDatabaseUrl(): Promise<string> {
  // 環境タイプを取得（環境変数から）
  // Get environment type (from environment variable)
  const appEnv = process.env.APP_ENV?.toLowerCase();
  
  // 環境別のDATABASE_URLを優先的に使用（設定されている場合）
  // Use environment-specific DATABASE_URL if available
  // 注意: IT環境ではSTAGING_DATABASE_URLは使用されません（明示的に無視）
  // Note: STAGING_DATABASE_URL is not used in IT environment (explicitly ignored)
  let databaseUrl: string | undefined;
  
  if (appEnv === 'staging' && process.env.STAGING_DATABASE_URL) {
    databaseUrl = process.env.STAGING_DATABASE_URL;
    console.log('[Prisma] Using STAGING_DATABASE_URL for staging environment');
  } else if (appEnv === 'integration') {
    // IT環境ではSTAGING_DATABASE_URLを明示的に無視し、IT_DATABASE_URLのみ使用
    // In IT environment, explicitly ignore STAGING_DATABASE_URL and use only IT_DATABASE_URL
    if (process.env.IT_DATABASE_URL) {
      databaseUrl = process.env.IT_DATABASE_URL;
      console.log('[Prisma] Using IT_DATABASE_URL for integration environment (STAGING_DATABASE_URL ignored)');
    } else if (process.env.DATABASE_URL) {
      databaseUrl = process.env.DATABASE_URL;
      console.log('[Prisma] Using DATABASE_URL for integration environment (STAGING_DATABASE_URL ignored)');
    }
  } else if (process.env.DATABASE_URL) {
    // 既存コードとの互換性: DATABASE_URLをフォールバックとして使用
    // Backward compatibility: Use DATABASE_URL as fallback
    databaseUrl = process.env.DATABASE_URL;
    console.log('[Prisma] Using DATABASE_URL (fallback for compatibility)');
  }
  
  console.log('[Prisma] Resolving DATABASE_URL:', {
    appEnv,
    hasStagingUrl: !!process.env.STAGING_DATABASE_URL,
    hasItUrl: !!process.env.IT_DATABASE_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasGlobalCache: !!global.__dbUrl,
    NODE_ENV: process.env.NODE_ENV,
    selectedUrl: databaseUrl ? 'selected' : 'none',
  });
  
  if (databaseUrl) {
    const processedUrl = ensurePreparedStatementsDisabled(databaseUrl);
    console.log('[Prisma] After ensurePreparedStatementsDisabled, URL has prepared_statements:', processedUrl.includes('prepared_statements='));
    return processedUrl;
  }
  
  if (global.__dbUrl) {
    console.log('[Prisma] Using DATABASE_URL from global cache');
    const processedUrl = ensurePreparedStatementsDisabled(global.__dbUrl);
    console.log('[Prisma] After ensurePreparedStatementsDisabled, URL has prepared_statements:', processedUrl.includes('prepared_statements='));
    return processedUrl;
  }

  // DATABASE_URL が設定されていない場合はエラー
  // Error if DATABASE_URL is not set
  console.error('[Prisma] DATABASE_URL environment variable is required');
  throw new Error(
    "DATABASE_URL 環境変数が設定されていません。AWS Amplify環境変数に DATABASE_URL を設定してください。" +
    (appEnv ? ` (現在の環境: ${appEnv})` : '')
  );
}

/**
 * RDS/AWS環境での接続設定を追加
 * RDSを使用する場合、SSL接続を推奨（必要に応じて設定を追加）
 */
function ensurePreparedStatementsDisabled(url: string): string {
  console.log('[Prisma] ensurePreparedStatementsDisabled called');
  console.log('[Prisma] Input URL preview:', url.substring(0, 100) + '...');
  
  // 既にprepared_statementsパラメータがあればそのまま返す
  if (url.includes('prepared_statements=')) {
    console.log('[Prisma] ✅ prepared_statements parameter already exists in URL');
    return url;
  }
  
  // RDSを使用しているか確認（.rds.amazonaws.comドメイン）
  const isRDS = url.includes('.rds.amazonaws.com');
  
  // Connection Poolingを使用しているか確認（ポート6543またはpgbouncer=true）
  const isConnectionPooling = url.includes(':6543') || url.includes('pgbouncer=true');
  
  console.log('[Prisma] Checking database connection:', {
    urlPreview: url.substring(0, 100) + '...',
    isRDS,
    hasPort6543: url.includes(':6543'),
    hasPort5432: url.includes(':5432'),
    hasPgbouncer: url.includes('pgbouncer=true'),
    isConnectionPooling,
  });
  
  // RDSの場合はSSL接続を推奨（必要に応じて設定）
  // Connection Poolingを使用する場合、設定を追加
  if (isConnectionPooling) {
    let newUrl = url;
    const separator = newUrl.includes('?') ? '&' : '?';
    
    // Session modeを使用（Prismaは書き込み作業が必要なためSession mode必須）
    if (!newUrl.includes('pgbouncer=')) {
      newUrl = `${newUrl}${separator}pgbouncer=true`;
      console.log('[Prisma] Added pgbouncer=true (Session mode)');
    }
    
    // Session modeでもprepared_statementsの問題が発生する可能性があるため無効化
    const nextSeparator = newUrl.includes('?') ? '&' : '?';
    newUrl = `${newUrl}${nextSeparator}prepared_statements=false`;
    console.log('[Prisma] ✅ Added prepared_statements=false for Session mode');
    return newUrl;
  }
  
  // RDSの場合はそのまま返す（必要に応じてSSL設定を追加可能）
  if (isRDS) {
    console.log('[Prisma] ✅ RDS connection detected, using URL as-is');
    // RDSでSSLが必要な場合は、URLに ?sslmode=require を追加できます
    // 現在のURLをそのまま返します
    return url;
  }
  
  console.log('[Prisma] ⚠️ Standard PostgreSQL connection, no modifications');
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

  // Connection pool 설정을 URL에 추가
  // Connection pool settings to prevent "too many connections" errors
  let finalUrl = url;
  const separator = finalUrl.includes('?') ? '&' : '?';
  
  // 서버리스 환경(Lambda)에서는 연결 풀 크기를 제한
  // Limit connection pool size in serverless environments (Lambda)
  const isServerless = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.VERCEL ||
    process.env.NETLIFY
  );
  
  // Connection limit 설정 (기본값: 서버리스 5, 일반 10)
  // Connection limit setting (default: serverless 5, normal 10)
  const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT 
    ? parseInt(process.env.PRISMA_CONNECTION_LIMIT, 10)
    : (isServerless ? 5 : 10);
  
  // Pool timeout 설정 (초 단위, 기본값: 10초)
  // Pool timeout setting (in seconds, default: 10 seconds)
  const poolTimeout = process.env.PRISMA_POOL_TIMEOUT
    ? parseInt(process.env.PRISMA_POOL_TIMEOUT, 10)
    : 10;
  
  // URL에 connection_limit이 없으면 추가
  // Add connection_limit to URL if not present
  if (!finalUrl.includes('connection_limit=')) {
    finalUrl = `${finalUrl}${separator}connection_limit=${connectionLimit}`;
    console.log(`[Prisma] Added connection_limit=${connectionLimit} to URL`);
  }
  
  // URL에 pool_timeout이 없으면 추가
  // Add pool_timeout to URL if not present
  if (!finalUrl.includes('pool_timeout=')) {
    const nextSeparator = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${nextSeparator}pool_timeout=${poolTimeout}`;
    console.log(`[Prisma] Added pool_timeout=${poolTimeout} to URL`);
  }

  const instance = new PrismaClient({
    datasourceUrl: finalUrl,
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
    
    // "Too many database connections" エラーの場合、特別な処理
    // Special handling for "Too many database connections" errors
    const isTooManyConnectionsError = connectError instanceof Error &&
        (connectError.message.includes('Too many database connections') ||
         connectError.message.includes('remaining connection slots are reserved') ||
         connectError.message.includes('FATAL: remaining connection slots'));
    
    if (connectError instanceof Error && 
        (isP1001Error || 
         connectError.message.includes("Can't reach database server"))) {
      const dbUrl = url.includes('@') ? url.split('@')[1] : url;
      console.error('[Prisma] ⚠️ Connection failed to:', dbUrl);
      console.error('[Prisma] 💡 Recommendation: Use Connection Pooling (port 6543) instead of direct connection (port 5432)');
    }
    
    if (isTooManyConnectionsError) {
      console.error('[Prisma] ❌ Too many database connections error detected!');
      console.error('[Prisma] 💡 Solutions:');
      console.error('[Prisma]   1. Use Prisma Accelerate: https://pris.ly/client/error-accelerate');
      console.error('[Prisma]   2. Use RDS Proxy for connection pooling');
      console.error('[Prisma]   3. Reduce connection_limit in DATABASE_URL (currently set to ' + connectionLimit + ')');
      console.error('[Prisma]   4. Restart RDS instance to clear zombie connections');
      console.error('[Prisma]   5. Check for connection leaks in your code (ensure $disconnect() is called)');
    }
    
    await instance.$disconnect().catch(() => {}); // エラーを無視
    throw connectError;
  }

  // 프로덕션 환경에서도 싱글톤 패턴 유지 (서버리스 환경에서 연결 누수 방지)
  // Maintain singleton pattern in production (prevent connection leaks in serverless environments)
  // 단, Lambda 환경에서는 각 실행 컨텍스트마다 새로운 인스턴스가 생성될 수 있으므로
  // global 캐시는 도움이 되지만 완전한 해결책은 아닙니다.
  // However, in Lambda environments, a new instance may be created for each execution context,
  // so global cache helps but is not a complete solution.
  global.__prisma = instance;
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
  // AWS Lambda 환경 감지
  const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );
  
  // Lambda 환경에서는 빌드 타임이 아님 (런타임)
  if (isLambda) {
    return false;
  }
  
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
