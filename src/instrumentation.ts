// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  if (typeof window === "undefined") {
    // ensureGcpCreds 自体も動的 import（クライアントバンドルから完全に除外）
    const mod = await import("./utils/ensureGcpCreds");
    await mod.ensureGcpCreds();
  }
}