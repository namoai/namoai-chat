// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  // AWS Amplify/Lambda 環境では process.versions.node が存在
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    // セキュリティ強化: 環境変数の検証
    // 환경 변수가 없으면 빌드 실패
    try {
      const { initializeEnvSecurity } = await import("./lib/env-security");
      initializeEnvSecurity();
    } catch (error) {
      console.error("環境変数の検証に失敗しました:", error);
      // 환경 변수 검증 실패 시 에러를 throw하여 빌드 실패
      throw error;
    }
  }
}