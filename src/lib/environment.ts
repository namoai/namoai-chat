/**
 * 環境(Environment)管理ユーティリティ
 * ローカルテスト、IT(結合)テスト、混紡(ステージング)環境を区別します。
 * 
 * Environment management utility
 * Distinguishes between local test, IT (integration) test, and staging environments.
 */

export type EnvironmentType = 'local' | 'integration' | 'staging' | 'production';

export interface EnvironmentConfig {
  type: EnvironmentType;
  name: string;
  description: string;
  apiUrl: string;
  databaseUrl?: string;
  allowMutations: boolean;
  enableDebugLogs: boolean;
  enableTestFeatures: boolean;
  useMockServices: boolean;
}

/**
 * 現在の環境タイプを決定します。
 * 優先順位:
 * 1. APP_ENV環境変数（明示的な設定）
 * 2. NODE_ENVベースの推論（production -> production、その他 -> local）
 * 3. デフォルト値: local
 * 
 * Determines the current environment type.
 * Priority:
 * 1. APP_ENV environment variable (explicit setting)
 * 2. NODE_ENV-based inference (production -> production, others -> local)
 * 3. Default: local
 */
export function getEnvironmentType(): EnvironmentType {
  // 明示的にAPP_ENVが設定されている場合は使用
  // Use APP_ENV if explicitly set
  const appEnv = process.env.APP_ENV?.toLowerCase();
  if (appEnv && ['local', 'integration', 'staging', 'production'].includes(appEnv)) {
    return appEnv as EnvironmentType;
  }

  // Amplifyブランチ名をフォールバックとして使用
  // Use AWS_BRANCH as a fallback e.g. develop -> integration, main -> staging
  const branch = process.env.AWS_BRANCH?.toLowerCase();
  if (branch) {
    if (['develop', 'development', 'it', 'integration'].includes(branch)) {
      return 'integration';
    }
    if (['main', 'staging', '混紡', 'honbang'].includes(branch)) {
      return 'staging';
    }
    if (['production', 'prod', 'release'].includes(branch)) {
      return 'production';
    }
  }

  // NODE_ENVベースの推論
  // NODE_ENV-based inference
  if (process.env.NODE_ENV === 'production') {
    // プロダクション環境でもAPP_ENVでstaging/productionを区別可能
    // Can distinguish staging/production with APP_ENV even in production environment
    return 'production';
  }

  // デフォルト値: ローカル開発環境
  // Default: local development environment
  return 'local';
}

/**
 * 現在の環境設定を返します。
 * Returns the current environment configuration.
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const envType = getEnvironmentType();

  const configs: Record<EnvironmentType, EnvironmentConfig> = {
    local: {
      type: 'local',
      name: 'ローカルテスト環境', // 로컬 테스트 환경
      description: '開発者がローカルでテストする環境', // 개발자가 로컬에서 테스트하는 환경
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      databaseUrl: process.env.DATABASE_URL,
      allowMutations: true,
      enableDebugLogs: true,
      enableTestFeatures: true,
      useMockServices: false, // ローカルでは実際のサービスを使用 // 로컬에서는 실제 서비스 사용
    },
    integration: {
      type: 'integration',
      name: 'IT(結合)テスト環境', // IT(결합) 테스트 환경
      description: 'システム統合および結合テストのための環境', // 시스템 통합 및 결합 테스트를 위한 환경
      apiUrl: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_IT_API_URL || '',
      // IT環境ではSTAGING_DATABASE_URLを明示的に無視し、IT_DATABASE_URLのみ使用
      // In IT environment, explicitly ignore STAGING_DATABASE_URL and use only IT_DATABASE_URL
      databaseUrl: process.env.IT_DATABASE_URL || process.env.DATABASE_URL,
      allowMutations: true,
      enableDebugLogs: true,
      enableTestFeatures: true,
      useMockServices: false,
    },
    staging: {
      type: 'staging',
      name: '混紡(ステージング)環境', // 혼방(스테이징) 환경
      description: 'プロダクション配信前の最終検証のための環境', // 프로덕션 배포 전 최종 검증을 위한 환경
      apiUrl: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_STAGING_API_URL || '',
      databaseUrl: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL,
      allowMutations: true,
      enableDebugLogs: false,
      enableTestFeatures: false,
      useMockServices: false,
    },
    production: {
      type: 'production',
      name: 'プロダクション環境', // 프로덕션 환경
      description: '実際のサービス運用環境', // 실제 서비스 운영 환경
      apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
      databaseUrl: process.env.DATABASE_URL,
      allowMutations: true,
      enableDebugLogs: false,
      enableTestFeatures: false,
      useMockServices: false,
    },
  };

  return configs[envType];
}

/**
 * 現在の環境が特定のタイプかどうかを確認します。
 * Checks if the current environment is of a specific type.
 */
