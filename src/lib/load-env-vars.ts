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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[load-env-vars] ⚠️ Failed to load ${secretName} from AWS Secrets Manager:`, errorMessage);
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[load-env-vars] ⚠️ Failed to load ${secretName} from GCP Secret Manager:`, errorMessage);
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
  
  // AWS Amplify 환경변수가 자동으로 Lambda에 전달됨
  // Secrets Manager를 사용하지 않고 직접 환경변수 사용
  console.log('[load-env-vars] ✅ Using AWS Amplify environment variables (no secret manager loading)');
  
  loaded = true;
}

