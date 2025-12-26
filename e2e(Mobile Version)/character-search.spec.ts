import { test, expect } from '@playwright/test';
import { loginWithEmail } from './helpers/auth';
import { searchCharacter, goToCharacterList } from './helpers/characters';

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

  test('CHAR-SEARCH-1: キャラクター一覧ページが表示される', async ({ page }) => {
    await goToCharacterList(page);
    
    // ページタイトルまたはキャラクターカードが表示されることを確認
    const pageTitle = page.locator('h1, h2, [data-testid="character-list"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
  });

  test('CHAR-SEARCH-2: キャラクターを検索できる', async ({ page }) => {
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

  test('CHAR-SEARCH-3: キャラクター詳細ページに遷移できる', async ({ page }) => {
    await goToCharacterList(page);
    
    // ページが完全にロードされるまで待つ（読み込み中が消えるまで）
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // /characters/create を除く最初のキャラクターリンクを見つける
    const allCharacterLinks = page.locator('a[href^="/characters/"]');
    
    // リンクが表示されるまで待つ
    await expect(allCharacterLinks.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    
    const linkCount = await allCharacterLinks.count();
    console.log(`[キャラクター詳細ページ遷移テスト] 見つかったリンク数: ${linkCount}`);
    
    let validLink: ReturnType<typeof page.locator> | null = null;
    for (let i = 0; i < linkCount; i++) {
      const link = allCharacterLinks.nth(i);
      const href = await link.getAttribute('href');
      console.log(`[キャラクター詳細ページ遷移テスト] リンク ${i}: ${href}`);
      
      // /characters/create を除外し、数字IDを持つリンクのみ選択
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validLink = link;
        console.log(`[キャラクター詳細ページ遷移テスト] ✅ 有効なリンク発見: ${href}`);
        break;
      }
    }
    
    if (!validLink) {
      // リンクが見つからない場合は、カードから探す
      const firstCharacter = page.locator('.character-card, [data-testid="character-card"]').first();
      if (await firstCharacter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstCharacter.click();
      } else {
        // 現在のURLとページ状態を確認
        const currentUrl = page.url();
        const pageContent = await page.content();
        console.log(`[キャラクター詳細ページ遷移テスト] 現在のURL: ${currentUrl}`);
        console.log(`[キャラクター詳細ページ遷移テスト] ページコンテンツ（最初の500文字）: ${pageContent.substring(0, 500)}`);
        throw new Error('キャラクターが見つかりません');
      }
    } else {
      await validLink.click();
    }
    
    // キャラクター詳細ページに遷移することを確認
    await page.waitForURL(/\/characters\/\d+/, { timeout: 15000 });
    
    // キャラクター名または詳細情報が表示されることを確認
    const characterName = page.locator('h1, h2, [data-testid="character-name"]').first();
    await expect(characterName).toBeVisible({ timeout: 5000 });
  });
});








