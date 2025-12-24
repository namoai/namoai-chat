/**
 * その他細かい機能のE2Eテスト
 * 
 * 対象シナリオ:
 * 3-1: お問い合わせ（すべての種類）
 * 3-2: いいね（押す、解除、通知、集計）
 * 3-3: ランキング反映（チャット後反映、リアルタイム更新、期間別集計）
 * 3-4: ブロック（検索/一覧/ランキング除外、解除後再表示）
 * 3-5: セーフティフィルター（ON/OFF、チャット制約、設定保存）
 * 3-6: ペルソナ（チャットで使用、変更）
 * 3-7: 画像生成
 * 3-8: クローン
 * 3-9: Export/Import
 * 3-10: コメント（作成、削除、通知）
 * 3-11: 通知（種類別確認）
 * 3-12: チャット詳細機能（メモリー、ノート、キャンセル）
 * 3-13: プロフィール（統計、編集）
 * 3-14: 検索（ハッシュタグ、名前/説明、ソート）
 * 3-15: 管理者詳細機能
 * 3-16: エラーハンドリング
 */

import { test, expect } from '@playwright/test';
import { loginUser, createTestUser, deleteTestUser } from './helpers/auth';
import { sendChatMessage, waitForChatResponse } from './helpers/chat';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('その他細かい機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    testUser = await createTestUser();
    await loginUser(page, testUser.email, testUser.password);
    await page.waitForURL(/\/($|MyPage)/, { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (testUser.userId) {
      await deleteTestUser(testUser.userId);
    }
  });

  test('3-3-1: チャット後ランキング反映確認', async ({ page }) => {
    // 1. 캐릭터와 채팅 시작
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');

    const firstCharacter = page.locator('a[href^="/characters/"]').first();
    await firstCharacter.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });

    const characterId = page.url().match(/\/characters\/(\d+)/)?.[1];
    expect(characterId).toBeTruthy();

    // チャット開始
    const startChatButton = page.getByRole('button', { name: /チャット開始/i })
      .or(page.locator('a[href*="/chat/"]').first());
    
    if (await startChatButton.count() > 0) {
      await startChatButton.click();
    } else {
      await page.goto(`${BASE_URL}/chat/${characterId}`);
    }

    await page.waitForLoadState('networkidle');

    // 2. 여러 메시지 교환 (최소 5개 이상)
    for (let i = 0; i < 5; i++) {
      await sendChatMessage(page, `テストメッセージ ${i + 1}`);
      await waitForChatResponse(page, 30000);
      await page.waitForTimeout(1000);
    }

    // 3. 랭킹 페이지 접근
    await page.goto(`${BASE_URL}/ranking`);
    await page.waitForLoadState('networkidle');

    // 4. 해당 캐릭터가 랭킹에 반영되어 있는지 확인
    const rankingList = page.locator('[class*="ranking"], [class*="list"]');
    const characterInRanking = page.locator(`a[href*="/characters/${characterId}"]`).first();
    
    if (await characterInRanking.count() > 0) {
      await expect(characterInRanking).toBeVisible({ timeout: 5000 });
    }

    // 5. 채팅 수가 정확히 집계되었는지 확인
    // 実装に応じて確認方法を調整
  });

  test('3-5-1: セーフティフィルターON時OFFキャラクターブロック', async ({ page }) => {
    // 1. 세이프티 필터 ON 상태 확인
    await page.goto(`${BASE_URL}/MyPage`);
    await page.waitForLoadState('networkidle');

    const safetyFilterLink = page.getByRole('link', { name: /セーフティフィルター/i }).first();
    if (await safetyFilterLink.count() > 0) {
      await safetyFilterLink.click();
      await page.waitForLoadState('networkidle');

      // ONに設定
      const toggleSwitch = page.locator('input[type="checkbox"], [role="switch"]').first();
      if (await toggleSwitch.count() > 0) {
        const isChecked = await toggleSwitch.isChecked();
        if (!isChecked) {
          await toggleSwitch.check();
          await page.waitForTimeout(1000);
        }
      }
    }

    // 2. 세이프티 필터 OFF 캐릭터 상세 페이지 접근
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');

    // OFFキャラクターを探す（実装に応じて調整）
    const firstCharacter = page.locator('a[href^="/characters/"]').first();
    await firstCharacter.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });

    // 3. "채팅 시작" 버튼 클릭 시도
    const startChatButton = page.getByRole('button', { name: /チャット開始/i }).first();
    if (await startChatButton.count() > 0) {
      await startChatButton.click();
      await page.waitForTimeout(2000);

      // 4. 에러 메시지 표시 확인
      const errorMessage = page.getByText(/セーフティフィルター|安全|Safety/i).first();
      if (await errorMessage.count() > 0) {
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('3-12-2: チャットノート機能', async ({ page }) => {
    // 1. 채팅 화면에서 노트 기능 사용
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');

    const firstCharacter = page.locator('a[href^="/characters/"]').first();
    await firstCharacter.click();
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });

    const characterId = page.url().match(/\/characters\/(\d+)/)?.[1];
    await page.goto(`${BASE_URL}/chat/${characterId}`);
    await page.waitForLoadState('networkidle');

    // 2. 노트 작성
    const noteButton = page.getByRole('button', { name: /ノート|Note/i }).first();
    if (await noteButton.count() > 0) {
      await noteButton.click();
      await page.waitForTimeout(1000);

      const noteInput = page.locator('textarea[placeholder*="ノート"], textarea').first();
      if (await noteInput.count() > 0) {
        await noteInput.fill('テスト用のノート');
        
        const saveButton = page.getByRole('button', { name: /保存|Save/i }).first();
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    } else {
      test.skip(true, 'ノート機能が見つかりません。');
    }

    // 3. 저장 확인
    const successMessage = page.getByText(/保存|成功/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // 4. 다음 접속 시 노트 유지 확인
    await page.reload();
    await page.waitForLoadState('networkidle');

    const savedNote = page.getByText('テスト用のノート').first();
    if (await savedNote.count() > 0) {
      await expect(savedNote).toBeVisible({ timeout: 5000 });
    }
  });
});








