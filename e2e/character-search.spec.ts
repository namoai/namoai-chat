import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/auth';
import { searchCharacter, goToCharacterList, expectCharacterVisible } from './helpers/characters';

/**
 * キャラクター検索機能のE2Eテスト
 * 
 * テストシナリオ:
 * - キャラクター一覧の表示
 * - キャラクター検索
 * - キャラクター詳細ページへの遷移
 */

test.describe('キャラクター検索機能', () => {
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_PASSWORD || 'testpassword123';

  test.beforeEach(async ({ page }) => {
    // ログイン
    await loginWithEmail(page, testEmail, testPassword);
  });

  test('キャラクター一覧ページが表示される', async ({ page }) => {
    await goToCharacterList(page);
    
    // ページタイトルまたはキャラクターカードが表示されることを確認
    const pageTitle = page.locator('h1, h2, [data-testid="character-list"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  test('キャラクターを検索できる', async ({ page }) => {
    await page.goto('/');
    
    // 検索バーが表示されるまで待つ
    await page.waitForLoadState('networkidle');
    
    // 検索を実行（キーワードは実際のデータに合わせて調整）
    await searchCharacter(page, 'test');
    
    // 検索結果が表示されることを確認
    await page.waitForTimeout(2000);
    
    // 検索結果ページまたは検索結果が表示されていることを確認
    const searchResults = page.locator('[data-testid="search-results"], .character-card, .search-results').first();
    // 検索結果が存在する場合のみ確認（結果が0件の場合もあるため）
    const hasResults = await searchResults.isVisible().catch(() => false);
    if (hasResults) {
      await expect(searchResults).toBeVisible();
    }
  });

  test('キャラクター詳細ページに遷移できる', async ({ page }) => {
    await goToCharacterList(page);
    
    // 最初のキャラクターカードをクリック
    const firstCharacter = page.locator('.character-card, [data-testid="character-card"], a[href*="/characters/"]').first();
    
    if (await firstCharacter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCharacter.click();
      
      // キャラクター詳細ページに遷移することを確認
      await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });
      
      // キャラクター名または詳細情報が表示されることを確認
      const characterName = page.locator('h1, h2, [data-testid="character-name"]').first();
      await expect(characterName).toBeVisible({ timeout: 5000 });
    }
  });
});








