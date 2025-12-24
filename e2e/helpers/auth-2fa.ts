/**
 * 2FA (2단계 인증) 관련 헬퍼 함수
 */

import { Page, expect } from '@playwright/test';
import { authenticator } from 'otplib';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * TOTP 코드 생성 (테스트용)
 * 
 * 주의: 실제 시크릿 키가 필요합니다.
 * 테스트 환경에서는 시크릿 키를 환경 변수나 데이터베이스에서 가져와야 합니다.
 */
export function generateTOTPCode(secret: string): string {
  authenticator.options = {
    window: [1, 1],
    step: 30,
  };
  return authenticator.generate(secret);
}

/**
 * 2FA가 활성화된 계정으로 로그인 (이메일 기반 2FA)
 */
export async function loginWith2FA(
  page: Page,
  email: string,
  password: string,
  twoFactorCode?: string
): Promise<void> {
  // 1. 로그인 페이지로 이동
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // 2. 이메일과 비밀번호 입력
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);

  // 3. 로그인 버튼 클릭
  const loginButton = page.locator('button:has-text("ログイン"), button[type="submit"]').first();
  await loginButton.click();

  // 4. 2FA 코드 입력 화면이 나타나는지 확인
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 2FA 코드 입력 필요
    
    if (twoFactorCode) {
      // 5. 2FA 코드 입력
      await twoFactorInput.fill(twoFactorCode);
      
      // 6. 확인 버튼 클릭
      const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
      await verifyButton.click();
      
      // 7. 로그인 완료 대기
      await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
    } else {
      // 2FA 코드가 제공되지 않은 경우, 이메일에서 코드를 기다리거나
      // 테스트를 스킵할 수 있도록 에러를 발생시킴
      throw new Error('2FA 코드가 필요합니다. 테스트 환경에서 2FA 코드를 제공하거나, 테스트용 계정의 2FA를 비활성화하세요.');
    }
  } else {
    // 2FA가 없는 경우, 일반 로그인 완료 대기
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}

/**
 * 2FA가 활성화된 계정으로 로그인 (TOTP 기반 2FA)
 * 
 * @param secret - TOTP 시크릿 키 (환경 변수나 데이터베이스에서 가져와야 함)
 */
export async function loginWithTOTP(
  page: Page,
  email: string,
  password: string,
  totpSecret?: string
): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  // 이메일과 비밀번호 입력
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);

  const loginButton = page.locator('button:has-text("ログイン"), button[type="submit"]').first();
  await loginButton.click();

  // 2FA 코드 입력 화면 확인
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    if (totpSecret) {
      // TOTP 코드 생성 및 입력
      const totpCode = generateTOTPCode(totpSecret);
      await twoFactorInput.fill(totpCode);
      
      const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
      await verifyButton.click();
      
      await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
    } else {
      throw new Error('TOTP 시크릿 키가 필요합니다. 환경 변수 ADMIN_TOTP_SECRET를 설정하거나, 테스트용 계정의 2FA를 비활성화하세요.');
    }
  } else {
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}

/**
 * 백업 코드로 로그인
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
    // 백업 코드 입력
    await twoFactorInput.fill(backupCode);
    
    const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
    await verifyButton.click();
    
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  } else {
    await page.waitForURL(/\/($|MyPage|admin)/, { timeout: 10000 });
  }
}








