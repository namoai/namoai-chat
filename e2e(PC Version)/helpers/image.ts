/**
 * 画像生成関連のヘルパー関数
 */

import { Page, expect } from '@playwright/test';

/**
 * 画像生成を実行
 */
export async function generateImage(
  page: Page,
  prompt: string
): Promise<void> {
  // 画像生成モーダルまたはフォームを探す
  const imageModal = page.locator('[role="dialog"]').or(page.locator('.modal, [class*="modal"]').first());
  
  // プロンプト入力欄を探す
  const promptInput = imageModal.locator('textarea, input[type="text"]').first();
  await promptInput.fill(prompt);

  // 生成ボタンをクリック
  const generateButton = imageModal.getByRole('button', { name: /生成|Generate|作成/i });
  await generateButton.click();
}

/**
 * 画像生成が完了するまで待つ
 * @returns 生成成功した場合はtrue、失敗した場合はfalse
 */
export async function waitForImageGeneration(
  page: Page,
  timeout: number = 60000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // 成功メッセージまたは画像が表示されたか確認
    const successIndicator = page.getByText(/生成完了|生成成功|Generated|Success/i)
      .or(page.locator('img[src*="generated"], img[src*="image"]').first());
    
    if (await successIndicator.count() > 0 && await successIndicator.isVisible()) {
      return true;
    }

    // エラーメッセージが表示されたか確認
    const errorIndicator = page.getByText(/エラー|失敗|Error|Failed|生成に失敗/i);
    if (await errorIndicator.count() > 0 && await errorIndicator.isVisible()) {
      return false;
    }

    // ローディングインジケーターを確認
    const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-label*="loading"]');
    if (await loadingIndicator.count() > 0 && await loadingIndicator.isVisible()) {
      // まだ生成中
      await page.waitForTimeout(1000);
      continue;
    }

    // ローディングが終わったが結果が不明な場合、少し待って再確認
    await page.waitForTimeout(2000);
    
    // 再度成功/失敗を確認
    if (await successIndicator.count() > 0 && await successIndicator.isVisible()) {
      return true;
    }
    if (await errorIndicator.count() > 0 && await errorIndicator.isVisible()) {
      return false;
    }
  }

  // タイムアウト
  throw new Error(`画像生成がタイムアウトしました（${timeout}ms）`);
}








