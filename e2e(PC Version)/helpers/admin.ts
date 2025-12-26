import { Page, expect } from '@playwright/test';

/**
 * 管理者機能関連のヘルパー関数
 */

/**
 * 管理画面に移動
 */
export async function goToAdminPage(page: Page): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(`${BASE_URL}/admin`, { 
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
 * キャラクター管理ページに移動
 */
export async function goToCharacterManagement(page: Page): Promise<void> {
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
}

/**
 * ユーザー管理ページに移動
 */
export async function goToUserManagement(page: Page): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(`${BASE_URL}/admin/users`, { 
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
 * お知らせ管理ページに移動
 */
export async function goToNoticeManagement(page: Page): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.goto(`${BASE_URL}/admin/notices`, { 
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
 * 管理者権限があることを確認
 */
export async function expectAdminAccess(page: Page): Promise<void> {
  // 管理画面にアクセスできることを確認
  await expect(page).toHaveURL(/\/admin/, { timeout: 5000 });
  
  // 管理画面の要素が表示されていることを確認
  const adminContent = page.locator('[data-testid="admin-content"], .admin-content, h1:has-text("管理")').first();
  await expect(adminContent).toBeVisible({ timeout: 5000 });
}

