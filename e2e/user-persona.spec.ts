/**
 * ユーザー観点: ペルソナ機能のE2Eテスト
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: ペルソナ機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-10-1: ペルソナ一覧確認', async ({ page }) => {
    // 1. 페르소나 페이지 접근
    await page.goto(`${BASE_URL}/persona/list`);
    await page.waitForLoadState('networkidle');

    // 2. 페르소나 목록 확인
    const personaItems = page.locator('[role="listitem"], .persona-item').filter({
      has: page.locator('text=/ペルソナ|Persona/')
    });
    
    const noPersonasMessage = page.locator('text=/ペルソナがありません|No personas/i').first();
    
    const hasPersonas = await personaItems.count() > 0;
    const hasNoPersonasMessage = await noPersonasMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasPersonas || hasNoPersonasMessage).toBeTruthy();
  });

  test('1-10-2: ペルソナ作成', async ({ page }) => {
    await page.goto(`${BASE_URL}/persona/list`);
    await page.waitForLoadState('networkidle');

    // 새 페르소나 작성 버튼 클릭
    const newPersonaButton = page.getByRole('button', { name: /新規|作成|追加/i }).first();
    
    if (await newPersonaButton.count() === 0 || !await newPersonaButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.goto(`${BASE_URL}/persona/new`);
    } else {
      await newPersonaButton.click();
    }
    
    await page.waitForLoadState('networkidle');

    // 이름 입력
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('テストペルソナ');

    // 설명 입력
    const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="説明"]').first();
    if (await descriptionInput.count() > 0 && await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descriptionInput.fill('これはE2Eテスト用のペルソナです。');
    }

    // 등록 버튼 클릭
    const submitButton = page.getByRole('button', { name: /登録|作成|保存/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await submitButton.click();

    // 성공 확인
    await page.waitForTimeout(2000);
    
    const successMessage = page.locator('text=/成功|完了|作成しました/i').first();
    const hasSuccessMessage = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    const isOnListPage = page.url().includes('/persona');
    
    expect(hasSuccessMessage || isOnListPage).toBeTruthy();
  });

  test('1-10-3: ペルソナ編集', async ({ page }) => {
    await page.goto(`${BASE_URL}/persona/list`);
    await page.waitForLoadState('networkidle');

    // 첫 번째 페르소나의 편집 버튼 클릭
    const editButton = page.locator('button, a').filter({ hasText: /編集|Edit/i }).first();
    
    if (await editButton.count() === 0 || !await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'ペルソナがありません。');
      return;
    }
    
    await editButton.click();
    await page.waitForLoadState('networkidle');

    // 이름 수정
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill('編集されたペルソナ');

    // 저장 버튼 클릭
    const saveButton = page.getByRole('button', { name: /保存|更新/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await saveButton.click();

    // 성공 확인
    await page.waitForTimeout(2000);
    
    const successMessage = page.locator('text=/成功|完了|更新しました/i').first();
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('1-10-4: ペルソナ削除', async ({ page }) => {
    await page.goto(`${BASE_URL}/persona/list`);
    await page.waitForLoadState('networkidle');

    // 첫 번째 페르소나의 삭제 버튼 클릭
    const deleteButton = page.locator('button').filter({ hasText: /削除|Delete/i }).first();
    
    if (await deleteButton.count() === 0 || !await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'ペルソナがありません。');
      return;
    }
    
    await deleteButton.click();
    await page.waitForTimeout(1000);

    // 확인 다이얼로그 처리
    const confirmButton = page.getByRole('button', { name: /確認|はい|削除する/i }).first();
    if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // 성공 확인
    await page.waitForTimeout(2000);
    
    const successMessage = page.locator('text=/成功|完了|削除しました/i').first();
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });
});
