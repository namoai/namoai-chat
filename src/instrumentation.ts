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
        console.log('[instrumentation] Lambda environment detected, loading environment variables...');
        console.log('[instrumentation] Current working directory:', process.cwd());
        console.log('[instrumentation] LAMBDA_TASK_ROOT:', process.env.LAMBDA_TASK_ROOT);
        
        // 1. 먼저 .env.production.local 파일에서 로드 시도
        try {
          const fs = await import('fs');
          const path = await import('path');
          
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

          let loaded = false;
          for (const filePath of possiblePaths) {
            try {
              if (fs.existsSync(filePath)) {
                console.log(`[instrumentation] Found .env.production.local at: ${filePath}`);
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
              }
            } catch (error) {
              console.warn(`[instrumentation] Failed to check/load ${filePath}:`, error);
            }
          }

          if (!loaded) {
            console.warn('[instrumentation] ⚠️ .env.production.local file not found');
          }
        } catch (error) {
          console.warn('[instrumentation] Failed to load from .env.production.local:', error);
        }

        // 2. AWS Systems Manager Parameter Store에서 로드 시도
        const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXTAUTH_SECRET', 'DATABASE_URL'];
        const missingVars = requiredVars.filter(v => !process.env[v]);
        
        if (missingVars.length > 0) {
          console.log(`[instrumentation] Attempting to load ${missingVars.length} missing variables from Parameter Store...`);
          try {
            const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm');
            const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
            
            // Amplify 환경 변수 경로 패턴: /amplify/{appId}/{branch}/{key}
            const amplifyAppId = process.env.AWS_AMPLIFY_APP_ID || process.env.AMPLIFY_APP_ID;
            const branch = process.env.AWS_BRANCH || 'main';
            
            if (amplifyAppId) {
              const parameterNames = missingVars.map(key => 
                `/amplify/${amplifyAppId}/${branch}/${key}`
              );
              
              try {
                const command = new GetParametersCommand({
                  Names: parameterNames,
                  WithDecryption: true,
                });
                const response = await ssmClient.send(command);
                
                if (response.Parameters) {
                  let loadedCount = 0;
                  for (const param of response.Parameters) {
                    if (param.Name && param.Value) {
                      // /amplify/{appId}/{branch}/{key} 형식에서 key 추출
                      const key = param.Name.split('/').pop();
                      if (key && !process.env[key]) {
                        process.env[key] = param.Value;
                        loadedCount++;
                        console.log(`[instrumentation] ✅ Loaded ${key} from Parameter Store`);
                      }
                    }
                  }
                  console.log(`[instrumentation] ✅ Loaded ${loadedCount} variables from Parameter Store`);
                }
              } catch (ssmError) {
                console.warn('[instrumentation] Failed to load from Parameter Store:', ssmError);
              }
            } else {
              console.warn('[instrumentation] AWS_AMPLIFY_APP_ID not found, skipping Parameter Store lookup');
            }
          } catch (error) {
            console.warn('[instrumentation] Failed to initialize SSM client:', error);
          }
        }

        // 3. 최종 확인
        const finalMissing = requiredVars.filter(v => !process.env[v]);
        const finalLoaded = requiredVars.filter(v => process.env[v]);
        console.log(`[instrumentation] Final status - Loaded: ${finalLoaded.join(', ') || 'none'}`);
        if (finalMissing.length > 0) {
          console.warn(`[instrumentation] ⚠️ Still missing: ${finalMissing.join(', ')}`);
          console.warn('[instrumentation] Please ensure these are set in AWS Amplify Console or Parameter Store');
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