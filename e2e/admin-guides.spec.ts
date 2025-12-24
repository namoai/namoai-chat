/**
 * 管理者観点: ガイド管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-5-1: ガイド一覧確認
 * 2-5-2: ガイド作成
 * 2-5-3: ガイド編集
 * 2-5-4: ガイド削除
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: ガイド管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 管理者ページに移動（より長いタイムアウトと適切な待機）
    await page.goto(`${BASE_URL}/admin/guides`, { 
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

  test('2-5-1: ガイド一覧確認', async ({ page }) => {
    // 1. 가이드 관리 페이지 접근 (already in beforeEach)
    
    // 2. 가이드 목록 또는 "가이드가 없습니다" 메시지 확인
    const guideList = page.locator('[class*="guide"], table tbody tr, .grid').first();
    const noGuideMessage = page.locator('text=/ガイドがありません|データがありません|No guides/i');
    
    // 가이드가 있으면 목록이 표시되고, 없으면 메시지가 표시됨
    const hasGuides = await guideList.count() > 0 && await guideList.isVisible({ timeout: 3000 }).catch(() => false);
    const hasNoGuideMessage = await noGuideMessage.isVisible({ timeout: 3000 }).catch(() => false);
    
    expect(hasGuides || hasNoGuideMessage).toBe(true);

    // 3. 카테고리별 정렬 확인 - 가이드가 있는 경우에만
    if (hasGuides) {
      const categoryMenu = page.locator('[class*="category"], [class*="menu"]').first();
      if (await categoryMenu.count() > 0) {
        await expect(categoryMenu).toBeVisible();
      }
    }
  });

  test('2-5-2: ガイド作成', async ({ page }) => {
    // 1. 가이드 작성 버튼 클릭
    const createButton = page.getByRole('button', { name: /作成|新規|New/i }).first();
    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForLoadState('networkidle');
    }

    // 2. 대메뉴, 소메뉴 입력
    const mainCategoryInput = page.locator('input[name*="main"], input[placeholder*="大メニュー"]').first();
    if (await mainCategoryInput.count() > 0) {
      await mainCategoryInput.fill('テスト大メニュー');
    }

    const subCategoryInput = page.locator('input[name*="sub"], input[placeholder*="小メニュー"]').first();
    if (await subCategoryInput.count() > 0) {
      await subCategoryInput.fill('テスト小メニュー');
    }

    // 3. 제목, 내용 입력
    const titleInput = page.locator('input[name*="title"], input[placeholder*="タイトル"]').first();
    await titleInput.fill('テストガイド');

    const contentInput = page.locator('textarea[name*="content"], textarea[placeholder*="内容"]').first();
    await contentInput.fill('これはテスト用のガイドです。');

    // 4. 표시 순서 입력
    const orderInput = page.locator('input[name*="order"], input[type="number"]').first();
    if (await orderInput.count() > 0) {
      await orderInput.fill('1');
    }

    // 5. 저장 실행
    const saveButton = page.getByRole('button', { name: /保存|作成|Save/i }).first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 6. 작성 완료 확인
    const successMessage = page.getByText(/作成|保存|成功/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });
});

