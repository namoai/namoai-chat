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
  console.warn('[Playwright Mobile Config] .env.local ファイルの読み込みに失敗しました:', envResult.error.message);
  console.warn('[Playwright Mobile Config] 環境変数はシステム環境変数から読み込まれます');
} else {
  console.log('[Playwright Mobile Config] .env.local ファイルを読み込みました');
  
  // 重要な環境変数が設定されているか確認
  const requiredVars = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'PLAYWRIGHT_BASE_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`[Playwright Mobile Config] 以下の環境変数が設定されていません: ${missingVars.join(', ')}`);
  } else {
    console.log('[Playwright Mobile Config] 必要な環境変数が設定されています');
  }
}

/**
 * モバイル版E2Eテスト設定ファイル
 * 
 * この設定は、モバイルデバイス（Android、iOS）でのE2Eテストを実行します。
 * PC版と機能は同じですが、レイアウトやUI要素の配置が異なる可能性があります。
 * 
 * 使用方法:
 * - ローカル環境: npm run test:e2e:mobile
 * - Androidのみ: npm run test:e2e:mobile -- --project=android
 * - iOSのみ: npm run test:e2e:mobile -- --project=ios
 * - UIモード: npm run test:e2e:mobile:ui
 */
export default defineConfig({
  testDir: './e2e(Mobile Version)',
  
  /* テストファイルフィルタ（ユーザーテストのみ） */
  testMatch: [
    '**/user-*.spec.ts',
    '**/points-critical.spec.ts',
    '**/chat.spec.ts',
    '**/character-search.spec.ts',
    '**/misc-features.spec.ts',
    '**/user-journey.spec.ts',
  ],
  
  /* テストのタイムアウト設定 */
  timeout: 90 * 1000, // 90秒に増加（複雑なE2Eテストのため）
  expect: {
    timeout: 10000, // 10秒に増加
  },
  
  /* テストの並列実行設定 */
  fullyParallel: false,
  
  /* CI/CDでの失敗時の再試行 */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  
  /* 並列実行するワーカー数 */
  // モバイルテストは順次実行で安定性を確保
  workers: 1, // 順次実行（テスト安定性のため1個ワーカーのみ使用）
  
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
    screenshot: 'on', // すべてのテストでスクリーンショットを保存
    
    /* 動画録画設定 */
    video: 'retain-on-failure',
    
    /* トレース設定（失敗時のみ） */
    trace: 'on-first-retry',
  },

  /* プロジェクト設定（AndroidとiOSの両方でテスト） */
  projects: [
    {
      name: 'android',
      use: { 
        ...devices['Pixel 5'],
        // Android固有の設定があれば追加
      },
    },
    {
      name: 'ios',
      use: { 
        ...devices['iPhone 12'],
        // iOS固有の設定があれば追加
      },
    },
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

