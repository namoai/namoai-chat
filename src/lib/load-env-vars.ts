// src/lib/load-env-vars.ts
// Lambda 런타임에서 환경 변수를 로드하는 유틸리티

let envVarsLoaded = false;

/**
 * Lambda 런타임에서 환경 변수를 로드
 * 이 함수는 여러 번 호출되어도 한 번만 로드합니다 (캐싱)
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  // 이미 로드되었으면 스킵
  if (envVarsLoaded) {
    return;
  }

  // Lambda 환경이 아니면 스킵
  const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (!isLambda) {
    envVarsLoaded = true;
    return;
  }

  console.log('[load-env-vars] Lambda environment detected, loading environment variables...');

  const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXTAUTH_SECRET', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length === 0) {
    console.log('[load-env-vars] All required environment variables are already set');
    envVarsLoaded = true;
    return;
  }

  console.log(`[load-env-vars] Missing ${missingVars.length} variables: ${missingVars.join(', ')}`);

  // 1. .env.production.local 파일에서 로드 시도
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

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          console.log(`[load-env-vars] Found .env.production.local at: ${filePath}`);
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
                console.log(`[load-env-vars] Loaded ${key} from ${filePath}`);
              }
            }
          }
          
          console.log(`[load-env-vars] ✅ Loaded ${loadedCount} environment variables from ${filePath}`);
          break;
        }
      } catch (error) {
        // Continue to next path
      }
    }
  } catch (error) {
    console.warn('[load-env-vars] Failed to load from .env.production.local:', error);
  }

  // 2. AWS Systems Manager Parameter Store에서 로드 시도
  const stillMissing = requiredVars.filter(v => !process.env[v]);
  if (stillMissing.length > 0) {
    console.log(`[load-env-vars] Attempting to load ${stillMissing.length} missing variables from Parameter Store...`);
    try {
      const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm');
      const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
      
      // Amplify 환경 변수 경로 패턴: /amplify/{appId}/{branch}/{key}
      // 빌드 로그에서 확인한 appId: duvg1mvqbm4y4
      const amplifyAppId = process.env.AWS_APP_ID || process.env.AWS_AMPLIFY_APP_ID || 'duvg1mvqbm4y4';
      const branch = process.env.AWS_BRANCH || 'main';
      
      console.log(`[load-env-vars] Using Amplify App ID: ${amplifyAppId}, Branch: ${branch}`);
      
      const parameterNames = stillMissing.map(key => 
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
                console.log(`[load-env-vars] ✅ Loaded ${key} from Parameter Store`);
              }
            }
          }
          console.log(`[load-env-vars] ✅ Loaded ${loadedCount} variables from Parameter Store`);
        }
        
        if (response.InvalidParameters && response.InvalidParameters.length > 0) {
          console.warn(`[load-env-vars] Invalid parameters: ${response.InvalidParameters.join(', ')}`);
        }
      } catch (ssmError) {
        console.warn('[load-env-vars] Failed to load from Parameter Store:', ssmError);
      }
    } catch (error) {
      console.warn('[load-env-vars] Failed to initialize SSM client:', error);
    }
  }

  // 3. 최종 확인
  const finalMissing = requiredVars.filter(v => !process.env[v]);
  const finalLoaded = requiredVars.filter(v => process.env[v]);
  console.log(`[load-env-vars] Final status - Loaded: ${finalLoaded.join(', ') || 'none'}`);
  if (finalMissing.length > 0) {
    console.warn(`[load-env-vars] ⚠️ Still missing: ${finalMissing.join(', ')}`);
  } else {
    console.log('[load-env-vars] ✅ All required environment variables are now set');
  }

  envVarsLoaded = true;
}

