'use server';
import 'server-only';

let loaded = false;

/**
 * AWS Secrets Manager에서 시크릿을 로드하는 헬퍼 함수
 */
async function loadFromAwsSecretsManager(secretName: string): Promise<string | null> {
  try {
    // AWS SDK는 Lambda 환경에 자동으로 포함되어 있음
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    
    if (response.SecretString) {
      console.log(`[load-env-vars] ✅ Loaded ${secretName} from AWS Secrets Manager`);
      return response.SecretString;
    }
    
    return null;
  } catch (error: any) {
    console.warn(`[load-env-vars] ⚠️ Failed to load ${secretName} from AWS Secrets Manager:`, error.message);
    return null;
  }
}

/**
 * GCP Secret Manager에서 시크릿을 로드하는 헬퍼 함수
 */
async function loadFromGcpSecretManager(secretName: string): Promise<string | null> {
  try {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    
    // GCP 프로젝트 ID 확인
    const projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCP_PROJECT_ID;
    if (!projectId) {
      console.warn('[load-env-vars] ⚠️ GOOGLE_PROJECT_ID not set, skipping GCP Secret Manager');
      return null;
    }
    
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });
    
    const payload = version.payload?.data;
    if (payload) {
      const value = Buffer.from(payload as Uint8Array).toString('utf8').trim();
      console.log(`[load-env-vars] ✅ Loaded ${secretName} from GCP Secret Manager`);
      return value;
    }
    
    return null;
  } catch (error: any) {
    console.warn(`[load-env-vars] ⚠️ Failed to load ${secretName} from GCP Secret Manager:`, error.message);
    return null;
  }
}

/**
 * 시크릿을 로드하는 통합 함수 (AWS -> GCP 순서로 시도)
 */
async function loadSecret(envVarName: string, secretName?: string): Promise<void> {
  // 이미 환경변수에 설정되어 있으면 스킵
  if (process.env[envVarName]) {
    console.log(`[load-env-vars] ✅ ${envVarName} already set from environment`);
    return;
  }
  
  const actualSecretName = secretName || envVarName;
  
  // 1. AWS Secrets Manager에서 시도
  const awsValue = await loadFromAwsSecretsManager(actualSecretName);
  if (awsValue) {
    process.env[envVarName] = awsValue;
    return;
  }
  
  // 2. GCP Secret Manager에서 시도
  const gcpValue = await loadFromGcpSecretManager(actualSecretName);
  if (gcpValue) {
    process.env[envVarName] = gcpValue;
    return;
  }
  
  console.warn(`[load-env-vars] ⚠️ ${envVarName} not found in any secret manager`);
}

/**
 * ランタイム専用の環境変数ローダー。
 * - Build/Edge では何もしない（node 組み込みをバンドルしないため）
 * - Lambda 실행 시 AWS Secrets Manager 또는 GCP Secret Manager에서 시크릿 로드
 * - DATABASE_URL / NEXTAUTH_SECRET が無ければ警告を出す
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;

  const runtime: string | undefined = process.env.NEXT_RUNTIME;
  // Edge やブラウザ、ビルド時はスキップ
  if (runtime === 'edge' || typeof process === 'undefined' || !process.versions?.node) {
    loaded = true;
    return;
  }
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    loaded = true;
    return;
  }

  console.log('[load-env-vars] 🔄 Loading environment variables from secret managers...');
  
  // AWS Lambda 환경 감지
  const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );
  
  if (isLambda) {
    console.log('[load-env-vars] 🚀 Lambda environment detected, attempting to load secrets...');
    
    try {
      // 필수 환경변수 로드 시도
      await Promise.all([
        loadSecret('DATABASE_URL'),
        loadSecret('NEXTAUTH_SECRET'),
        loadSecret('GOOGLE_CLIENT_ID'),
        loadSecret('GOOGLE_CLIENT_SECRET'),
      ]);
    } catch (error: any) {
      console.error('[load-env-vars] ❌ Error loading secrets:', error.message);
    }
  }

  // 최종 확인
  const missing: string[] = [];
  const requiredVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    console.error('[load-env-vars] ❌ Missing required environment variables:', missing);
    console.error('[load-env-vars] 💡 Solution:');
    console.error('[load-env-vars]    1. Set them in AWS Amplify Console → Environment variables');
    console.error('[load-env-vars]    2. Or store them in AWS Secrets Manager');
    console.error('[load-env-vars]    3. Or store them in GCP Secret Manager (set GOOGLE_PROJECT_ID)');
  } else {
    console.log('[load-env-vars] ✅ All required environment variables are loaded');
  }

  loaded = true;
}

