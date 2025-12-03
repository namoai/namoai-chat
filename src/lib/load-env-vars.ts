// src/lib/load-env-vars.ts
// Lambda 런타임에서 환경 변수를 로드하는 유틸리티
// サーバーサイド専用（Node.jsモジュールを使用）
// Server-side only (uses Node.js modules)

'use server';

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

  // 필요한 환경 변수 목록 (기본 인증 + 캐릭터 작성 + AI 분석 등에 필요한 변수)
  const coreVars = [
    'APP_ENV',
    'GOOGLE_CLIENT_ID', 
    'GOOGLE_CLIENT_SECRET', 
    'NEXTAUTH_SECRET', 
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_PROJECT_ID',
  ];
  const cloudflareVars = [
    // CLOUDFLARE_R2_ACCOUNT_ID는 CLOUDFLARE_ACCOUNT_ID의 fallback이므로 선택사항
    // CLOUDFLARE_R2_ACCOUNT_ID is optional as CLOUDFLARE_ACCOUNT_ID is the primary
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    // CLOUDFLARE_R2_BUCKET는 CLOUDFLARE_R2_BUCKET_NAME의 fallback이므로 선택사항
    // CLOUDFLARE_R2_BUCKET is optional as CLOUDFLARE_R2_BUCKET_NAME is the primary
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL',
    'CLOUDFLARE_R2_ENDPOINT',
  ];
  const redisVars = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ];
  const requiredVars = Array.from(new Set([...coreVars, ...cloudflareVars, ...redisVars]));
  
  // 선택적 환경 변수 (GCP 인증용)
  const optionalVars = [
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64',
  ];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length === 0) {
    console.log('[load-env-vars] All required environment variables are already set');
    envVarsLoaded = true;
    return;
  }

  console.log(`[load-env-vars] Missing ${missingVars.length} variables: ${missingVars.join(', ')}`);

  // 1. .env.production.local 파일에서 로드 시도
  // サーバーサイドでのみ実行（fs/pathはNode.js専用）
  // Only execute on server side (fs/path are Node.js only)
  if (typeof window === 'undefined') {
    try {
      // 動的インポートでサーバーサイドでのみロード
      // Dynamic import to load only on server side
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
        } catch {
          // Continue to next path
        }
      }
    } catch (error) {
      console.warn('[load-env-vars] Failed to load from .env.production.local:', error);
    }
  }

  // 2. AWS Systems Manager Parameter Store에서 로드 시도
  const stillMissing = requiredVars.filter(v => !process.env[v]);
  if (stillMissing.length > 0) {
    await loadFromParameterStore(stillMissing, 'required');
  }

  // 3. 선택적 환경 변수도 로드 시도 (GCP 인증용)
  const missingOptional = optionalVars.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    await loadFromParameterStore(missingOptional, 'optional');
  }

  // 4. 최종 확인
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

/**
 * Parameter Storeから環境変数をロード（リトライ機能付き）
 * Load environment variables from Parameter Store (with retry)
 */
