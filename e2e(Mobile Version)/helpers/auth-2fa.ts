/**
 * 2FA (2段階 認証) 関連 ヘルパー すべき数
 */

import { Page, expect } from '@playwright/test';
import { authenticator } from 'otplib';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * TOTP コード 作成 (テスト用)
 * 
 * 主の: 実際 時 が します.
 * テスト 環境で 時 を 環境 変数または データがで がと します.
 */
export function generateTOTPCode(secret: string): string {
  authenticator.options = {
    window: [1, 1],
    step: 30,
  };
  return authenticator.generate(secret);
}

/**
 * 2FAが 活性化された アカウントで ログイン (がメール  2FA)
 */
export async function loginWith2FA(
  page: Page,
  email: string,
  password: string,
  twoFactorCode?: string
): Promise<void> {
  // 1. ログイン ページで 移動
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // 2. がメールと 回 入力
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);

  // 3. ログイン ボタン クリック
  const loginButton = page.locator('button:has-text("ログイン"), button[type="submit"]').first();
  await loginButton.click();

  // 4. 2FA コード 入力 が またはまたは 確認
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 2FA コード 入力 
    
    if (twoFactorCode) {
      // 5. 2FA コード 入力
      await twoFactorInput.fill(twoFactorCode);
      
      // 6. 確認 ボタン クリック
      const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
      await verifyButton.click();
      
      // 7. ログイン 完了 待機
      await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
    } else {
      // 2FA コードが 提供され ない 場合, がメールで コードを または
      // テストを スキップする 数 あるように エラーを 発生時
      throw new Error('2FA コードが します. テスト 環境で 2FA コードを 提供または, テスト用 アカウントの 2FAを 無効化.');
    }
  } else {
    // 2FAが ない 場合, 通常 ログイン 完了 待機
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}

/**
 * 2FAが 活性化された アカウントで ログイン (TOTP  2FA)
 * 
 * @param secret - TOTP 時  (環境 変数または データがで がと すべき)
 */
export async function loginWithTOTP(
  page: Page,
  email: string,
  password: string,
  totpSecret?: string
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // がメールと 回 入力
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);

  const loginButton = page.locator('button:has-text("ログイン"), button[type="submit"]').first();
  await loginButton.click();

  // 2FA コード 入力  確認
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    if (totpSecret) {
      // TOTP コード 作成 および 入力
      const totpCode = generateTOTPCode(totpSecret);
      await twoFactorInput.fill(totpCode);
      
      const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
      await verifyButton.click();
      
      await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
    } else {
      throw new Error('TOTP 時 が します. 環境 変数 ADMIN_TOTP_SECRETを 設定または, テスト用 アカウントの 2FAを 無効化.');
    }
  } else {
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}

/**
 * アップロード コードで ログイン
 */
export async function loginWithBackupCode(
  page: Page,
  email: string,
  password: string,
  backupCode: string
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);

  const loginButton = page.locator('button:has-text("ログイン"), button[type="submit"]').first();
  await loginButton.click();

  const twoFactorInput = page.locator('input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // アップロード コード 入力
    await twoFactorInput.fill(backupCode);
    
    const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
    await verifyButton.click();
    
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  } else {
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}








