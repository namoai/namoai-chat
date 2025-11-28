// Next.js がサーバ起動時に実行されるフック
export async function register() {
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
        console.log('[instrumentation] Lambda environment detected, loading environment variables from .env.production.local...');
        
        // 동적 import로 fs와 path 로드 (서버 사이드에서만 사용)
        const fs = await import('fs');
        const path = await import('path');
        
        // 가능한 경로들에서 .env.production.local 파일 찾기
        const possiblePaths = [
          path.join(process.cwd(), '.env.production.local'),
          path.join(process.cwd(), '.next', '.env.production.local'),
          path.join(process.cwd(), '.next', 'standalone', '.env.production.local'),
          path.join('/var/task', '.env.production.local'),
          path.join('/var/task', '.next', '.env.production.local'),
          path.join('/var/task', '.next', 'standalone', '.env.production.local'),
        ];

        let loaded = false;
        for (const filePath of possiblePaths) {
          if (fs.existsSync(filePath)) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const lines = content.split('\n');
              
              let loadedCount = 0;
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                  const key = match[1].trim();
                  const value = match[2].trim();
                  
                  if (!process.env[key]) {
                    process.env[key] = value;
                    loadedCount++;
                    console.log(`[instrumentation] Loaded ${key} from ${filePath}`);
                  }
                }
              }
              
              console.log(`[instrumentation] ✅ Loaded ${loadedCount} environment variables from ${filePath}`);
              loaded = true;
              break;
            } catch (error) {
              console.warn(`[instrumentation] Failed to load ${filePath}:`, error);
            }
          }
        }

        if (!loaded) {
          console.warn('[instrumentation] ⚠️ .env.production.local file not found in any of the expected paths');
        }
      }
    } catch (error) {
      console.warn("[instrumentation] Failed to load Amplify env vars:", error);
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