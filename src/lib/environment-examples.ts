/**
 * 환경 분리 시스템 사용 예시
 * 
 * 이 파일은 참고용 예시입니다. 실제 프로젝트에서는 필요에 따라
 * src/lib/environment.ts의 함수들을 사용하세요.
 */

import { 
  getEnvironmentType, 
  getEnvironmentConfig,
  isLocal,
  isIntegration,
  isStaging,
  isProduction,
  shouldEnableDebugLogs,
  shouldEnableTestFeatures,
  allowMutations
} from './environment';

// ============================================
// 예시 1: API 라우트에서 환경별 에러 처리
// ============================================
export function exampleApiErrorHandling(error: unknown) {
  if (shouldEnableDebugLogs()) {
    // 로컬/통합 테스트 환경: 상세한 에러 정보 반환
    console.error('[API Error]', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      environment: getEnvironmentType(),
    };
  } else {
    // 스테이징/프로덕션: 최소한의 정보만 반환
    return {
      error: 'Internal Server Error',
      environment: getEnvironmentType(),
    };
  }
}

// ============================================
// 예시 2: 테스트 기능 조건부 표시
// ============================================
export function shouldShowTestFeatures(): boolean {
  return shouldEnableTestFeatures();
}

// 예시: React 컴포넌트에서 사용
// {shouldShowTestFeatures() && <TestFeatureButton />}

// ============================================
// 예시 3: 환경별 데이터베이스 URL 선택
// ============================================
export function getDatabaseUrl(): string {
  const config = getEnvironmentConfig();
  
  // 환경별로 다른 데이터베이스 URL 사용
  if (config.databaseUrl) {
    return config.databaseUrl;
  }
  
  // 기본값
  return process.env.DATABASE_URL || '';
}

// ============================================
// 예시 4: 환경별 로깅 레벨
// ============================================
export function logWithEnvironment(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const config = getEnvironmentConfig();
  
  // 디버그 로그는 로컬/통합 테스트 환경에서만
  if (level === 'debug' && !config.enableDebugLogs) {
    return;
  }
  
  const logMessage = `[${config.name}] ${message}`;
  
  switch (level) {
    case 'debug':
      console.debug(logMessage, data);
      break;
    case 'info':
      console.info(logMessage, data);
      break;
    case 'warn':
      console.warn(logMessage, data);
      break;
    case 'error':
      console.error(logMessage, data);
      break;
  }
}

// ============================================
// 예시 5: 환경별 기능 플래그
// ============================================
export function getFeatureFlags() {
  const config = getEnvironmentConfig();
  
  return {
    // 테스트 환경에서만 활성화
    enableTestMode: config.enableTestFeatures,
    
    // 로컬 환경에서만 활성화
    enableDevTools: isLocal(),
    
    // 통합 테스트 환경에서만 활성화
    enableAutoTest: isIntegration(),
    
    // 스테이징 환경에서만 활성화
    enableStagingFeatures: isStaging(),
    
    // 프로덕션 환경 체크
    isProduction: isProduction(),
  };
}

// ============================================
// 예시 6: 환경별 API 엔드포인트
// ============================================
export function getApiEndpoint(path: string): string {
  const config = getEnvironmentConfig();
  const baseUrl = config.apiUrl || '';
  
  // 경로가 이미 전체 URL인 경우 그대로 반환
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // 상대 경로인 경우 base URL과 결합
  const separator = baseUrl.endsWith('/') || path.startsWith('/') ? '' : '/';
  return `${baseUrl}${separator}${path}`;
}

// ============================================
// 예시 7: 환경별 데이터 변경 허용 여부
// ============================================
export function validateMutationAllowed(operation: string): boolean {
  if (!allowMutations()) {
    console.warn(`[Environment] Mutation "${operation}" is not allowed in current environment`);
    return false;
  }
  
  // 추가적인 환경별 검증 로직
  if (isProduction() && operation.includes('DELETE')) {
    console.warn('[Environment] DELETE operations require extra caution in production');
    // 프로덕션에서는 삭제 작업에 대한 추가 확인 필요
  }
  
  return true;
}

// ============================================
// 예시 8: 환경 정보를 응답에 포함
// ============================================
export function addEnvironmentHeaders(headers: Headers): void {
  const config = getEnvironmentConfig();
  
  // 디버그 목적으로 환경 정보를 헤더에 추가 (선택적)
  if (shouldEnableDebugLogs()) {
    headers.set('X-Environment-Type', config.type);
    headers.set('X-Environment-Name', config.name);
  }
}

