// Next.js がサーバ起動時に実行されるフック
export async function register() {
  console.log('[instrumentation] register() called');
  console.log('[instrumentation] Environment check:', {
    hasWindow: typeof window !== 'undefined',
    hasProcess: typeof process !== 'undefined',
    hasNode: !!process.versions?.node,
    isLambda: !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT),
  });
  
  // サーバ環境でのみ実行（Edge/クライアントでは実行しない）
  // AWS Amplify/Lambda 環境では process.versions.node が存在
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    // AWS Amplify Lambda 환경에서 환경 변수 로드
    try {
      // Lambda 환경 감지
      const isLambda = !!(
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.AWS_EXECUTION_ENV ||
        process.env.LAMBDA_TASK_ROOT
      );

      if (isLambda) {
        console.log('[instrumentation] Lambda environment detected, loading environment variables...');
        console.log('[instrumentation] Current working directory:', process.cwd());
        console.log('[instrumentation] LAMBDA_TASK_ROOT:', process.env.LAMBDA_TASK_ROOT);
        const { ensureEnvVarsLoaded } = await import("./lib/load-env-vars");
        await ensureEnvVarsLoaded();
      }
    } catch (error) {
      console.warn("[instrumentation] Failed to load Amplify env vars:", error);
    }

    // 環境情報のログ出力
    try {
      const { logEnvironmentInfo } = await import("./lib/environment");
      logEnvironmentInfo();
    } catch (error) {
      console.warn("[instrumentation] Failed to log environment info:", error);
    }

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