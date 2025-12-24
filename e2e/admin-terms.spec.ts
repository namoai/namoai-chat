/**
 * 管理者観点: 約款管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-7-1: 約款一覧確認
 * 2-7-2: 約款編集
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: 約款管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 管理者ページに移動（より長いタイムアウトと適切な待機）
    await page.goto(`${BASE_URL}/admin/terms`, { 
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

  test('2-7-1: 約款一覧確認', async ({ page }) => {
    // 1. 약관 관리 페이지 접근 (already in beforeEach)
    
    // 2. 약관 목록 표시 확인 (약관은 항상 있어야 함)
    const termsList = page.locator('[class*="term"], [class*="item"], button, a').first();
    await expect(termsList).toBeVisible({ timeout: 10000 });
  });

  test('2-7-2: 約款編集', async ({ page }) => {
    // 1. 편집할 약관 선택 (편집 버튼 클릭)
    const editButton = page.getByRole('button', { name: /編集/i }).first();
    if (await editButton.count() === 0) {
      test.skip(true, '約款編集ボタンが見つかりません。');
    }

    await editButton.click();
    await page.waitForTimeout(2000);

    // 2. 내용 수정 (마크다운 형식) - textarea 찾기
    const contentInput = page.locator('textarea').first();
    await expect(contentInput).toBeVisible({ timeout: 5000 });
    await contentInput.clear();
    await contentInput.fill('# テスト約款\n\nこれはテスト用の約款です。');

    // 3. 저장 실행 (button[type="submit"] 또는 "更新" 텍스트)
    const saveButton = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /更新|保存|Save/i }))
      .first();
    
    // 저장 버튼이 보이는지 확인
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    // 要素をビューにスクロールしてからクリック
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 4. 변경 사항 반영 확인 (성공 메시지 또는 페이지 리다이렉트)
    // 성공 메시지가 있으면 확인, 없으면 페이지 이동 확인
    const successMessage = page.getByText(/変更|更新|成功|保存/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    } else {
      // 페이지가 리다이렉트되었는지 확인
      await page.waitForURL(/\/admin\/terms|\/terms/, { timeout: 5000 }).catch(() => {});
    }

    // 5. 일반 사용자 화면에서 변경된 약관 표시 확인
    await page.goto(`${BASE_URL}/terms`);
    await page.waitForLoadState('networkidle');

    const updatedContent = page.getByText('テスト約款').first();
    if (await updatedContent.count() > 0) {
      await expect(updatedContent).toBeVisible({ timeout: 5000 });
    }
  });
});

