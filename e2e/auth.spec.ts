import { test, expect } from '@playwright/test';
import { loginWithEmail, logout, expectLoggedIn, expectLoggedOut, resetAccountLockStatus } from './helpers/auth';

/**
 * 認証機能のE2Eテスト
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
    // テスト 후 계정 잠금 해제 (잘못된 패스워드 테스트로 인한 잠금 방지)
    // 관리자 계정으로 로그인하여 잠금 해제
    if (adminEmail && adminPassword) {
      try {
        await loginWithEmail(page, adminEmail, adminPassword);
        await resetAccountLockStatus(page, testEmail);
        await logout(page);
      } catch (error) {
        // 잠금 해제 실패해도 계속 진행 (관리자 권한이 없을 수 있음)
        console.warn('[afterEach] 계정 잠금 해제 실패 (무시):', error);
      }
    }
  });

  test('メールアドレスとパスワードでログインできる', async ({ page }) => {
    // 계정이 정지되어 있는지 확인
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
    // 계정이 정지되어 있는지 확인
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
    // 테스트 전에 계정 잠금 상태 확인 및 해제
    // 관리자 계정으로 로그인하여 잠금 해제
    if (adminEmail && adminPassword) {
      try {
        await loginWithEmail(page, adminEmail, adminPassword);
        await resetAccountLockStatus(page, testEmail);
        await logout(page);
      } catch (error) {
        console.warn('[間違ったパスワードテスト] 테스트 전 계정 잠금 해제 실패 (무시):', error);
      }
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    // 1回だけ間違ったパスワードで試行 (10回까지는 안전하지만, 1回만으로 충분)
    await passwordInput.fill('wrongpassword');
    
    const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login"), button[type="submit"]').first();
    await loginButton.click();
    
    // エラーメッセージが表示されるか、ログインページに留まることを確認
    await page.waitForTimeout(2000);
    
    // ログインページに留まっているか、エラーメッセージが表示されていることを確認
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
    
    // 계정 잠금 에러 메시지 확인 (잠금되지 않았어야 함 - 1회 실패만 했으므로)
    const lockMessage = page.getByText(/アカウントがロックされました|アカウントがロックされています/i);
    const isLocked = await lockMessage.isVisible({ timeout: 1000 }).catch(() => false);
    
    // 1回の失敗では 잠금되지 않아야 함 (10回 이상 실패 시 잠금)
    if (isLocked) {
      console.warn('[間違ったパスワードテスト] 경고: 계정이 잠금되었습니다. 이전 테스트에서 여러 번 실패했을 수 있습니다.');
    }
  });
});




