import { Page, expect } from '@playwright/test';

/**
 * 캐릭터 관련 헬퍼 함수
 */

/**
 * 캐릭터 목록에서 첫 번째 캐릭터 링크를 찾아서 반환
 * /characters/create를 제외한 실제 캐릭터만 선택
 */
export async function getFirstCharacterLink(page: Page) {
  // /characters/create를 제외한 캐릭터 링크만 선택
  const characterLinks = page.locator('a[href^="/characters/"]');
  const linkCount = await characterLinks.count();
  
  for (let i = 0; i < linkCount; i++) {
    const link = characterLinks.nth(i);
    const href = await link.getAttribute('href');
    
    // /characters/create를 제외
    if (href && !href.includes('/characters/create') && /\/characters\/\d+/.test(href)) {
      return link;
    }
  }
  
  // 숫자 ID가 있는 캐릭터 링크를 찾지 못한 경우
  return null;
}

/**
 * 캐릭터 목록에서 첫 번째 캐릭터를 클릭하고 상세 페이지로 이동
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
    throw new Error('캐릭터 링크를 찾을 수 없습니다. 캐릭터가 없거나 /characters/create 링크만 있습니다.');
  }
  
  const href = await firstCharacter.getAttribute('href');
  console.log(`[clickFirstCharacter] 선택된 캐릭터 링크: ${href}`);
  
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

