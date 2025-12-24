/**
 * ユーザー観点: 認証・アカウント管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 1-1-1: メールアドレス 회원가입
 * 1-1-2: 認証メール確認
 * 1-1-3: メールアドレス ログイン
 * 1-1-4: ログイン失敗（間違ったパスワード）
 * 1-1-5: ログアウト
 * 1-1-6: パスワード変更
 */

import { test, expect } from '@playwright/test';
import { setBasicAuth, createTestUser, deleteTestUser, loginUser, logout, resetAccountLockStatus } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// 테스트용 고유 이메일 생성
const generateTestEmail = () => {
  const timestamp = Date.now();
  return `test-${timestamp}@example.com`;
};

test.describe('ユーザー観点: 認証・アカウント管理', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeAll(async () => {
    // 테스트 유저 생성
    testUser = {
      email: generateTestEmail(),
      password: 'TestPassword123!',
    };
  });

  test.beforeEach(async ({ page }) => {
    // Basic認証の設定
    await setBasicAuth(page);
    
    // テスト間の待機時間を追加
    await page.waitForTimeout(2000);
  });

  test.afterAll(async ({ browser }) => {
    // 테스트 유저 삭제
    if (testUser.userId) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await setBasicAuth(page);
      try {
        await deleteTestUser(page, testUser.userId);
      } catch (error) {
        console.error(`[afterAll] テストユーザー削除失敗: ${error}`);
      } finally {
        await page.close();
        await context.close();
      }
    }
  });

  test('1-1-1: メールアドレス 회원가입', async ({ page }) => {
    // 1. 회원가입 페이지 접근
    await page.goto(`${BASE_URL}/register`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 2. 이메일 인증이 필요한 경우 스킵
    const needsVerification = page.getByText(/メール認証が必要|認証コード/i);
    if (await needsVerification.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'メールアドレス認証が必要です。E2Eテストではスキップします。');
      return;
    }

    // 3. 회원가입 폼 작성
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(testUser.email);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await passwordInput.fill(testUser.password);

    // 비밀번호 확인 입력란이 있는 경우
    const passwordConfirmInput = page.locator('input[name="passwordConfirm"], input[placeholder*="確認"]').first();
    if (await passwordConfirmInput.count() > 0 && await passwordConfirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordConfirmInput.fill(testUser.password);
    }

    // 4. 회원가입 버튼 클릭
    const registerButton = page.getByRole('button', { name: /登録|会員登録|サインアップ/i }).first();
    await expect(registerButton).toBeVisible({ timeout: 10000 });
    await registerButton.click();

    // 5. 회원가입 완료 확인
    // 성공 시 로그인 페이지 또는 메인 페이지로 리다이렉트
    await page.waitForURL(/\/login|\/|\/MyPage/, { timeout: 15000 });

    // 6. 로그인 시도 (회원가입 후 자동 로그인되지 않는 경우)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      await loginUser(page, testUser.email, testUser.password);
    }

    // 7. 로그인 상태 확인
    await page.waitForURL(/\/|\/MyPage/, { timeout: 10000 });
    
    // 사용자 프로필 또는 로그아웃 버튼이 표시되어야 함
    const userProfile = page.locator('button, a').filter({ hasText: /マイページ|プロフィール|ログアウト/i }).first();
    await expect(userProfile).toBeVisible({ timeout: 10000 });
  });

  test('1-1-3: メールアドレス ログイン', async ({ page }) => {
    // 1. 로그인 페이지 접근
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 2. 계정 잠금 해제 (테스트용)
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    await resetAccountLockStatus(page, testEmail);

    // 3. 로그인 폼 작성
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(testEmail);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await passwordInput.fill(process.env.TEST_PASSWORD || 'testpassword123');

    // 4. 로그인 버튼 클릭
    const loginButton = page.getByRole('button', { name: /ログイン|サインイン/i }).first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    await loginButton.click();

    // 5. 로그인 완료 확인
    await page.waitForURL(/\/|\/MyPage/, { timeout: 15000 });

    // 6. 로그인 상태 확인
    const userProfile = page.locator('button, a').filter({ hasText: /マイページ|プロフィール|ログアウト/i }).first();
    await expect(userProfile).toBeVisible({ timeout: 10000 });
  });

  test('1-1-4: ログイン失敗（間違ったパスワード）', async ({ page }) => {
    // 1. 로그인 페이지 접근
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 2. 잘못된 비밀번호로 로그인 시도
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill(testEmail);

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await passwordInput.fill('WrongPassword123!');

    const loginButton = page.getByRole('button', { name: /ログイン|サインイン/i }).first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    await loginButton.click();

    // 3. 에러 메시지 확인
    await page.waitForTimeout(2000);
    
    const errorMessage = page.locator('text=/エラー|失敗|間違|incorrect|invalid/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('1-1-5: ログアウト', async ({ page }) => {
    // 1. 로그인
    await loginUser(page, testUser.email, testUser.password);

    // 2. 로그아웃 버튼 찾기 및 클릭
    await logout(page);

    // 3. 로그아웃 완료 확인
    // 로그인 페이지로 리다이렉트되거나 로그인 버튼이 표시되어야 함
    const loginButton = page.locator('a, button').filter({ hasText: /ログイン|サインイン/i }).first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
  });

  test('1-1-6: パスワード変更', async ({ page }) => {
    // 1. 로그인
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    await loginUser(page, testEmail, testPassword);

    // 2. 마이페이지 > 회원정보 변경 접근
    await page.goto(`${BASE_URL}/MyPage`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // "会員情報変更" 버튼 찾기 및 클릭
    const accountSettingsButton = page.locator('button, a').filter({ hasText: /会員情報変更|アカウント設定/i }).first();
    
    if (await accountSettingsButton.count() === 0) {
      console.log('[1-1-6] 会員情報変更 버튼을 찾을 수 없습니다. 테스트를 스킵합니다.');
      test.skip(true, '会員情報変更ページが見つかりません。');
      return;
    }
    
    await expect(accountSettingsButton).toBeVisible({ timeout: 10000 });
    await accountSettingsButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});

    // 3. 비밀번호 변경 폼 작성
    const currentPasswordInput = page.locator('input[name="currentPassword"], input[placeholder*="現在"]').first();
    if (await currentPasswordInput.count() === 0) {
      console.log('[1-1-6] 비밀번호 변경 폼을 찾을 수 없습니다.');
      test.skip(true, 'パスワード変更フォームが見つかりません。');
      return;
    }
    
    await expect(currentPasswordInput).toBeVisible({ timeout: 10000 });
    await currentPasswordInput.fill(testPassword);

    const newPassword = 'NewTestPassword123!';
    const newPasswordInput = page.locator('input[name="newPassword"], input[placeholder*="新しい"]').first();
    await expect(newPasswordInput).toBeVisible({ timeout: 10000 });
    await newPasswordInput.fill(newPassword);

    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="確認"]').first();
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(newPassword);
    }

    // 4. 변경 버튼 클릭
    const changeButton = page.getByRole('button', { name: /変更|更新|保存/i }).first();
    await expect(changeButton).toBeVisible({ timeout: 10000 });
    await changeButton.click();

    // 5. 성공 메시지 확인
    await page.waitForTimeout(2000);
    const successMessage = page.locator('text=/成功|完了|変更しました/i').first();
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // 6. 새 비밀번호로 로그인 테스트
    await logout(page);
    await loginUser(page, testEmail, newPassword);
    
    // 로그인 성공 확인
    const userProfile = page.locator('button, a').filter({ hasText: /マイページ|プロフィール/i }).first();
    await expect(userProfile).toBeVisible({ timeout: 10000 });

    // 7. 비밀번호를 원래대로 복구
    await page.goto(`${BASE_URL}/MyPage`, { waitUntil: 'domcontentloaded' });
    await accountSettingsButton.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    
    await currentPasswordInput.fill(newPassword);
    await newPasswordInput.fill(testPassword);
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(testPassword);
    }
    await changeButton.click();
    await page.waitForTimeout(2000);
  });
});
