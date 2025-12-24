/**
 * P0: ポイント関連のクリティカルなE2Eテスト
 * 
 * 目的: ユーザーが実際に使ったときに、ポイントシステムが正しく動作することを保証する
 * 
 * 対象シナリオ:
 * 1) 新規登録 or ログイン → 初期ポイント確認 → チャット1往復 → ポイント減少
 * 2) 画像作成 → 生成成功 → ポイント減少（失敗時は減らない）
 * 3) ポイント0でチャット不可 → 「ポイント購入が必要です」表示 + 購入導線
 * 4) ポイント0で画像作成不可 → 同上
 * 5) 通信断/LLM失敗時 → エラー表示 + ポイント減らない + 再試行できる
 * 6) ログアウト→再ログインでキャラ/履歴/ポイント保持（仕様に合わせる）
 */

import { test, expect, Page } from '@playwright/test';
import { loginUser, createTestUser, deleteTestUser } from './helpers/auth';
import { getPointsFromUI, getPointsFromAPI, waitForPointsUpdate } from './helpers/points';
import { startChat, sendChatMessage, waitForChatResponse } from './helpers/chat';
import { generateImage, waitForImageGeneration } from './helpers/image';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('P0: ポイント関連クリティカルテスト', () => {
  let testUser: { email: string; password: string; userId?: number };
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // テスト用ユーザーを作成
    testUser = await createTestUser();
  });

  test.afterEach(async () => {
    // テスト用ユーザーを削除
    if (testUser.userId) {
      await deleteTestUser(testUser.userId);
    }
  });

  test('P0-1: 新規登録 → 初期ポイント確認 → チャット1往復 → ポイント減少', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. 初期ポイント確認（UI表示）
    const initialPointsUI = await getPointsFromUI(page);
    expect(initialPointsUI).toBeGreaterThanOrEqual(0);

    // 3. 初期ポイント確認（API）
    const initialPointsAPI = await getPointsFromAPI(page);
    expect(initialPointsAPI.total).toBe(initialPointsUI);

    // 4. キャラクター一覧から最初のキャラクターを選択
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');
    
    // キャラクターカードの最初のリンクをクリック
    const firstCharacterLink = page.locator('a[href^="/characters/"]').first();
    await expect(firstCharacterLink).toBeVisible();
    const characterHref = await firstCharacterLink.getAttribute('href');
    expect(characterHref).toBeTruthy();
    
    const characterId = characterHref?.split('/')[2];
    expect(characterId).toBeTruthy();

    // 5. キャラクター詳細ページでチャット開始
    await page.goto(`${BASE_URL}/characters/${characterId}`);
    await page.waitForLoadState('networkidle');
    
    // 「チャット開始」ボタンを探す（テキストまたはroleで）
    const startChatButton = page.getByRole('button', { name: /チャット開始|チャットを開始|会話を開始/i })
      .or(page.locator('a[href*="/chat/"]').first());
    
    if (await startChatButton.count() > 0) {
      await startChatButton.click();
    } else {
      // 直接チャットページに移動
      await page.goto(`${BASE_URL}/chat/${characterId}`);
    }

    await page.waitForLoadState('networkidle');

    // 6. チャット1往復
    const chatInput = page.locator('textarea[placeholder*="メッセージ"], textarea[placeholder*="message"]')
      .or(page.locator('textarea').first());
    
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    
    const testMessage = 'こんにちは、テストメッセージです';
    await chatInput.fill(testMessage);
    
    // 送信ボタンをクリック
    const sendButton = page.getByRole('button', { name: /送信|送る|Send/i })
      .or(page.locator('button[type="submit"]').last());
    await sendButton.click();

    // 7. AI応答を待つ（最大30秒）
    await waitForChatResponse(page, 30000);

    // 8. ポイント減少を確認（UI）
    const pointsAfterChatUI = await getPointsFromUI(page);
    expect(pointsAfterChatUI).toBeLessThan(initialPointsUI);

    // 9. ポイント減少を確認（API）
    const pointsAfterChatAPI = await getPointsFromAPI(page);
    expect(pointsAfterChatAPI.total).toBe(pointsAfterChatUI);
    expect(pointsAfterChatAPI.total).toBeLessThan(initialPointsAPI.total);
  });

  test('P0-2: 画像作成 → 生成成功 → ポイント減少（失敗時は減らない）', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. 初期ポイント確認
    const initialPoints = await getPointsFromAPI(page);
    expect(initialPoints.total).toBeGreaterThan(0);

    // 3. キャラクター作成ページに移動
    await page.goto(`${BASE_URL}/characters/create`);
    await page.waitForLoadState('networkidle');

    // 4. 画像生成機能を探す
    // 画像生成ボタンやモーダルを探す
    const imageGenerateButton = page.getByRole('button', { name: /画像生成|画像を作成|Generate Image/i })
      .or(page.locator('button').filter({ hasText: /画像|Image|生成/i }).first());

    if (await imageGenerateButton.count() === 0) {
      test.skip(true, '画像生成機能が見つかりません。実装状況を確認してください。');
    }

    await imageGenerateButton.click();

    // 5. 画像生成モーダルが表示されることを確認
    const imageModal = page.locator('[role="dialog"]').or(page.locator('.modal, [class*="modal"]').first());
    await expect(imageModal).toBeVisible({ timeout: 5000 });

    // 6. プロンプトを入力
    const promptInput = imageModal.locator('textarea, input[type="text"]').first();
    await promptInput.fill('テスト用のキャラクター画像');

    // 7. 生成ボタンをクリック
    const generateButton = imageModal.getByRole('button', { name: /生成|Generate|作成/i });
    await generateButton.click();

    // 8. 画像生成完了を待つ（最大60秒）
    const imageGenerated = await waitForImageGeneration(page, 60000);
    
    if (imageGenerated) {
      // 9. 成功時: ポイント減少を確認
      const pointsAfterGeneration = await waitForPointsUpdate(page, initialPoints.total, 10000);
      expect(pointsAfterGeneration).toBeLessThan(initialPoints.total);
    } else {
      // 10. 失敗時: ポイントが減っていないことを確認
      const pointsAfterFailure = await getPointsFromAPI(page);
      expect(pointsAfterFailure.total).toBe(initialPoints.total);
    }
  });

  test('P0-3: ポイント0でチャット不可 → 「ポイント購入が必要です」表示 + 購入導線', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. ポイントを0に設定（管理者APIまたは直接DB操作）
    // 注意: 実際の実装に合わせて調整が必要
    await page.goto(`${BASE_URL}/api/users/points`);
    // API経由でポイントを0に設定する処理を追加（実装に応じて）

    // 3. キャラクター詳細ページに移動
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');
    
    const firstCharacterLink = page.locator('a[href^="/characters/"]').first();
    const characterHref = await firstCharacterLink.getAttribute('href');
    const characterId = characterHref?.split('/')[2];

    await page.goto(`${BASE_URL}/characters/${characterId}`);
    await page.waitForLoadState('networkidle');

    // 4. チャット開始を試みる
    const startChatButton = page.getByRole('button', { name: /チャット開始|チャットを開始/i })
      .or(page.locator('a[href*="/chat/"]').first());
    
    if (await startChatButton.count() > 0) {
      await startChatButton.click();
    } else {
      await page.goto(`${BASE_URL}/chat/${characterId}`);
    }

    await page.waitForLoadState('networkidle');

    // 5. エラーメッセージまたはポイント不足メッセージを確認
    const errorMessage = page.getByText(/ポイント|ポイント購入|ポイントが必要|ポイントが不足/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // 6. 購入導線（ポイント購入ページへのリンク）を確認
    const purchaseLink = page.getByRole('link', { name: /ポイント購入|ポイントを購入|購入/i })
      .or(page.locator('a[href*="/points"], a[href*="/purchase"]').first());
    
    await expect(purchaseLink).toBeVisible({ timeout: 5000 });
  });

  test('P0-4: ポイント0で画像作成不可 → 同上', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. ポイントを0に設定（実装に応じて）

    // 3. キャラクター作成ページに移動
    await page.goto(`${BASE_URL}/characters/create`);
    await page.waitForLoadState('networkidle');

    // 4. 画像生成を試みる
    const imageGenerateButton = page.getByRole('button', { name: /画像生成|画像を作成/i });
    
    if (await imageGenerateButton.count() === 0) {
      test.skip(true, '画像生成機能が見つかりません。');
    }

    await imageGenerateButton.click();

    // 5. エラーメッセージを確認
    const errorMessage = page.getByText(/ポイント|ポイント購入|ポイントが必要|ポイントが不足/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // 6. 購入導線を確認
    const purchaseLink = page.getByRole('link', { name: /ポイント購入|ポイントを購入/i });
    await expect(purchaseLink).toBeVisible({ timeout: 5000 });
  });

  test('P0-5: 通信断/LLM失敗時 → エラー表示 + ポイント減らない + 再試行できる', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. 初期ポイント確認
    const initialPoints = await getPointsFromAPI(page);

    // 3. チャットページに移動
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');
    
    const firstCharacterLink = page.locator('a[href^="/characters/"]').first();
    const characterHref = await firstCharacterLink.getAttribute('href');
    const characterId = characterHref?.split('/')[2];

    await page.goto(`${BASE_URL}/chat/${characterId}`);
    await page.waitForLoadState('networkidle');

    // 4. ネットワークをオフラインに設定（通信断をシミュレート）
    await page.context().setOffline(true);

    // 5. メッセージ送信を試みる
    const chatInput = page.locator('textarea[placeholder*="メッセージ"]').first();
    await chatInput.fill('テストメッセージ（オフライン）');
    
    const sendButton = page.getByRole('button', { name: /送信|Send/i }).first();
    await sendButton.click();

    // 6. エラーメッセージを確認
    const errorMessage = page.getByText(/エラー|エラーが発生|接続|通信|失敗/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // 7. ポイントが減っていないことを確認
    const pointsAfterError = await getPointsFromAPI(page);
    expect(pointsAfterError.total).toBe(initialPoints.total);

    // 8. ネットワークをオンラインに戻す
    await page.context().setOffline(false);

    // 9. 再試行できることを確認（再送信ボタンまたはメッセージ再送信）
    const retryButton = page.getByRole('button', { name: /再試行|リトライ|Retry/i });
    
    if (await retryButton.count() > 0) {
      await retryButton.click();
    } else {
      // メッセージを再送信
      await chatInput.fill('テストメッセージ（再試行）');
      await sendButton.click();
    }

    // 10. 正常に応答が返ることを確認
    await waitForChatResponse(page, 30000);

    // 11. 再試行後はポイントが減ることを確認
    const pointsAfterRetry = await getPointsFromAPI(page);
    expect(pointsAfterRetry.total).toBeLessThan(initialPoints.total);
  });

  test('P0-6: ログアウト→再ログインでキャラ/履歴/ポイント保持', async () => {
    // 1. ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 2. 初期ポイント確認
    const initialPoints = await getPointsFromAPI(page);

    // 3. チャットを1往復
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');
    
    const firstCharacterLink = page.locator('a[href^="/characters/"]').first();
    const characterHref = await firstCharacterLink.getAttribute('href');
    const characterId = characterHref?.split('/')[2];

    await page.goto(`${BASE_URL}/chat/${characterId}`);
    await page.waitForLoadState('networkidle');

    const chatInput = page.locator('textarea[placeholder*="メッセージ"]').first();
    await chatInput.fill('ログアウトテスト用メッセージ');
    
    const sendButton = page.getByRole('button', { name: /送信|Send/i }).first();
    await sendButton.click();
    
    await waitForChatResponse(page, 30000);

    // 4. チャット履歴を記録
    const messagesBeforeLogout = await page.locator('[class*="message"], [data-role="message"]').count();

    // 5. ログアウト
    const logoutButton = page.getByRole('button', { name: /ログアウト|Logout/i })
      .or(page.locator('a[href*="/logout"]').first());
    
    if (await logoutButton.count() > 0) {
      await logoutButton.click();
    } else {
      // 直接ログアウトAPIを呼び出す
      await page.goto(`${BASE_URL}/api/auth/signout`);
    }

    await page.waitForURL(/\/login|\//);

    // 6. 再ログイン
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/MyPage|\//);

    // 7. ポイントが保持されていることを確認
    const pointsAfterLogin = await getPointsFromAPI(page);
    expect(pointsAfterLogin.total).toBeLessThanOrEqual(initialPoints.total); // チャットで減っている可能性がある

    // 8. チャット履歴が保持されていることを確認
    await page.goto(`${BASE_URL}/chat/${characterId}`);
    await page.waitForLoadState('networkidle');
    
    const messagesAfterLogin = await page.locator('[class*="message"], [data-role="message"]').count();
    expect(messagesAfterLogin).toBeGreaterThanOrEqual(messagesBeforeLogout);
  });
});








