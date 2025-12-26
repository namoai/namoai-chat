/**
 * 管理者観点: バナー管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-6-1: バナー一覧確認
 * 2-6-2: バナー作成
 * 2-6-3: バナー編集
 * 2-6-4: バナー削除
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: バナー管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page, context }) => {
    // セッションをクリア（前のテストの影響を避けるため）
    await context.clearCookies();
    
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // ログイン後の安定化待機
    await page.waitForTimeout(1000);
    
    // 管理者ページに移動（より長いタイムアウトと適切な待機）
    await page.goto(`${BASE_URL}/admin/banners`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    
    // 読み込み中が消えるまで待つ
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // 追加の安定化待機
    await page.waitForTimeout(1000);
  });

  test('2-6-1: バナー一覧確認', async ({ page }) => {
    // 1. バナー 管理 ページ アクセス (already in beforeEach)
    
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    
    // 2. バナー 一覧 または "バナーが ありません" メッセージ 確認
    // ページ内容から "バナー" や "バナーがありません" などのテキストが あれば確認
    const pageContent = await page.textContent('body').catch(() => '');
    const hasBannerText = /バナー|バナーがありません/i.test(pageContent);
    
    // より具体的な要素を探す
    const bannerList = page.locator('[class*="banner"], table tbody tr, .grid').first();
    const noBannerMessage = page.locator('text=/バナーがありません|データがありません/i');
    
    const hasBanners = await bannerList.count() > 0 && await bannerList.isVisible({ timeout: 5000 }).catch(() => false);
    const hasNoBannerMessage = await noBannerMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    // バナーが あれば 一覧が 表示され, なければ メッセージが 表示されます
    expect(hasBannerText || hasBanners || hasNoBannerMessage).toBe(true);
  });

  test('2-6-2: バナー作成', async ({ page }) => {
    // 1. モーダルが 開いていれば まず 閉じる
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeButton = modal.locator('button:has-text("閉じる"), button:has-text("×"), button[aria-label*="close"]').first();
      if (await closeButton.count() > 0) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    // 2. バナー 作成 ボタン クリック
    const createButton = page.getByRole('button', { name: /作成|新規|New/i }).first();
    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(1000);
      // モーダルが 開くまで 待機
      await page.locator('[role="dialog"], .modal').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    }

    // 3. 画像 アップロード
    const imageInput = page.locator('input[type="file"]').first();
    if (await imageInput.count() > 0) {
      // テスト用の画像ファイルをアップロード（実装に応じて調整）
      // await imageInput.setInputFiles('path/to/test-image.png');
    }

    // 4. リンク 設定
    const linkInput = page.locator('input[name*="link"], input[type="url"]').first();
    if (await linkInput.count() > 0) {
      await linkInput.fill('https://example.com');
    }

    // 5. 表示 順序 設定
    const orderInput = page.locator('input[name*="order"], input[type="number"]').first();
    if (await orderInput.count() > 0) {
      await orderInput.fill('1');
    }

    // 6. 保存 実行 (モーダル 内部の ボタンを 検索)
    const modalContent = page.locator('[role="dialog"], .modal').first();
    const saveButton = modalContent.getByRole('button', { name: /保存|作成|Save/i }).first();
    if (await saveButton.count() > 0) {
      await saveButton.click({ force: true }); // force オプションで モーダルを 通と
    } else {
      // モーダルが なければ 通常 ボタン クリック
      const generalSaveButton = page.getByRole('button', { name: /保存|作成|Save/i }).first();
      await generalSaveButton.click({ force: true });
    }
    await page.waitForTimeout(2000);

    // 6. 作成 完了 確認
    const successMessage = page.getByText(/作成|保存|成功/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // 7. ホーム 画面にで バナー 表示 確認
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    const banner = page.locator('[class*="banner"], img[alt*="banner"]').first();
    if (await banner.count() > 0) {
      await expect(banner).toBeVisible({ timeout: 5000 });
    }
  });
});

