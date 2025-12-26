import { Page } from '@playwright/test';

/**
 * モバイル環境用のヘルパー関数
 * 
 * 注意: モバイル版はハンバーガーメニューではなく、画面下部のBottomNav（ハイトナビゲーション）を使用します
 */

/**
 * モバイルのハンバーガーメニューを開く（補助的なメニュー用）
 * 注意: メインのナビゲーションはBottomNav（ハイトナビゲーション）を使用します
 */
export async function openMobileMenu(page: Page): Promise<void> {
  // ハンバーガーメニューボタンを探す（MobileHeader内）
  const menuButton = page.locator('button:has(svg), button[aria-label*="menu"], button[aria-label*="Menu"]').first();
  
  // Menuアイコンを含むボタンを探す
  const hamburgerButton = page.locator('header button').filter({ has: page.locator('svg') }).first();
  
  // どちらかが見つかったらクリック
  if (await hamburgerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await hamburgerButton.click();
    await page.waitForTimeout(500); // メニューが開くまで待つ
  } else if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * モバイルメニューを閉じる（ハンバーガーメニュー用）
 */
export async function closeMobileMenu(page: Page): Promise<void> {
  // 閉じるボタン（Xアイコン）を探す
  const closeButton = page.locator('button:has-text("×"), button[aria-label*="close"], button[aria-label*="Close"]').first();
  
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
    await page.waitForTimeout(300);
  } else {
    // オーバーレイをクリックして閉じる
    const overlay = page.locator('[class*="overlay"], [class*="backdrop"]').first();
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await overlay.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);
    }
  }
}

/**
 * モバイルのハイトナビゲーション（BottomNav）から特定のリンクをクリック
 * メインのナビゲーションは画面下部のBottomNavを使用します
 */
export async function clickBottomNavLink(page: Page, linkText: string): Promise<void> {
  // ハイトナビゲーションを探す（画面下部固定）
  const bottomNav = page.locator('nav[class*="fixed"][class*="bottom"]').first();
  
  // ハイトナビゲーションが表示されるまでスクロール（必要に応じて）
  await bottomNav.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  
  // ハイトナビゲーション内のリンクを探す
  const link = bottomNav.locator(`a:has-text("${linkText}")`).first();
  await link.click();
  await page.waitForTimeout(500);
}

/**
 * モバイルのハイトナビゲーション（BottomNav）から特定のURLに移動
 */
export async function navigateFromBottomNav(page: Page, href: string): Promise<void> {
  // ハイトナビゲーションを探す
  const bottomNav = page.locator('nav[class*="fixed"][class*="bottom"]').first();
  
  // ハイトナビゲーションが表示されるまでスクロール（必要に応じて）
  await bottomNav.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  
  // ハイトナビゲーション内のリンクを探す
  const link = bottomNav.locator(`a[href="${href}"]`).first();
  await link.click();
  await page.waitForTimeout(500);
}

/**
 * モバイルのハイトナビゲーション（BottomNav）が表示されているか確認
 */
export async function isBottomNavVisible(page: Page): Promise<boolean> {
  const bottomNav = page.locator('nav[class*="fixed"][class*="bottom"]').first();
  return await bottomNav.isVisible({ timeout: 2000 }).catch(() => false);
}

/**
 * モバイル環境で要素が表示されるまでスクロール
 */
export async function scrollToElementMobile(page: Page, selector: string, maxScrolls: number = 5): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    const element = page.locator(selector).first();
    const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (isVisible) {
      // 要素が見える位置までスクロール
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      return;
    }
    
    // 下にスクロール
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.8);
    });
    await page.waitForTimeout(500);
  }
  
  // 最後に要素が見えるか確認
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
}

/**
 * モバイル環境でページの最上部までスクロール
 */
export async function scrollToTopMobile(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  await page.waitForTimeout(500);
}

/**
 * モバイル環境でページの最下部までスクロール
 * 注意: ハイトナビゲーション（BottomNav）があるため、完全に最下部までスクロールするとナビゲーションが隠れる場合があります
 */
export async function scrollToBottomMobile(page: Page): Promise<void> {
  await page.evaluate(() => {
    // ハイトナビゲーションの高さ（約80px）を考慮してスクロール
    const navHeight = 80;
    window.scrollTo({ top: document.body.scrollHeight - navHeight, behavior: 'smooth' });
  });
  await page.waitForTimeout(500);
}

/**
 * モバイル環境で要素をタップ（クリックの代わり）
 */
export async function tapElementMobile(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await element.click({ force: true }); // モバイルでは force: true を使用
}

/**
 * モバイル環境でキーボードを閉じる（必要に応じて）
 */
export async function closeMobileKeyboard(page: Page): Promise<void> {
  // 入力フィールドからフォーカスを外す
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  
  // または画面の他の部分をタップ
  await page.tap('body', { position: { x: 10, y: 10 } }).catch(() => {});
}

