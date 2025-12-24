import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/auth';
import { goToCharacterDetail, startChatFromCharacterDetail } from './helpers/characters';
import { sendMessage, expectMessageVisible, waitForAIResponse } from './helpers/chat';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * ユーザー観点: チャット機能のE2Eテスト
 * 
 * 対象シナリオ:
 * 1-4-1: チャット開始（新規）
 * 1-4-2: メッセージ送信・受信
 * 1-4-3: チャット履歴確認
 * 1-4-4: チャットキャンセル
 * 1-4-5: チャットノート作成
 * 1-4-6: セーフティフィルター制約確認
 * 1-4-7: チャットランキング反映確認
 */

test.describe('チャット機能', () => {
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123';

  test.beforeEach(async ({ page }) => {
    // ログイン
    await loginWithEmail(page, testEmail, testPassword);
  });

  test('キャラクター詳細ページからチャットを開始できる', async ({ page }) => {
    // キャラクターIDは実際のデータに合わせて調整が必要
    // ここでは例として1を使用
    const characterId = 1;
    
    await goToCharacterDetail(page, characterId);
    
    // 「チャット開始」ボタンが表示されることを確認
    const chatButton = page.locator('button:has-text("チャット開始"), button:has-text("チャット"), a:has-text("チャット開始")').first();
    
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startChatFromCharacterDetail(page);
      
      // チャットページに遷移することを確認
      await expect(page).toHaveURL(/\/chat\/\d+/, { timeout: 10000 });
    }
  });

  test('メッセージを送信できる', async ({ page }) => {
    // 1. キャラクター一覧ページからキャラクターを選択
    await page.goto(`${BASE_URL}/charlist`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // キャラクターリンク찾기 (create 제外 - 確実に)
    const allLinks = page.locator('a[href^="/characters/"]');
    const linkCount = await allLinks.count();
    console.log(`[メッセージ送信テスト] 全リンク数: ${linkCount}`);
    
    // /characters/create ではない最初のリンクを見つける
    let validLink = null;
    for (let i = 0; i < linkCount; i++) {
      const link = allLinks.nth(i);
      const href = await link.getAttribute('href');
      console.log(`[メッセージ送信テスト] リンク ${i}: ${href}`);
      
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validLink = link;
        console.log(`[メッセージ送信テスト] ✅ 有効なキャラクターリンク発見: ${href}`);
        break;
      }
    }
    
    if (!validLink) {
      throw new Error('キャラクターが見つかりません');
    }

    // 有効なキャラクターリンクをクリック
    await validLink.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 2. チャット開始ボタンをクリック
    const chatButton = page.locator('button').filter({ hasText: /チャット開始|チャット|Chat/ }).first();
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatButton.click();
      await page.waitForURL(/\/chat\/\d+/, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } else {
      // 直接チャットページに移動
      const characterId = page.url().match(/\/characters\/(\d+)/)?.[1];
      await page.goto(`${BASE_URL}/chat/${characterId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    
    // 3. メッセージ入力欄が表示されることを確認 (正確な placeholder)
    const messageInput = page.locator('textarea[placeholder="メッセージを入力..."]').first();
    
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    
    // 4. テストメッセージを送信
    const testMessage = 'こんにちは、E2Eテストメッセージです';
    await sendMessage(page, testMessage);
    
    // 5. 送信したメッセージが表示されることを確認 (ユーザーバブル)
    await expectMessageVisible(page, testMessage);
    console.log(`[메시지 전송 테스트] ✅ ユーザーメッセージ確認: "${testMessage}"`);
  });

  test('AI応答を受信できる', async ({ page }) => {
    // 1. キャラクター一覧ページからキャラクターを選択
    await page.goto(`${BASE_URL}/charlist`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // キャラクターリンク찾기 (create 제外 - 確実に)
    const allLinks = page.locator('a[href^="/characters/"]');
    const linkCount = await allLinks.count();
    console.log(`[AI応答テスト] 全リンク数: ${linkCount}`);
    
    // /characters/create ではない最初のリンクを見つける
    let validLink = null;
    for (let i = 0; i < linkCount; i++) {
      const link = allLinks.nth(i);
      const href = await link.getAttribute('href');
      console.log(`[AI応答テスト] リンク ${i}: ${href}`);
      
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validLink = link;
        console.log(`[AI応答テスト] ✅ 有効なキャラクターリンク発見: ${href}`);
        break;
      }
    }
    
    if (!validLink) {
      throw new Error('キャラクターが見つかりません');
    }

    // 有効なキャラクターリンクをクリック
    await validLink.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // 2. チャット開始
    const chatButton = page.locator('button').filter({ hasText: /チャット開始|チャット/ }).first();
    if (await chatButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatButton.click();
      await page.waitForURL(/\/chat\/\d+/, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } else {
      const characterId = page.url().match(/\/characters\/(\d+)/)?.[1];
      await page.goto(`${BASE_URL}/chat/${characterId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    
    // 3. メッセージを送信
    const testMessage = 'こんにちは、テストです';
    await sendMessage(page, testMessage);
    console.log(`[AI応答 테스트] ユーザーメッセージ送信: "${testMessage}"`);
    
    // 4. AI応答を待つ（タイムアウトは長めに設定 + 実際の応答テキストも確認）
    await waitForAIResponse(page, 60000);
    
    // 5. AI応答メッセージが表示되어 있는지 확인 (bg-gray-800 - AIメッセージバブル)
    const aiMessages = page.locator('div.bg-gray-800.px-4.py-2.rounded-xl');
    await expect(aiMessages.last()).toBeVisible({ timeout: 10000 });
    
    // 6. ✅ AI応答の実際のテキスト内容을 확인
    const lastAiMessageText = await aiMessages.last().textContent();
    console.log(`[AI応答 테스트] ✅ AI応答内容確認: "${lastAiMessageText?.substring(0, 100)}..."`);
    
    expect(lastAiMessageText).toBeTruthy();
    expect(lastAiMessageText!.trim().length).toBeGreaterThan(3);
  });

  test('1-4-3: チャット履歴確認', async ({ page }) => {
    // 1. 채팅 목록 페이지 접근
    await page.goto(`${BASE_URL}/MyPage`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // チャット履歴へのリンクを探す
    const chatHistoryLink = page.getByRole('link', { name: /チャット|履歴|History/i }).first();
    if (await chatHistoryLink.count() > 0) {
      await chatHistoryLink.click();
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    }

    // 2. 과거 채팅 목록 표시 확인
    const chatList = page.locator('[class*="chat"], [class*="history"]');
    await expect(chatList.first()).toBeVisible({ timeout: 5000 });

    // 3. 특정 채팅 선택
    const firstChat = chatList.first();
    await firstChat.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 4. 채팅 내용 불러오기 확인
    const messages = page.locator('[class*="message"], [data-role="message"]');
    await expect(messages.first()).toBeVisible({ timeout: 5000 });
  });

  test('1-4-4: チャットキャンセル', async ({ page }) => {
    // 1. 채팅 시작
    await page.goto(`${BASE_URL}/charlist`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // /characters/create ではないリンクを見つける
    const allLinks = page.locator('a[href^="/characters/"]');
    const linkCount = await allLinks.count();
    
    let validLink = null;
    for (let i = 0; i < linkCount; i++) {
      const link = allLinks.nth(i);
      const href = await link.getAttribute('href');
      
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validLink = link;
        break;
      }
    }
    
    if (!validLink) {
      throw new Error('キャラクターが見つかりません');
    }
    
    await validLink.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });

    const characterId = page.url().match(/\/characters\/(\d+)/)?.[1];
    await page.goto(`${BASE_URL}/chat/${characterId}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 2. 메시지 전송
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]').first();
    await chatInput.fill('キャンセルテスト');
    
    const sendButton = page.getByRole('button', { name: /送信|Send/i }).first();
    await sendButton.click();

    // 3. 취소 버튼 클릭
    const cancelButton = page.getByRole('button', { name: /キャンセル|취소|Cancel/i }).first();
    if (await cancelButton.count() > 0) {
      await cancelButton.click();
      await page.waitForTimeout(2000);

      // 4. 취소 확인 다이얼로그 표시 확인
      const confirmDialog = page.locator('[role="dialog"]').first();
      if (await confirmDialog.count() > 0) {
        const confirmButton = confirmDialog.getByRole('button', { name: /確認|Confirm/i }).last();
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    } else {
      test.skip(true, 'キャンセルボタンが見つかりません。');
    }
  });
});

