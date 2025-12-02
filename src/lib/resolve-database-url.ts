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
  
  // 環境別のDATABASE_URLを優先的に使用（設定されている場合）
  // Use environment-specific DATABASE_URL if available
  if (appEnv === 'staging' && process.env.STAGING_DATABASE_URL) {
    return process.env.STAGING_DATABASE_URL;
  }
  
  if (appEnv === 'integration' && process.env.IT_DATABASE_URL) {
    return process.env.IT_DATABASE_URL;
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

