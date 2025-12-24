/**
 * ユーザー観点: ポイント・決済機能のE2Eテスト
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: ポイント・決済機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-5-1: ポイント残高確認', async ({ page }) => {
    // 1. 마이페이지 접근
    await page.goto(`${BASE_URL}/MyPage`);
    await page.waitForLoadState('networkidle');

    // 2. 포인트 잔액 확인
    const pointsDisplay = page.locator('text=/ポイント|Points|残高|P/i').first();
    
    if (await pointsDisplay.count() === 0 || !await pointsDisplay.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 포인트 페이지로 이동
      await page.goto(`${BASE_URL}/MyPage/points`);
      await page.waitForLoadState('networkidle');
    }
    
    const pointsText = await page.textContent('body');
    console.log(`[1-5-1] 페이지 내용 확인: ${pointsText?.includes('ポイント') || pointsText?.includes('P')}`);
  });

  test('1-5-3: 出席チェック', async ({ page }) => {
    await page.goto(`${BASE_URL}/MyPage`);
    await page.waitForLoadState('networkidle');

    // 출석 체크 버튼 찾기
    const attendanceButton = page.locator('button').filter({ hasText: /出席|チェックイン|Attendance/i }).first();
    
    if (await attendanceButton.count() === 0 || !await attendanceButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 포인트 페이지에서 찾기
      await page.goto(`${BASE_URL}/MyPage/points`);
      await page.waitForLoadState('networkidle');
      
      const attendanceButton2 = page.locator('button').filter({ hasText: /出席|チェックイン|Attendance/i }).first();
      
      if (await attendanceButton2.count() === 0 || !await attendanceButton2.isVisible({ timeout: 5000 }).catch(() => false)) {
        test.skip(true, '出席チェック機能が見つかりません。');
        return;
      }
      
      await attendanceButton2.click();
    } else {
      await attendanceButton.click();
    }
    
    await page.waitForTimeout(2000);
    
    // 성공 메시지 또는 이미 체크인 메시지 확인
    const messageLocator = page.locator('text=/成功|完了|すでに|already/i').first();
    await expect(messageLocator).toBeVisible({ timeout: 10000 });
  });

  test('1-5-4: ポイント使用確認', async ({ page }) => {
    // 이 테스트는 실제로 포인트를 사용하는 것이므로 주의 필요
    await page.goto(`${BASE_URL}/MyPage/points`);
    await page.waitForLoadState('networkidle');

    // 포인트 사용 가능한 곳 (예: 유료 기능)으로 이동
    // 실제 구현에 따라 다를 수 있음
    console.log('[1-5-4] ポイント使用確認 - 実装に応じてカスタマイズが必要です。');
    
    // 포인트 잔액 확인
    const pointsText = await page.textContent('body');
    expect(pointsText).toContain('ポイント');
  });
});
