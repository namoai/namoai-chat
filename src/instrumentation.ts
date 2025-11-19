// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window === "undefined") {
    // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
    const mod = await import("./utils/ensureGcpCreds");
    await mod.ensureGcpCreds();
    
    // セキュリティ強化: 環境変数の検証
    try {
      const { initializeEnvSecurity } = await import("./lib/env-security");
      initializeEnvSecurity();
    } catch (error) {
      console.error("環境変数の検証に失敗しました:", error);
      // 本番環境では起動を停止することを推奨
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }
}