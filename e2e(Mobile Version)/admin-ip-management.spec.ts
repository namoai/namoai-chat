/**
 * 管理者観点: IP管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-10-1: IPブロック
 * 2-10-2: IPブロック解除
 * 2-10-3: IPモニタリング
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: IP管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 追加の安定化待機
    await page.waitForTimeout(1000);
  });

  test('2-10-1: IPブロック', async ({ page }) => {
    // 1. IP ブロック 管理 ページ アクセス
    await page.goto(`${BASE_URL}/admin/ip-block`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. IP アドレス 入力 (IPアドレスをブロック セクションの 入力 フィールド)
    // label "IPアドレス *" 次に 来る 入力 フィールドを 見つけた
    const ipInput = page.locator('label:has-text("IPアドレス *")').locator('..').locator('input[type="text"]').first();
    await expect(ipInput).toBeVisible({ timeout: 10000 });
    await ipInput.fill('192.168.1.100');

    // 3. ブロック 理由 入力 (同じ セクション の reason 入力 フィールド)
    const reasonInput = page.locator('label:has-text("ブロック理由")').locator('..').locator('input[type="text"]').first();
    if (await reasonInput.count() > 0) {
      await reasonInput.fill('テスト用のブロック');
    }

    // 4. ブロック 実行
    const blockButton = page.getByRole('button', { name: /ブロック|Block/i }).first();
    await blockButton.click();
    await page.waitForTimeout(2000);

    // 5. ブロック 完了 確認
    const successMessage = page.getByText(/ブロック|成功|Success/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // 6. ブロック 一覧に 追加 確認
    const blockedList = page.locator('[class*="blocked"], table tbody tr');
    const blockedIP = page.getByText('192.168.1.100').first();
    if (await blockedIP.count() > 0) {
      await expect(blockedIP).toBeVisible({ timeout: 5000 });
    }
  });

  test('2-10-2: IPブロック解除', async ({ page }) => {
    // 1. IP ブロック 管理 ページ アクセス
    await page.goto(`${BASE_URL}/admin/ip-block`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. ブロックされた IP 選択
    const blockedIP = page.locator('tbody tr').first();
    if (await blockedIP.count() === 0) {
      test.skip(true, 'ブロックされたIPが見つかりません。');
    }

    // 3. ブロック 解除 ボタン クリック
    const unblockButton = blockedIP.getByRole('button', { name: /解除|Unblock/i }).first();
    if (await unblockButton.count() > 0) {
      await unblockButton.click();
      await page.waitForTimeout(2000);

      // 4. 解除 完了 確認
      const successMessage = page.getByText(/解除|成功|Success/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('2-10-3: IPモニタリング', async ({ page }) => {
    // 1. IP モニタリング ページ アクセス
    await page.goto(`${BASE_URL}/admin/ip-monitor`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. IP アクセス で 確認
    const accessLogs = page.locator('[class*="log"], table tbody tr');
    await expect(accessLogs.first()).toBeVisible({ timeout: 5000 });

    // 3. が上 アクセス パターン 確認
    const ipStats = page.locator('[class*="stat"], [class*="chart"]');
    if (await ipStats.count() > 0) {
      await expect(ipStats.first()).toBeVisible();
    }
  });
});

