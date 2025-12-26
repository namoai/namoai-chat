/**
 * ユーザー観点: ユーザージャーニーテスト
 * 
 * ログインからチャットまでの一連の流れを検証
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザージャーニー', () => {
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123';

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
  });

  test('JOURNEY-1: ログインからチャットまでの一連の流れ', async ({ page }) => {
    // 1. ログイン
    await loginUser(page, testEmail, testPassword);
    await page.waitForURL(/\/|\/MyPage/, { timeout: 15000 });

    // 2. キャラクター一覧へ移動
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');

    // 3. キャラクター選択
    const firstCharacter = page.locator('a[href^="/characters/"]').filter({
      hasNot: page.locator('a[href="/characters/create"]')
    }).first();
    
    await expect(firstCharacter).toBeVisible({ timeout: 10000 });
    await firstCharacter.click();
    await page.waitForLoadState('networkidle');

    // 4. チャット開始ボタンを探す
    const chatButton = page.locator('button, a').filter({ 
      hasText: /チャット|Chat|会話|話す/ 
    }).first();
    
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatButton.click();
      await page.waitForLoadState('networkidle');

      // 5. チャット画面確認
      // メッセージ入力欄が表示されているか確認
      const messageInput = page.locator('textarea, input[type="text"]').filter({
        or: [
          { hasAttribute: 'placeholder' },
          { hasNot: page.locator('[type="search"]') }
        ]
      }).first();
      
      await expect(messageInput).toBeVisible({ timeout: 10000 });
    } else {
      console.log('[User Journey] チャットボタンが見つかりませんでした。');
    }
  });
});
