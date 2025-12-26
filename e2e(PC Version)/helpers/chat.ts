import { Page, expect } from '@playwright/test';

/**
 * チャット関連のヘルパー関数
 */

/**
 * チャットページに移動
 */
export async function goToChat(page: Page, characterId: number): Promise<void> {
  await page.goto(`/chat/${characterId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * メッセージを送信
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  // メッセージ入力欄を探す (正確な placeholder: "メッセージを入力...")
  const messageInput = page.locator('textarea[placeholder="メッセージを入力..."]').first();
  
  // 入力欄が表示されるまで待つ
  await expect(messageInput).toBeVisible({ timeout: 10000 });
  
  // 入力欄をビューにスクロール
  await messageInput.scrollIntoViewIfNeeded();
  
  // 少し待ってから入力（アニメーション完了を待つ）
  await page.waitForTimeout(300);
  
  await messageInput.fill(message);
  
  // 送信ボタンをクリック (Send アイコンがある button[type="submit"])
  const sendButton = page.locator('button[type="submit"]').filter({ has: page.locator('svg') }).first();
  
  // 送信ボタンが表示されるまで待つ
  await expect(sendButton).toBeVisible({ timeout: 10000 });
  
  // 送信ボタンが有効化される時まで 待機
  await sendButton.waitFor({ state: 'attached', timeout: 5000 });
  await page.waitForTimeout(300);
  
  // 送信ボタンをビューにスクロール
  await sendButton.scrollIntoViewIfNeeded();
  
  // 少し待ってからクリック
  await page.waitForTimeout(300);
  
  await sendButton.click();
  
  // メッセージが送信されるまで少し待つ
  await page.waitForTimeout(1000);
}

/**
 * メッセージが表示されていることを確認
 */
export async function expectMessageVisible(page: Page, message: string): Promise<void> {
  const messageElement = page.locator(`text=${message}`).first();
  await expect(messageElement).toBeVisible({ timeout: 10000 });
}

/**
 * AI応答が表示されるまで待つ（実際の応答テキストも確認）
 */
export async function waitForAIResponse(page: Page, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();
  
  // ローディングインジケーターが消えるまで待つ
  const loadingIndicator = page.locator('[data-testid="loading"], .loading, [aria-label*="loading"], text=/生成中|送信中|Loading/i').first();
  
  // ローディングが表示されている場合は消えるまで待つ
  if (await loadingIndicator.isVisible().catch(() => false)) {
    await expect(loadingIndicator).not.toBeVisible({ timeout });
  }
  
  // AI応答メッセージを探す (bg-gray-800 の div - AIメッセージのスタイル)
  // processedTurns の modelMessages を確認
  while (Date.now() - startTime < timeout) {
    // AI メッセージバブル (bg-gray-800 px-4 py-2 rounded-xl)
    const aiMessages = page.locator('div.bg-gray-800.px-4.py-2.rounded-xl');
    const aiMessageCount = await aiMessages.count();
    
    console.log(`[waitForAIResponse] AI メッセージ数: ${aiMessageCount}`);
    
    if (aiMessageCount > 0) {
      // 最後のAIメッセージのテキスト取得
      const lastAiMessage = aiMessages.last();
      const messageText = await lastAiMessage.textContent().catch(() => '');
      
      console.log(`[waitForAIResponse] 最後のAIメッセージ: "${messageText?.substring(0, 50)}..."`);
      
      // テキストが存在して の未ある 長さが 確認
      if (messageText && messageText.trim().length > 3) {
        console.log(`[waitForAIResponse] ✅ AI応答を確認しました: "${messageText?.substring(0, 100)}..."`);
        return;
      }
    }
    
    await page.waitForTimeout(500);
  }
  
  throw new Error(`AI応答がタイムアウトしました（${timeout}ms）`);
}

/**
 * チャットを開始（キャラクター詳細ページから）
 */
export async function startChat(page: Page, characterId: string | number): Promise<void> {
  await page.goto(`/chat/${characterId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * チャットメッセージを送信
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  const chatInput = page.locator('textarea[placeholder*="メッセージ"], textarea[placeholder*="message"]')
    .or(page.locator('textarea').first());
  
  await expect(chatInput).toBeVisible({ timeout: 10000 });
  await chatInput.fill(message);
  
  const sendButton = page.getByRole('button', { name: /送信|送る|Send/i })
    .or(page.locator('button[type="submit"]').last());
  
  await sendButton.click();
}

/**
 * チャット応答を待つ（AI応答が表示されるまで）
 * waitForAIResponseを 使用するように 変更
 */
export async function waitForChatResponse(page: Page, timeout: number = 30000): Promise<void> {
  // waitForAIResponseを 使用 (もっと 正確な AI メッセージ 検出)
  await waitForAIResponse(page, timeout);
}

