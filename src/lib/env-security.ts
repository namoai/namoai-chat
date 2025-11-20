/**
 * セキュリティ強化: 環境変数のセキュリティ向上
 * 環境変数の暗号化・安全管理、アクセス権限の最小化
 */

import { logger } from './logger';

/**
 * 必須環境変数のチェック
 */
export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const error = new Error(
      `必須の環境変数が設定されていません: ${missing.join(', ')}`
    );
    logger.critical('Missing required environment variables', {
      metadata: { missing },
    });
    throw error;
  }
}

/**
 * 環境変数の値を安全に取得（ログに記録しない）
 */
export function getSecureEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }

  // 機密情報がログに記録されないように注意
  return value;
}

/**
 * 環境変数が本番環境で適切に設定されているかチェック
 */
export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return; // 開発環境ではスキップ
  }

  const criticalVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_SECRET',
  ];

  const warnings: string[] = [];

  for (const varName of criticalVars) {
    const value = process.env[varName];
    
    // デフォルト値や弱い値のチェック
    if (!value || value === 'default-secret-change-in-production' || value.length < 32) {
      warnings.push(varName);
    }
  }

  if (warnings.length > 0) {
    logger.warn('Weak environment variables detected in production', {
      metadata: { weakVars: warnings },
    });
  }
}

/**
 * 環境変数のアクセス権限をチェック（読み取り専用）
 */
export class SecureEnv {
  private static cache: Map<string, string> = new Map();

  /**
   * 環境変数を安全に取得（キャッシュ付き）
   */
  static get(name: string, defaultValue?: string): string {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const value = getSecureEnvVar(name, defaultValue);
    this.cache.set(name, value);
    return value;
  }

  /**
   * キャッシュをクリア（テスト用）
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * 機密情報をマスクしてログ出力
   */
  static maskForLogging(value: string, showLength = 4): string {
    if (value.length <= showLength * 2) {
      return '***';
    }
    return `${value.substring(0, showLength)}...${value.substring(value.length - showLength)}`;
  }
}

/**
 * 起動時に環境変数を検証
 * AWS Amplify対応: GSMから環境変数をロードしてから検証
 */
export async function initializeEnvSecurity(): Promise<void> {
  try {
    // ▼▼▼【AWS Amplify対応】GSMから環境変数をロード ▼▼▼
    // サーバ環境でのみ実行（クライアントバンドルから除外）
    if (typeof window !== 'undefined') {
      // クライアントサイドでは実行しない
      return;
    }

    try {
      // ensureGcpCredsをロード（utilsから）
      const { ensureGcpCreds } = await import('../utils/ensureGcpCreds');
      await ensureGcpCreds();

      // DATABASE_URLをロード
      if (!process.env.DATABASE_URL) {
        try {
          // 動的importでサーバ専用パッケージをロード
          const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
          const projectId = process.env.GOOGLE_PROJECT_ID;
          if (projectId) {
            const client = new SecretManagerServiceClient({ fallback: true });
            const [version] = await client.accessSecretVersion({
              name: `projects/${projectId}/secrets/DATABASE_URL/versions/latest`
            });
            const payload = version.payload?.data?.toString();
            if (payload) {
              process.env.DATABASE_URL = payload.trim();
              console.log('[initializeEnvSecurity] DATABASE_URL loaded from GSM');
            }
          }
        } catch (e) {
          console.warn('[initializeEnvSecurity] Failed to load DATABASE_URL from GSM:', e);
        }
      }

      // NEXTAUTH_SECRETをロード
      if (!process.env.NEXTAUTH_SECRET) {
        try {
          // 動的importでサーバ専用パッケージをロード
          const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
          const projectId = process.env.GOOGLE_PROJECT_ID;
          if (projectId) {
            const client = new SecretManagerServiceClient({ fallback: true });
            const [version] = await client.accessSecretVersion({
              name: `projects/${projectId}/secrets/NEXTAUTH_SECRET/versions/latest`
            });
            const payload = version.payload?.data?.toString();
            if (payload) {
              process.env.NEXTAUTH_SECRET = payload.trim();
              console.log('[initializeEnvSecurity] NEXTAUTH_SECRET loaded from GSM');
            }
          }
        } catch (e) {
          console.warn('[initializeEnvSecurity] Failed to load NEXTAUTH_SECRET from GSM:', e);
        }
      }
    } catch (error) {
      // GSMロード失敗は警告のみ（環境変数があればOK）
      console.warn('[initializeEnvSecurity] GSM access failed, checking environment variables:', error);
    }
    // ▲▲▲

    validateProductionEnv();
    
    // 必須環境変数のチェック（アプリケーション固有）
    // ▼▼▼【AWS Amplify対応】GSMロード後にも環境変数がない場合のみエラー ▼▼▼
    const requiredVars = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
    ];

    // 環境変数がない場合のみエラー（GSMからロード済みの可能性があるため）
    const missing: string[] = [];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      const error = new Error(
        `必須の環境変数が設定されていません: ${missing.join(', ')}`
      );
      logger.critical('Missing required environment variables', {
        metadata: { missing },
      });
      throw error;
    }
    // ▲▲▲
    
    logger.info('Environment variables validated successfully');
  } catch (error) {
    logger.critical('Environment validation failed', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
      } : { message: String(error) },
    });
    throw error;
  }
}
