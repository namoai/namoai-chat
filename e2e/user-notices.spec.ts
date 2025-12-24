/**
 * ユーザー観点: お知らせ・ガイド・約款のE2Eテスト
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: お知らせ・ガイド・約款', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-11-1: お知らせ一覧確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/notices`);
    await page.waitForLoadState('networkidle');

    const noticeItems = page.locator('[role="listitem"], .notice-item, article').filter({
      has: page.locator('text=/お知らせ|Notice|通知/')
    });
    
    const noNoticesMessage = page.locator('text=/お知らせがありません|No notices/i').first();
    
    const hasNotices = await noticeItems.count() > 0;
    const hasNoNoticesMessage = await noNoticesMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasNotices || hasNoNoticesMessage).toBeTruthy();
  });

  test('1-11-2: お知らせ詳細確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/notices`);
    await page.waitForLoadState('networkidle');

    const firstNotice = page.locator('a[href^="/notices/"]').first();
    
    if (await firstNotice.count() === 0 || !await firstNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'お知らせがありません。');
      return;
    }
    
    await firstNotice.click();
    await page.waitForLoadState('networkidle');

    const noticeTitle = page.locator('h1, h2').first();
    await expect(noticeTitle).toBeVisible({ timeout: 10000 });
  });

  test('1-11-3: ガイド確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/guide`);
    await page.waitForLoadState('networkidle');

    const guideContent = page.locator('h1, article, .guide-content').first();
    await expect(guideContent).toBeVisible({ timeout: 10000 });
  });

  test('1-11-4: 約款確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/terms`);
    await page.waitForLoadState('networkidle');

    const termsContent = page.locator('h1, article, .terms-content').first();
    await expect(termsContent).toBeVisible({ timeout: 10000 });
  });
});
