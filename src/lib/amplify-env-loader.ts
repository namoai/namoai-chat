// src/lib/amplify-env-loader.ts
// AWS Amplify Lambda 환경에서 환경 변수를 로드하는 유틸리티

/**
 * AWS Amplify Lambda 환경에서 환경 변수를 로드
 * Lambda 런타임에서는 환경 변수가 자동으로 전달되어야 하지만,
 * 경우에 따라 명시적으로 로드해야 할 수 있음
 */
export function loadAmplifyEnvVars(): void {
  // AWS Amplify Lambda 환경 감지
  const isLambda = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (!isLambda) {
    return; // Lambda 환경이 아니면 스킵
  }

  console.log('[AmplifyEnvLoader] Lambda environment detected, checking for environment variables...');

  // 필요한 환경 변수 목록
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
  ];

  const missing: string[] = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.warn('[AmplifyEnvLoader] Missing environment variables:', missing);
    console.warn('[AmplifyEnvLoader] Please ensure these are set in AWS Amplify Console:');
    console.warn('[AmplifyEnvLoader] App settings → Environment variables');
    console.warn('[AmplifyEnvLoader] Available env keys:', Object.keys(process.env).slice(0, 20));
  } else {
    console.log('[AmplifyEnvLoader] ✅ All required environment variables are set');
  }
}