async function loadFromParameterStore(variableKeys: string[], type: 'required' | 'optional', retryCount = 0): Promise<void> {
  if (variableKeys.length === 0) return;

  const maxRetries = 3;
  const retryDelay = 500; // 500ms

  console.log(`[load-env-vars] Attempting to load ${variableKeys.length} ${type === 'required' ? 'missing' : 'optional'} variables from Parameter Store... (attempt ${retryCount + 1}/${maxRetries + 1})`);
  
  try {
    const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm');
    const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

    // AWS Amplify App ID 확인
    // 1. 사용자가 설정한 환경변수 (AMPLIFY_APP_ID 또는 APP_ID) - 우선순위 최고
    // 2. Lambda 함수 이름에서 추출 (amplify-{appId}-{branch}-{functionName} 형식)
    // Check AWS Amplify App ID
    // 1. User-set environment variable (AMPLIFY_APP_ID or APP_ID) - highest priority
    // 2. Extract from Lambda function name (amplify-{appId}-{branch}-{functionName} format)
    let amplifyAppId = process.env.AMPLIFY_APP_ID || process.env.APP_ID;
    
    // 디버깅: 관련 환경변수 로그 출력
    // Debugging: log related environment variables
    console.log('[load-env-vars] Checking for App ID...');
    console.log(`[load-env-vars] AMPLIFY_APP_ID: ${process.env.AMPLIFY_APP_ID ? `set (${process.env.AMPLIFY_APP_ID.substring(0, 8)}...)` : 'not set'}`);
    console.log(`[load-env-vars] APP_ID: ${process.env.APP_ID ? `set (${process.env.APP_ID.substring(0, 8)}...)` : 'not set'}`);
    console.log(`[load-env-vars] AWS_LAMBDA_FUNCTION_NAME: ${process.env.AWS_LAMBDA_FUNCTION_NAME || 'not set'}`);
    
    // Lambda 함수 이름에서 App ID 추출 시도
    // Try to extract App ID from Lambda function name
    if (!amplifyAppId && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
      console.log(`[load-env-vars] Attempting to extract App ID from function name: ${functionName}`);
      
      // 여러 가능한 형식 시도
      // Try multiple possible formats
      // 형식 1: Compute-{appId}-{hash} (Amplify Next.js 자동 생성 형식)
      // Format 1: Compute-{appId}-{hash} (Amplify Next.js auto-generated format)
      let match = functionName.match(/^Compute-([a-z0-9]+)-/);
      if (match && match[1]) {
        amplifyAppId = match[1];
        console.log(`[load-env-vars] ✅ Extracted App ID from Lambda function name (Compute format): ${amplifyAppId}`);
      } else {
        // 형식 2: amplify-{appId}-{branch}-{functionName}
        // Format 2: amplify-{appId}-{branch}-{functionName}
        match = functionName.match(/^amplify-([a-z0-9]+)-/);
        if (match && match[1]) {
          amplifyAppId = match[1];
          console.log(`[load-env-vars] ✅ Extracted App ID from Lambda function name (amplify format): ${amplifyAppId}`);
        } else {
          // 형식 3: {appId}-{branch}-{functionName} (amplify 접두사 없음)
          // Format 3: {appId}-{branch}-{functionName} (no amplify prefix)
          match = functionName.match(/^([a-z0-9]{13,})-/);
          if (match && match[1] && match[1].length >= 13) {
            // App ID는 보통 13자 이상의 영숫자 문자열
            // App ID is usually a 13+ character alphanumeric string
            amplifyAppId = match[1];
            console.log(`[load-env-vars] ✅ Extracted App ID from Lambda function name (format 3): ${amplifyAppId}`);
          } else {
            console.log(`[load-env-vars] ⚠️ Lambda function name does not match any expected format`);
            console.log(`[load-env-vars] ⚠️ Function name: ${functionName}`);
            console.log(`[load-env-vars] ⚠️ Please set AMPLIFY_APP_ID environment variable manually.`);
          }
        }
      }
    }
    
    if (!amplifyAppId) {
      console.error('[load-env-vars] ❌ AMPLIFY_APP_ID or APP_ID environment variable is not set. Cannot load from Parameter Store.');
      console.error('[load-env-vars] ❌ Could not extract App ID from Lambda function name or Deployment ID.');
      console.error('[load-env-vars] ❌ IMPORTANT: Amplify distinguishes between "Build settings" and "Environment variables".');
      console.error('[load-env-vars] ❌ You MUST set AMPLIFY_APP_ID in "Environment variables" section (NOT "Build settings").');
      console.error('[load-env-vars] ❌ Steps: Amplify Console → Your App → Environment variables → Add variable');
      console.error('[load-env-vars] ❌ Key: AMPLIFY_APP_ID, Value: your-app-id (e.g., duvg1mvqbm4y4)');
      console.error('[load-env-vars] ❌ Note: AWS_ prefix is not allowed in Amplify environment variables.');
      console.error('[load-env-vars] ❌ After setting, you MUST redeploy the app for changes to take effect.');
      console.error('[load-env-vars] ❌ Available env vars with AMPLIFY/APP: ' + 
        Object.keys(process.env).filter(k => k.includes('AMPLIFY') || k.includes('APP')).join(', ') || 'none');
      return; // App ID가 없으면 Parameter Store에서 로드하지 않음
    }
    
    console.log(`[load-env-vars] ✅ Using Amplify App ID: ${amplifyAppId}`);
    
    const branchCandidates = getAmplifyBranchCandidates();
    console.log(`[load-env-vars] Using Amplify App ID: ${amplifyAppId}, Branch candidates: ${branchCandidates.join(', ')}`);

    let remainingKeys = [...variableKeys];
    let loadedCount = 0;

    for (const branch of branchCandidates) {
      if (remainingKeys.length === 0) {
        break;
      }

      const parameterNames = remainingKeys.map(key => `/amplify/${amplifyAppId}/${branch}/${key}`);
      const chunks = chunkArray(parameterNames, 10);

      for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        try {
          const command = new GetParametersCommand({
            Names: chunk,
            WithDecryption: true,
          });
          const response = await ssmClient.send(command);

          if (response.Parameters) {
            for (const param of response.Parameters) {
              if (param.Name && param.Value) {
                const key = param.Name.split('/').pop();
                if (key && !process.env[key]) {
                  process.env[key] = param.Value;
                  remainingKeys = remainingKeys.filter(k => k !== key);
                  loadedCount++;
                  console.log(`[load-env-vars] ✅ Loaded ${key} from Parameter Store (branch: ${branch})`);
                }
              }
            }
          }

          if (response.InvalidParameters && response.InvalidParameters.length > 0) {
            console.warn(`[load-env-vars] Invalid parameters for branch ${branch} (${type}): ${response.InvalidParameters.join(', ')}`);
          }
        } catch (ssmError) {
          const isCredentialsError = ssmError instanceof Error && 
            (ssmError.message.includes('Could not load credentials') || 
             ssmError.name === 'CredentialsProviderError');
          
          if (isCredentialsError && retryCount < maxRetries) {
            console.warn(`[load-env-vars] Credentials not ready, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
            return loadFromParameterStore(variableKeys, type, retryCount + 1);
          }
          
          console.warn(`[load-env-vars] Failed to load ${type} variables from Parameter Store (branch: ${branch}):`, ssmError);
        }
      }
    }

    if (loadedCount > 0) {
      console.log(`[load-env-vars] ✅ Loaded ${loadedCount} ${type === 'required' ? '' : 'optional '}variables from Parameter Store`);
    }
  } catch (error) {
    // CredentialsProviderErrorの場合はリトライ
    // Retry on CredentialsProviderError
    const isCredentialsError = error instanceof Error && 
      (error.message.includes('Could not load credentials') || 
       error.name === 'CredentialsProviderError' ||
       (error.constructor && (error.constructor as { name?: string }).name === 'CredentialsProviderError'));
    
    if (isCredentialsError && retryCount < maxRetries) {
      console.warn(`[load-env-vars] Credentials not ready, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
      return loadFromParameterStore(variableKeys, type, retryCount + 1);
    }
    
    console.warn('[load-env-vars] Failed to initialize SSM client:', error);
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getAmplifyBranchCandidates(): string[] {
  const candidates: string[] = [];
  const addCandidate = (value?: string | null) => {
    if (value) {
      const trimmed = value.trim();
      if (trimmed && !candidates.includes(trimmed)) {
        candidates.push(trimmed);
      }
    }
  };

  addCandidate(process.env.ENV_BRANCH);
  addCandidate(process.env.APP_BRANCH);
  addCandidate(process.env.BRANCH_NAME);
  addCandidate(process.env.AWS_BRANCH);
  addCandidate(process.env.AMPLIFY_BRANCH);
  addCandidate(process.env.BRANCH);
  addCandidate(process.env.GIT_BRANCH);
  addCandidate(inferBranchFromFunctionName(process.env.AWS_LAMBDA_FUNCTION_NAME));
  addCandidate(inferBranchFromFunctionName(process.env.AWS_LAMBDA_LOG_GROUP_NAME));

  const appEnv = process.env.APP_ENV?.toLowerCase();
  if (appEnv === 'integration') {
    addCandidate('develop');
    addCandidate('integration');
  } else if (appEnv === 'staging') {
    addCandidate('main');
    addCandidate('staging');
  } else if (appEnv === 'production') {
    addCandidate('production');
    addCandidate('main');
  }

  addCandidate('main');
  addCandidate('staging');
  addCandidate('production');
  addCandidate('develop');
  addCandidate('development');
  addCandidate('integration');
  addCandidate('shared');

  return candidates;
}

function inferBranchFromFunctionName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const lowered = name.toLowerCase();
  const branchHints: Array<{ keyword: string; branch: string }> = [
    { keyword: 'develop', branch: 'develop' },
    { keyword: 'development', branch: 'develop' },
    { keyword: 'integration', branch: 'integration' },
    { keyword: 'staging', branch: 'staging' },
    { keyword: 'prod', branch: 'production' },
    { keyword: 'production', branch: 'production' },
    { keyword: 'main', branch: 'main' },
  ];

  for (const hint of branchHints) {
    if (lowered.includes(hint.keyword)) {
      return hint.branch;
    }
  }
  return undefined;
}

