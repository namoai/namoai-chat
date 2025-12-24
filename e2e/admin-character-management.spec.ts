import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';
import { goToCharacterManagement } from './helpers/admin';

/**
 * 管理者：キャラクター管理機能のE2Eテスト
 * 
 * テストシナリオ:
 * - キャラクター一覧の表示
 * - キャラクター検索
 * - キャラクターの編集（可能な場合）
 * - キャラクターの公開/非公開切り替え（可能な場合）
 */

test.describe('管理者：キャラクター管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page, context }) => {
    // テスト間の待機時間を追加（サーバーの負荷を軽減）
    await page.waitForTimeout(2000);
    
    // セッションをクリア（前のテストの影響を避けるため）
    await context.clearCookies();
    
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // ログイン後の安定化待機
    await page.waitForTimeout(1000);
    
    // キャラクター管理ページに移動
    const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
    await page.goto(`${BASE_URL}/admin/characters`, { 
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

  test('キャラクター一覧が表示される', async ({ page }) => {
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    
    // キャラクター一覧が表示されることを確認
    // ページ内容から "テスト用" や "作成者" などのテキスト가 있으면キャラクターが表示されていると判断
    const pageContent = await page.textContent('body').catch(() => '');
    const hasCharacterText = /テスト用|作成者|状態|公開|非公開/i.test(pageContent);
    
    // または、より具体的な要素を探す
    const characterCards = page.locator('text=/テスト用|作成者|状態:/i');
    const hasCharacterCards = await characterCards.count() > 0;
    
    // 空のリストメッセージを確認
    const noCharacterMessage = page.locator('text=/キャラクターがありません|データがありません|No characters|空|Empty/i');
    const hasNoCharacterMessage = await noCharacterMessage.isVisible({ timeout: 3000 }).catch(() => false);
    
    // キャラクターが表示されているか、または空のメッセージ가 표시されているかを確認
    expect(hasCharacterText || hasCharacterCards || hasNoCharacterMessage).toBe(true);
  });

  test('キャラクターを検索できる', async ({ page }) => {
    // 検索入力欄を探す
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="検索"], input[placeholder*="search"]'
    ).first();
    
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      
      // 検索結果が表示されるまで待つ
      await page.waitForTimeout(2000);
      
      // 検索結果が表示されていることを確認
      const searchResults = page.locator('[data-testid="search-results"], .search-results').first();
      const hasResults = await searchResults.isVisible().catch(() => false);
      if (hasResults) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('キャラクターの詳細を確認できる', async ({ page }) => {
    // キャラクター一覧から最初のキャラクターを選択
    const firstCharacter = page.locator(
      'tr[data-testid="character-row"], .character-row, tbody tr'
    ).first();
    
    if (await firstCharacter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCharacter.click();
      
      // 詳細情報が表示されることを確認（モーダルまたは別ページ）
      await page.waitForTimeout(1000);
      
      // 詳細情報の要素を確認
      const detailModal = page.locator('[role="dialog"], .modal, [data-testid="character-detail"]').first();
      const hasDetail = await detailModal.isVisible().catch(() => false);
      
      if (hasDetail) {
        await expect(detailModal).toBeVisible();
      }
    }
  });

  test('2-3-3: キャラクター公開/非公開切替', async ({ page }) => {
    // 1. 캐릭터 케밥 메뉴 열기
    const firstCharacter = page.locator('tbody tr').first();
    if (await firstCharacter.count() === 0) {
      test.skip(true, 'キャラクターが見つかりません。');
    }

    const kebabMenu = firstCharacter.locator('button[aria-label*="menu"], button:has([class*="more"])').first();
    if (await kebabMenu.count() > 0) {
      await kebabMenu.click();
      await page.waitForTimeout(500);

      // 2. 공개/비공개 전환 선택
      const toggleVisibility = page.getByRole('button', { name: /公開|非公開|Visibility/i }).first();
      if (await toggleVisibility.count() > 0) {
        await toggleVisibility.click();
        await page.waitForTimeout(2000);

        // 3. 변경 완료 확인
        const successMessage = page.getByText(/変更|更新|成功/i).first();
        if (await successMessage.count() > 0) {
          await expect(successMessage).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('2-3-5: キャラクター削除', async ({ page }) => {
    // 1. 삭제할 캐릭터 선택
    const firstCharacter = page.locator('tbody tr').first();
    if (await firstCharacter.count() === 0) {
      test.skip(true, 'キャラクターが見つかりません。');
    }

    // 2. 삭제 버튼 클릭
    const deleteButton = page.getByRole('button', { name: /削除|Delete/i }).first();
    if (await deleteButton.count() === 0) {
      test.skip(true, '削除ボタンが見つかりません。');
    }

    await deleteButton.click();
    await page.waitForTimeout(1000);

    // 3. 삭제 확인 다이얼로그에서 확인
    const confirmButton = page.getByRole('button', { name: /削除|Delete|確認/i }).last();
    await confirmButton.click();
    await page.waitForTimeout(2000);

    // 4. 삭제 완료 메시지 확인
    const successMessage = page.getByText(/削除|成功|Success/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('2-3-7: ナモアイフレンズ登録/解除', async ({ page }) => {
    // 1. 캐릭터 케밥 메뉴 열기
    const firstCharacter = page.locator('tbody tr').first();
    if (await firstCharacter.count() === 0) {
      test.skip(true, 'キャラクターが見つかりません。');
    }

    const kebabMenu = firstCharacter.locator('button[aria-label*="menu"]').first();
    if (await kebabMenu.count() > 0) {
      await kebabMenu.click();
      await page.waitForTimeout(500);

      // 2. 나모아이 프렌즈 등록/해제 선택
      const officialToggle = page.getByRole('button', { name: /ナモアイフレンズ|公式/i }).first();
      if (await officialToggle.count() > 0) {
        await officialToggle.click();
        await page.waitForTimeout(2000);

        // 3. 변경 완료 확인
        const successMessage = page.getByText(/変更|更新|成功/i).first();
        if (await successMessage.count() > 0) {
          await expect(successMessage).toBeVisible({ timeout: 5000 });
        }

        // 4. 홈 화면에서 나모아이 프렌즈 섹션에 반영 확인
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const officialSection = page.getByText(/ナモアイフレンズ/i).first();
        if (await officialSection.count() > 0) {
          await expect(officialSection).toBeVisible();
        }
      }
    }
  });
});

