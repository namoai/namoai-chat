/**
 * 環境別のDATABASE_URLを解決するユーティリティ
 * 後方互換性を維持しながら環境別URLをサポート
 * 
 * Utility to resolve environment-specific DATABASE_URL
 * Supports environment-specific URLs while maintaining backward compatibility
 */

/**
 * 環境別のDATABASE_URLを取得
 * 優先順位:
 * 1. 環境別URL (STAGING_DATABASE_URL, IT_DATABASE_URL) - APP_ENVに基づく
 * 2. DATABASE_URL (既存コードとの互換性のため)
 * 
 * Get environment-specific DATABASE_URL
 * Priority:
 * 1. Environment-specific URL (STAGING_DATABASE_URL, IT_DATABASE_URL) - based on APP_ENV
 * 2. DATABASE_URL (for compatibility with existing code)
 */
export function resolveDatabaseUrlForPool(): string {
  const appEnv = process.env.APP_ENV?.toLowerCase();
  
  // IT環境ではSTAGING_DATABASE_URLを明示的に無視
  // Explicitly ignore STAGING_DATABASE_URL in IT environment
  if (appEnv === 'integration') {
    // IT環境ではIT_DATABASE_URLのみを使用
    // In IT environment, use only IT_DATABASE_URL
    if (process.env.IT_DATABASE_URL) {
      return process.env.IT_DATABASE_URL;
    }
    // IT_DATABASE_URLがなければDATABASE_URLを使用（STAGING_DATABASE_URLは使用しない）
    // If IT_DATABASE_URL is not set, use DATABASE_URL (don't use STAGING_DATABASE_URL)
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }
    throw new Error('IT環境ではIT_DATABASE_URLまたはDATABASE_URLが必要です。STAGING_DATABASE_URLは使用されません。');
  }
  
  // ステージング環境ではSTAGING_DATABASE_URLを使用
  // Use STAGING_DATABASE_URL in staging environment
  if (appEnv === 'staging' && process.env.STAGING_DATABASE_URL) {
    return process.env.STAGING_DATABASE_URL;
  }
  
  // 既存コードとの互換性: DATABASE_URLをフォールバックとして使用
  // Backward compatibility: Use DATABASE_URL as fallback
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  throw new Error(
    'DATABASE_URL環境変数が設定されていません。' +
    (appEnv ? ` (現在の環境: ${appEnv})` : '')
  );
}

