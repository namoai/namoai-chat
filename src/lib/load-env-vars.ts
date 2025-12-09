'use server';
import 'server-only';

let loaded = false;

/**
 * AWS Amplify 환경변수 로더
 * - AWS Amplify 콘솔에서 설정한 환경변수가 자동으로 Lambda에 전달됨
 * - Secrets Manager를 사용하지 않음 (권한 문제)
 */
export async function ensureEnvVarsLoaded(): Promise<void> {
  if (loaded) return;
  
  // AWS Amplify 환경변수가 자동으로 Lambda에 전달됨
  // Secrets Manager를 사용하지 않고 직접 환경변수 사용
  console.log('[load-env-vars] ✅ Using AWS Amplify environment variables');
  
  loaded = true;
}

