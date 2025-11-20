// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window === "undefined") {
    try {
      // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
      const mod = await import("./utils/ensureGcpCreds");
      await mod.ensureGcpCreds();
      
      // ▼▼▼【AWS Amplify対応】環境変数の検証（GSMからロード）▼▼▼
      // env-security.ts를 import하지 않고 직접 처리하여 클라이언트 번들에서 완전히 제외
      await validateEnvironmentVariables();
      // ▲▲▲
    } catch (error) {
      console.error("環境変数の検証に失敗しました:", error);
      // 本番環境では起動を停止することを推奨
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
}

/**
 * 環境変数の検証（サーバサイドでのみ実行）
 * GSMから環境変数をロードしてから検証
 */
async function validateEnvironmentVariables(): Promise<void> {
  try {
    // DATABASE_URLとNEXTAUTH_SECRETをGSMからロード（オプション）
    try {
      // 動的importでサーバ専用パッケージをロード
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      const projectId = process.env.GOOGLE_PROJECT_ID;
      
      if (projectId) {
        const client = new SecretManagerServiceClient({ fallback: true });
        
        // DATABASE_URLをロード
        if (!process.env.DATABASE_URL) {
          try {
            const [version] = await client.accessSecretVersion({
              name: `projects/${projectId}/secrets/DATABASE_URL/versions/latest`
            });
            const payload = version.payload?.data?.toString();
            if (payload) {
              process.env.DATABASE_URL = payload.trim();
              console.log('[validateEnvironmentVariables] DATABASE_URL loaded from GSM');
            }
          } catch (e) {
            console.warn('[validateEnvironmentVariables] Failed to load DATABASE_URL from GSM:', e);
          }
        }
        
        // NEXTAUTH_SECRETをロード
        if (!process.env.NEXTAUTH_SECRET) {
          try {
            const [version] = await client.accessSecretVersion({
              name: `projects/${projectId}/secrets/NEXTAUTH_SECRET/versions/latest`
            });
            const payload = version.payload?.data?.toString();
            if (payload) {
              process.env.NEXTAUTH_SECRET = payload.trim();
              console.log('[validateEnvironmentVariables] NEXTAUTH_SECRET loaded from GSM');
            }
          } catch (e) {
            console.warn('[validateEnvironmentVariables] Failed to load NEXTAUTH_SECRET from GSM:', e);
          }
        }
      }
    } catch (error) {
      // GSMロード失敗は警告のみ（環境変数があればOK）
      console.warn('[validateEnvironmentVariables] GSM access failed, checking environment variables:', error);
    }
    
    // 必須環境変数のチェック
    const requiredVars = ['NEXTAUTH_SECRET', 'DATABASE_URL'];
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
      console.error('[validateEnvironmentVariables] Missing required environment variables:', missing);
      throw error;
    }
    
    console.log('[validateEnvironmentVariables] Environment variables validated successfully');
  } catch (error) {
    console.error('[validateEnvironmentVariables] Environment validation failed:', error);
    throw error;
  }
}