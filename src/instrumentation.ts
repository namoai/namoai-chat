// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  // Netlify Edge Runtime では process.versions.node が存在しない
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
      const mod = await import("./utils/ensureGcpCreds");
      await mod.ensureGcpCreds();
    } catch (error) {
      // Edge Runtime で実行された場合はエラーを無視
      if (
        (error instanceof ReferenceError && error.message.includes("require")) ||
        (error instanceof Error && (error.message.includes("Cannot find module") || (error as any).code === "MODULE_NOT_FOUND"))
      ) {
        console.warn("[instrumentation] Skipping ensureGcpCreds in Edge Runtime");
        return;
      }
      throw error;
    }
    
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