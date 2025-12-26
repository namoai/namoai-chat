import { Page, expect } from '@playwright/test';

/**
 * キャラクター 関連 ヘルパー すべき数
 */

/**
 * キャラクター 一覧で 最初の キャラクター リンクを 探してで 返す
 * /characters/createを 除外 実際 キャラクター 選択
 */
export async function getFirstCharacterLink(page: Page) {
  // /characters/createを 除外 キャラクター リンク 選択
  const characterLinks = page.locator('a[href^="/characters/"]');
  const linkCount = await characterLinks.count();
  
  for (let i = 0; i < linkCount; i++) {
    const link = characterLinks.nth(i);
    const href = await link.getAttribute('href');
    
    // /characters/createを 除外
    if (href && !href.includes('/characters/create') && /\/characters\/\d+/.test(href)) {
      return link;
    }
  }
  
  // 字 IDが ある キャラクター リンクを 見つからない場合
  return null;
}

/**
 * キャラクター 一覧で 最初の キャラクターを クリックして 詳細 ページで 移動
 */
export async function clickFirstCharacter(page: Page): Promise<void> {
  // ページが完全にロードされるまで待つ
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
  // 読み込み中が消えるまで待つ
  await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  
  // 追加の安定化待機
  await page.waitForTimeout(1000);
  
  const firstCharacter = await getFirstCharacterLink(page);
  
  if (!firstCharacter) {
    throw new Error('キャラクター リンクを 見つかりません. キャラクターが ないまたは /characters/create リンク あります.');
  }
  
  const href = await firstCharacter.getAttribute('href');
  console.log(`[clickFirstCharacter] 選択された キャラクター リンク: ${href}`);
  
  // 要素が表示されるまで待つ
  await expect(firstCharacter).toBeVisible({ timeout: 10000 });
  
  // 要素をビューにスクロール
  await firstCharacter.scrollIntoViewIfNeeded();
  
  // 少し待ってからクリック（アニメーション完了を待つ）
  await page.waitForTimeout(300);
  
  await firstCharacter.click();
  
  // キャラクター詳細ページに遷移することを確認
  await page.waitForURL(/\/characters\/\d+/, { timeout: 15000 });
  
  // ページが完全にロードされるまで待つ
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
}

