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
        console.log('[instrumentation] Current working directory:', process.cwd());
        console.log('[instrumentation] LAMBDA_TASK_ROOT:', process.env.LAMBDA_TASK_ROOT);
        
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
          ...(process.env.LAMBDA_TASK_ROOT ? [
            path.join(process.env.LAMBDA_TASK_ROOT, '.env.production.local'),
            path.join(process.env.LAMBDA_TASK_ROOT, '.next', '.env.production.local'),
            path.join(process.env.LAMBDA_TASK_ROOT, '.next', 'standalone', '.env.production.local'),
          ] : []),
        ];

        console.log('[instrumentation] Searching for .env.production.local in paths:', possiblePaths);

        let loaded = false;
        for (const filePath of possiblePaths) {
          try {
            if (fs.existsSync(filePath)) {
              console.log(`[instrumentation] Found .env.production.local at: ${filePath}`);
              const content = fs.readFileSync(filePath, 'utf8');
              console.log(`[instrumentation] File content length: ${content.length} bytes`);
              
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
                  } else {
                    console.log(`[instrumentation] Skipped ${key} (already set)`);
                  }
                }
              }
              
              console.log(`[instrumentation] ✅ Loaded ${loadedCount} environment variables from ${filePath}`);
              loaded = true;
              break;
            } else {
              console.log(`[instrumentation] File not found: ${filePath}`);
            }
          } catch (error) {
            console.warn(`[instrumentation] Failed to check/load ${filePath}:`, error);
          }
        }

        if (!loaded) {
          console.warn('[instrumentation] ⚠️ .env.production.local file not found in any of the expected paths');
          console.warn('[instrumentation] This may indicate that the file was not included in the Lambda deployment');
        } else {
          // 로드된 환경 변수 확인
          const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXTAUTH_SECRET', 'DATABASE_URL'];
          const loadedVars = requiredVars.filter(v => process.env[v]);
          console.log(`[instrumentation] ✅ Loaded environment variables: ${loadedVars.join(', ')}`);
          const missingVars = requiredVars.filter(v => !process.env[v]);
          if (missingVars.length > 0) {
            console.warn(`[instrumentation] ⚠️ Still missing: ${missingVars.join(', ')}`);
          }
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