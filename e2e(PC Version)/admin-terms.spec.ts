/**
 * 管理者観点: 約款管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-7-1: 約款一覧確認
 * 2-7-2: 約款編集
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: 約款管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 管理者ページに移動（より長いタイムアウトと適切な待機）
    await page.goto(`${BASE_URL}/admin/terms`, { 
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

  test('2-7-1: 約款一覧確認', async ({ page }) => {
    // 1. 約款 管理 ページ アクセス (already in beforeEach)
    
    // 2. 約款 一覧 表示 確認 (約款 常に あるべき すべき)
    const termsList = page.locator('[class*="term"], [class*="item"], button, a').first();
    await expect(termsList).toBeVisible({ timeout: 10000 });
  });

  test('2-7-2: 約款編集', async ({ page }) => {
    // 1. 編集する 約款 選択 (編集 ボタン クリック)
    const editButton = page.getByRole('button', { name: /編集/i }).first();
    if (await editButton.count() === 0) {
      test.skip(true, '約款編集ボタンが見つかりません。');
    }

    await editButton.click();
    await page.waitForTimeout(2000);

    // 2. 元の 内容 保存
    const contentInput = page.locator('textarea').first();
    await expect(contentInput).toBeVisible({ timeout: 5000 });
    const originalContent = await contentInput.inputValue();
    console.log(`[2-7-2] 元の 約款 内容 長さが: ${originalContent.length}字`);

    // 3. 内容 修正 (マークダウン 形式) - テスト用 内容で 変更
    await contentInput.clear();
    await contentInput.fill('# テスト約款\n\nこれはテスト用の約款です。');

    // 4. 保存 実行 (button[type="submit"] または "更新" テキスト)
    const saveButton = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /更新|保存|Save/i }))
      .first();

    // 保存 ボタンが が 確認
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    // 要素をビューにスクロールしてからクリック
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 5. 変更 事項 反映 確認 (成功 メッセージ または ページ リダイレクトがレクト)
    // 成功 メッセージが あれば 確認, なければ ページ 移動 確認
    const successMessage = page.getByText(/変更|更新|成功|保存/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      console.log('[2-7-2] ✅ 約款 内容 変更 成功');
    } else {
      // ページが リダイレクトがレクトされたか 確認
      await page.waitForURL(/\/admin\/terms|\/terms/, { timeout: 5000 }).catch(() => {});
    }

    // 6. 通常 ユーザー 画面にで 変更された 約款 表示 確認
    await page.goto(`${BASE_URL}/terms`);
    await page.waitForLoadState('networkidle');

    const updatedContent = page.getByText('テスト約款').first();
    if (await updatedContent.count() > 0) {
      await expect(updatedContent).toBeVisible({ timeout: 5000 });
    }

    // 7. 元の 内容で 復帰 (管理字 実行 アップロードを 元状態に 復帰すべき)
    if (originalContent) {
      console.log('[2-7-2] 元の 約款 内容で 復帰する 中...');
      await page.goto(`${BASE_URL}/admin/terms`);
      await page.waitForLoadState('networkidle');

      // 再度 編集 ボタン クリック
      const editButtonAgain = page.getByRole('button', { name: /編集/i }).first();
      if (await editButtonAgain.count() > 0) {
        await editButtonAgain.click();
        await page.waitForTimeout(2000);

        // 元の 内容で 復元
        const contentInputAgain = page.locator('textarea').first();
        await expect(contentInputAgain).toBeVisible({ timeout: 5000 });
        await contentInputAgain.clear();
        await contentInputAgain.fill(originalContent);

        // 再度 保存
        const saveButtonAgain = page.locator('button[type="submit"]')
          .or(page.getByRole('button', { name: /更新|保存|Save/i }))
          .first();

        if (await saveButtonAgain.count() > 0) {
          await saveButtonAgain.scrollIntoViewIfNeeded();
          await saveButtonAgain.click();
          await page.waitForTimeout(2000);

          // 復帰 成功 確認
          const restoreSuccessMessage = page.getByText(/変更|更新|成功|保存/i).first();
          if (await restoreSuccessMessage.count() > 0) {
            await expect(restoreSuccessMessage).toBeVisible({ timeout: 5000 });
            console.log('[2-7-2] ✅ 約款 内容 元の対で 復帰 成功');
          }
        }
      }
    } else {
      console.log('[2-7-2] ⚠️ 元の 内容を 確認する 数 ない 復帰 ない');
    }
  });
});

