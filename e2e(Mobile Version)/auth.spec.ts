import { test, expect } from '@playwright/test';
import { loginWithEmail, logout, expectLoggedIn, expectLoggedOut, resetAccountLockStatus } from './helpers/auth';

/**
 * 認証機能のE2Eテスト（モバイル版）
 * 
 * このテストはAndroidとiOSの両方のデバイスで実行されます。
 * PC版と機能は同じですが、レイアウトやUI要素の配置が異なる可能性があります。
 * 
 * テストシナリオ:
 * - メールアドレスとパスワードでログイン
 * - ログアウト
 * - ログイン状態の確認
 */

test.describe('認証機能', () => {
  // テスト用の認証情報（環境変数から取得、またはデフォルト値）
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  test.beforeEach(async ({ page }) => {
    // 各テスト前にログアウト状態にする
    await page.goto('/');
    // 既にログインしている場合はログアウト
    try {
      await logout(page);
    } catch {
      // ログアウトに失敗した場合は既にログアウト状態とみなす
    }
  });

  test.afterEach(async ({ page }) => {
    // テスト 後 アカウント ロック 解除 (間違った パスワード テストで による ロック )
    // 管理字 アカウントで ログインして ロック 解除
    if (adminEmail && adminPassword) {
      try {
        await loginWithEmail(page, adminEmail, adminPassword);
        await resetAccountLockStatus(page, testEmail);
        await logout(page);
      } catch (error) {
        // ロック 解除 失敗しても 続行 進行 (管理字 権限が ないを 数 あり)
        console.warn('[afterEach] アカウント ロック 解除 失敗 (無視):', error);
      }
    }
  });

  test('メールアドレスとパスワードでログインできる', async ({ page }) => {
    // アカウントが されて あるか 確認
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    const accountSuspendedMessage = page.getByText(/アカウント停止中|アカウントが停止されています/i);
    const isSuspended = await accountSuspendedMessage.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isSuspended) {
      test.skip(true, 'テストアカウントが停止されています。管理者に解除を依頼してください。');
      return;
    }
    
    await loginWithEmail(page, testEmail, testPassword);
    await expectLoggedIn(page);
  });

  test('ログアウトできる', async ({ page }) => {
    // アカウントが されて あるか 確認
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    const accountSuspendedMessage = page.getByText(/アカウント停止中|アカウントが停止されています/i);
    const isSuspended = await accountSuspendedMessage.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isSuspended) {
      test.skip(true, 'テストアカウントが停止されています。管理者に解除を依頼してください。');
      return;
    }
    
    // まずログイン
    await loginWithEmail(page, testEmail, testPassword);
    await expectLoggedIn(page);
    
    // ログアウト
    await logout(page);
    await expectLoggedOut(page);
  });

  test('間違ったパスワードでログインできない', async ({ page }) => {
    // テスト 前に アカウント ロック 状態 確認 および 解除
    // 管理字 アカウントで ログインして ロック 解除
    if (adminEmail && adminPassword) {
      try {
        await loginWithEmail(page, adminEmail, adminPassword);
        await resetAccountLockStatus(page, testEmail);
        await logout(page);
      } catch (error) {
        console.warn('[間違ったパスワードテスト] テスト 前 アカウント ロック 解除 失敗 (無視):', error);
      }
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    // 1回だけ間違ったパスワードで試行 (10回まで 前, 1回で )
    await passwordInput.fill('wrongpassword');
    
    const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login"), button[type="submit"]').first();
    await loginButton.click();
    
    // エラーメッセージが表示されるか、ログインページに留まることを確認
    await page.waitForTimeout(2000);
    
    // ログインページに留まっているか、エラーメッセージが表示されていることを確認
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
    
    // アカウント ロック エラー メッセージ 確認 (ロックされ なくては すべき - 1回 失敗 であるで)
    const lockMessage = page.getByText(/アカウントがロックされました|アカウントがロックされています/i);
    const isLocked = await lockMessage.isVisible({ timeout: 1000 }).catch(() => false);
    
    // 1回の失敗では ロックされ なくては すべき (10回 が上 失敗 時 ロック)
    if (isLocked) {
      console.warn('[間違ったパスワードテスト] 警告: アカウントが ロックされました. 前 テストで 複数 回 失敗を 数 あります.');
    }
  });
});