export function isEnvironment(type: EnvironmentType | EnvironmentType[]): boolean {
  const currentEnv = getEnvironmentType();
  if (Array.isArray(type)) {
    return type.includes(currentEnv);
  }
  return currentEnv === type;
}

/**
 * ローカル環境かどうかを確認します。
 * Checks if it's a local environment.
 */
export function isLocal(): boolean {
  return isEnvironment('local');
}

/**
 * 統合テスト環境かどうかを確認します。
 * Checks if it's an integration test environment.
 */
export function isIntegration(): boolean {
  return isEnvironment('integration');
}

/**
 * ステージング環境かどうかを確認します。
 * Checks if it's a staging environment.
 */
export function isStaging(): boolean {
  return isEnvironment('staging');
}

/**
 * プロダクション環境かどうかを確認します。
 * Checks if it's a production environment.
 */
export function isProduction(): boolean {
  return isEnvironment('production');
}

/**
 * テスト環境かどうかを確認します（ローカルまたは統合テスト）。
 * Checks if it's a test environment (local or integration test).
 */
export function isTestEnvironment(): boolean {
  return isEnvironment(['local', 'integration']);
}

/**
 * デバッグログを有効にする必要があるかどうかを確認します。
 * Checks if debug logs should be enabled.
 */
export function shouldEnableDebugLogs(): boolean {
  return getEnvironmentConfig().enableDebugLogs;
}

/**
 * テスト機能を有効にする必要があるかどうかを確認します。
 * Checks if test features should be enabled.
 */
export function shouldEnableTestFeatures(): boolean {
  return getEnvironmentConfig().enableTestFeatures;
}

/**
 * データ変更(mutation)を許可するかどうかを確認します。
 * Checks if data mutations are allowed.
 */
export function allowMutations(): boolean {
  return getEnvironmentConfig().allowMutations;
}

/**
 * 環境情報をログに出力します（デバッグ用）。
 * Outputs environment information to logs (for debugging).
 */
export function logEnvironmentInfo(): void {
  const config = getEnvironmentConfig();
  console.log('[Environment]', {
    type: config.type,
    name: config.name,
    description: config.description,
    apiUrl: config.apiUrl,
    allowMutations: config.allowMutations,
    enableDebugLogs: config.enableDebugLogs,
    enableTestFeatures: config.enableTestFeatures,
  });
}

/**
 * IT環境から混紡環境へのキャラクター移行をサポートします。
 * Supports character migration from IT environment to staging environment.
 * 
 * IT環境で作成されたキャラクターを混紡環境に移行するためのURLを生成します。
 * Generates a URL to migrate characters created in IT environment to staging environment.
 * 
 * 注意: IT環境ではこの関数は使用されません（IT環境では混紡環境への移行は不要）。
 * Note: This function is not used in IT environment (migration to staging is not needed in IT environment).
 */
export function getStagingMigrationUrl(characterId: number | string): string {
  // IT環境では空文字列を返す（IT環境では混紡環境への移行は不要）
  // Return empty string in IT environment (migration to staging is not needed in IT environment)
  if (getEnvironmentType() === 'integration') {
    console.log('[Environment] IT environment detected - staging migration URL not available');
    return '';
  }
  
  const stagingUrl = process.env.NEXT_PUBLIC_STAGING_API_URL || 
                     process.env.NEXT_PUBLIC_STAGING_URL || 
                     '';
  
  if (!stagingUrl) {
    console.warn('[Environment] Staging URL not configured');
    return '';
  }
  
  // 混紡環境のキャラクター詳細ページまたは移行エンドポイント
  // Staging environment character detail page or migration endpoint
  return `${stagingUrl}/characters/${characterId}`;
}

