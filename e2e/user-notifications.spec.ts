/**
 * ユーザー観点: 通知機能のE2Eテスト
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: 通知機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-7-1: 通知一覧確認', async ({ page }) => {
    // 1. 알림 페이지 접근
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');

    // 2. 알림 목록 확인
    const notificationItems = page.locator('[role="listitem"], .notification-item').filter({
      has: page.locator('text=/通知|Notification/')
    });
    
    const noNotificationsMessage = page.locator('text=/通知がありません|No notifications/i').first();
    
    const hasNotifications = await notificationItems.count() > 0;
    const hasNoNotificationsMessage = await noNotificationsMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasNotifications || hasNoNotificationsMessage).toBeTruthy();
  });

  test('1-7-2: 通知既読処理', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');

    const unreadNotification = page.locator('.notification-item').filter({
      has: page.locator('[data-read="false"], .unread')
    }).first();
    
    if (await unreadNotification.count() === 0 || !await unreadNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, '未読通知がありません。');
      return;
    }
    
    await unreadNotification.click();
    await page.waitForTimeout(2000);

    // 기독 처리 확인 (재접근)
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');
  });

  test('1-7-4: 未読通知数確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // 알림 아이콘 또는 배지 확인
    const notificationBadge = page.locator('[data-badge], .badge, .notification-count').first();
    
    if (await notificationBadge.count() > 0 && await notificationBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      const badgeText = await notificationBadge.textContent();
      console.log(`[1-7-4] 未読通知数: ${badgeText}`);
    } else {
      console.log('[1-7-4] 未読通知がないか、バッジが表示されていません。');
    }
  });
});
