// Next.js がサーバ起動時に実行されるフック
export async function register() {
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  // AWS Amplify/Lambda 環境では process.versions.node が存在
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    // セキュリティ強化: 環境変数の検証
    // AWS Amplify環境では 환경変수가 런타임에 설정되므로, 검증을 유연하게 처리
    try {
      const { initializeEnvSecurity } = await import("./lib/env-security");
      initializeEnvSecurity();
    } catch (error) {
      console.error("環境変数の検証に失敗しました:", error);
      // AWS Amplify環境에서는 환경 변수가 나중에 설정될 수 있으므로,
      // 초기 검증 실패 시에도 에러를 throw하지 않음
      // 실제 API 요청 시점에 다시 검증됨
      console.warn("[instrumentation] Environment validation failed, but continuing. Variables may be set at runtime.");
    }
  }
}