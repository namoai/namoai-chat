import { Page, expect } from '@playwright/test';

/**
 * キャラクター関連のヘルパー関数
 */

/**
 * キャラクターを検索
 */
export async function searchCharacter(
  page: Page,
  keyword: string
): Promise<void> {
  // 検索バーを探す
  const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[placeholder*="search"]').first();
  
  await searchInput.fill(keyword);
  await searchInput.press('Enter');
  
  // 検索結果が表示されるまで待つ
  await page.waitForTimeout(1000);
}

/**
 * キャラクター一覧ページに移動
 */
export async function goToCharacterList(page: Page): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(`${BASE_URL}/charlist`, { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  // ページが完全にロードされるまで待つ
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  
  // 読み込み中が消えるまで待つ
  await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  
  // 追加の安定化待機
  await page.waitForTimeout(1000);
}

/**
 * キャラクター詳細ページに移動
 */
export async function goToCharacterDetail(page: Page, characterId: number): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(`${BASE_URL}/characters/${characterId}`, { 
    waitUntil: 'domcontentloaded',
    timeout: 60000 
  });
  
  // ページが完全にロードされるまで待つ
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  
  // 読み込み中が消えるまで待つ
  await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  
  // 追加の安定化待機
  await page.waitForTimeout(1000);
}

/**
 * キャラクター詳細ページで「チャット開始」ボタンをクリック
 */
export async function startChatFromCharacterDetail(page: Page): Promise<void> {
  // チャットボタンが表示されるまで待つ
  const chatButton = page.locator('button:has-text("チャット開始"), button:has-text("チャット"), a:has-text("チャット開始")').first();
  
  // ボタンが表示されるまで待つ
  await expect(chatButton).toBeVisible({ timeout: 10000 });
  
  // ボタンをビューにスクロール
  await chatButton.scrollIntoViewIfNeeded();
  
  // 少し待ってからクリック（アニメーション完了を待つ）
  await page.waitForTimeout(300);
  
  await chatButton.click();
  
  // チャットページに移動することを確認
  await page.waitForURL(/\/chat\/\d+/, { timeout: 10000 });
}

/**
 * キャラクターが表示されていることを確認
 */
export async function expectCharacterVisible(page: Page, characterName: string): Promise<void> {
  const characterCard = page.locator(`text=${characterName}`).first();
  await expect(characterCard).toBeVisible({ timeout: 5000 });
}

/**
 * /characters/create を除く有効なキャラクターリンクを見つける
 */
export async function findValidCharacterLink(page: Page): Promise<{ link: any; href: string; characterId: string } | null> {
  // ページが完全にロードされるまで待つ
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const allLinks = page.locator('a[href^="/characters/"]');
  const linkCount = await allLinks.count();
  
  console.log(`[findValidCharacterLink] 全リンク数: ${linkCount}`);
  
  // /characters/create ではない最初のリンクを見つける
  for (let i = 0; i < linkCount; i++) {
    const link = allLinks.nth(i);
    const href = await link.getAttribute('href');
    console.log(`[findValidCharacterLink] リンク ${i}: ${href}`);
    
    if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
      const characterId = href.match(/\/characters\/(\d+)/)?.[1];
      if (characterId) {
        console.log(`[findValidCharacterLink] ✅ 有効なキャラクターリンク発見: ${href} (ID: ${characterId})`);
        return { link, href, characterId };
      }
    }
  }
  
  console.log(`[findValidCharacterLink] ❌ 有効なキャラクターリンクが見つかりません`);
  return null;
}

