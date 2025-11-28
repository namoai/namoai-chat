// src/lib/amplify-env-loader.ts
// AWS Amplify Lambda 환경에서 환경 변수를 로드하는 유틸리티

import fs from 'fs';
import path from 'path';

/**
 * .env.production.local 파일에서 환경 변수를 로드
 */
function loadEnvFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`[AmplifyEnvLoader] Loading environment variables from ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      let loadedCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        // 주석이나 빈 줄 스킵
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // KEY=VALUE 형식 파싱
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          
          // 이미 설정된 환경 변수가 있으면 스킵 (환경 변수가 우선)
          if (!process.env[key]) {
            process.env[key] = value;
            loadedCount++;
            console.log(`[AmplifyEnvLoader] Loaded ${key} from ${filePath}`);
          }
        }
      }
      
      console.log(`[AmplifyEnvLoader] ✅ Loaded ${loadedCount} environment variables from ${filePath}`);
      return;
    }
  } catch (error) {
    console.warn(`[AmplifyEnvLoader] Failed to load ${filePath}:`, error);
  }
}

/**
 * AWS Amplify Lambda 환경에서 환경 변수를 로드
 * Lambda 런타임에서는 .env.production.local 파일을 명시적으로 읽어야 함
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

  console.log('[AmplifyEnvLoader] Lambda environment detected, loading environment variables from .env.production.local...');

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
      loadEnvFile(filePath);
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    console.warn('[AmplifyEnvLoader] ⚠️ .env.production.local file not found in any of the expected paths');
    console.warn('[AmplifyEnvLoader] Searched paths:', possiblePaths);
  }

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

