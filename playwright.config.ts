import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * .env.local ファイルから環境変数 로드
 * Playwrightは 자동으로 .env.local을 로드하지 않으므로 명시的으로 로드해야 합니다
 */
const envResult = config({ path: resolve(__dirname, '.env.local') });

// 環境変数のロード確認（デバッグ用）
if (envResult.error) {
  console.warn('[Playwright Config] .env.local ファイルの読み込みに失敗しました:', envResult.error.message);
  console.warn('[Playwright Config] 環境変数はシステム環境変数から読み込まれます');
} else {
  console.log('[Playwright Config] .env.local ファイルを読み込みました');
  
  // 重要な環境変数が設定されているか確認
  const requiredVars = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'PLAYWRIGHT_BASE_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`[Playwright Config] 以下の環境変数が設定されていません: ${missingVars.join(', ')}`);
  } else {
    console.log('[Playwright Config] 必要な環境変数が設定されています');
  }
}

/**
 * E2Eテスト設定ファイル
 * 
 * この設定は、ユーザーが実際にブラウザで操作する際の動作を検証するためのE2Eテストを実行します。
 * 
 * 使用方法:
 * - ローカル環境: npm run test:e2e
 * - 特定のテスト: npm run test:e2e -- tests/auth.spec.ts
 * - UIモード: npm run test:e2e:ui
 */
export default defineConfig({
  testDir: './e2e',
  
  /* テストのタイムアウト設定 */
  timeout: 90 * 1000, // 90秒に増加（複雑なE2Eテストのため）
  expect: {
    timeout: 10000, // 10秒に増加
  },
  
  /* テストの並列実行設定 */
  fullyParallel: true,
  
  /* CI/CDでの失敗時の再試行 */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  
  /* 並列実行するワーカー数 */
  // データベース接続数を制限するため、workers数を制限
  // Limit workers to prevent too many database connections
  // RDS 인스턴스 연결 제한을 고려하여 4로 설정 (타협점)
  workers: 4, // 최대 4개の테스트를 동시 실행（RDS接続数を制限しながら 실행 시간 단축）
  
  /* レポーター設定 */
  reporter: [
    ['html'],
    ['list'],
    process.env.CI ? ['github'] : ['list'],
  ],
  
  /* 共有設定 */
  use: {
    /* ベースURL */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    /* アクションのタイムアウト */
    actionTimeout: 15 * 1000, // 15秒に増加
    
    /* ナビゲーションのタイムアウト */
    navigationTimeout: 60 * 1000, // 60秒に増加（ログイン後のデータロード待機のため）
    
    /* スクリーンショット設定 */
    screenshot: 'only-on-failure',
    
    /* 動画録画設定 */
    video: 'retain-on-failure',
    
    /* トレース設定（失敗時のみ） */
    trace: 'on-first-retry',
  },

  /* プロジェクト設定（複数のブラウザ/デバイスでテスト可能） */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 테스트 순서: 유저 테스트를 먼저 실행 (관리자 테스트가 계정을 잠그는 것을 방지)
      // testMatch: ['**/user-*.spec.ts', '**/character-search.spec.ts', '**/chat.spec.ts', '**/misc-features.spec.ts', '**/points-critical.spec.ts', '**/auth.spec.ts', '**/admin-*.spec.ts', '**/*.spec.ts'],
    },
    
    // 必要に応じて他のブラウザも追加可能
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  /* 開発サーバーの起動設定（必要に応じて） */
  // サーバーが既に実行中の場合は webServer を無効化
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 180 * 1000,
  //   stdout: 'ignore',
  //   stderr: 'pipe',
  //   env: {
  //     ...process.env,
  //     PORT: process.env.PORT || '3000',
  //   },
  // },
});