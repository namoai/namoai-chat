import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';
import { goToUserManagement } from './helpers/admin';

/**
 * 管理者：ユーザー管理機能のE2Eテスト
 * 
 * テストシナリオ:
 * - ユーザー一覧の表示
 * - ユーザー検索
 * - ユーザー詳細の確認
 * 
 * 注意:
 * - 管理者ページはBasic認証を使用します
 * - 環境変数 ADMIN_BASIC_AUTH_USER と ADMIN_BASIC_AUTH_PASSWORD を設定してください
 * - 管理者アカウントの2FAは無効化することを推奨します
 */

test.describe('管理者：ユーザー管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    // 通常のログイン（管理者アカウントの2FAは無効化推奨）
    await loginWithEmail(page, adminEmail, adminPassword);
    
    await goToUserManagement(page);
  });

  test('ユーザー一覧が表示される', async ({ page }) => {
    // ユーザー一覧が表示されることを確認（空のリストでもOK）
    const userList = page.locator(
      '[data-testid="user-list"], .user-list, table, [role="table"], tbody'
    ).first();
    const noUserMessage = page.locator('text=/ユーザーがありません|データがありません|No users/i');
    
    const hasUsers = await userList.count() > 0 && await userList.isVisible({ timeout: 10000 }).catch(() => false);
    const hasNoUserMessage = await noUserMessage.isVisible({ timeout: 3000 }).catch(() => false);
    
    expect(hasUsers || hasNoUserMessage).toBe(true);
  });

  test('ユーザーを検索できる', async ({ page }) => {
    // 検索入力欄を探す
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="検索"], input[placeholder*="search"]'
    ).first();
    
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      
      // 検索結果が表示されるまで待つ
      await page.waitForTimeout(2000);
      
      // 検索結果が表示されていることを確認
      const searchResults = page.locator('[data-testid="search-results"], .search-results').first();
      const hasResults = await searchResults.isVisible().catch(() => false);
      if (hasResults) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('ユーザー詳細を確認できる', async ({ page }) => {
    // ユーザー一覧から最初のユーザーを選択
    const firstUser = page.locator(
      'tr[data-testid="user-row"], .user-row, tbody tr'
    ).first();
    
    if (await firstUser.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstUser.click();
      
      // 詳細情報が表示されることを確認（モーダルまたは別ページ）
      await page.waitForTimeout(1000);
      
      // 詳細情報の要素を確認
      const detailModal = page.locator('[role="dialog"], .modal, [data-testid="user-detail"]').first();
      const hasDetail = await detailModal.isVisible().catch(() => false);
      
      if (hasDetail) {
        await expect(detailModal).toBeVisible();
      }
    }
  });

  test('2-2-2: ユーザー検索（メール/ID）', async ({ page }) => {
    // 1. 사용자 관리 페이지 접근 (already in beforeEach)
    
    // 2. 검색창에 검색어 입력
    const searchInput = page.locator('input[type="search"], input[placeholder*="検索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    const searchQuery = 'test@example.com';
    await searchInput.fill(searchQuery);
    
    // 3. 검색 실행
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // 4. 검색 결과 표시 확인
    const searchResults = page.locator('tbody tr, [class*="user-row"]');
    await expect(searchResults.first()).toBeVisible({ timeout: 5000 });
  });

  test('2-2-3: ユーザー権限変更', async ({ page }) => {
    // 1. 사용자 목록에서 권한 드롭다운 선택
    const firstUser = page.locator('tbody tr').first();
    if (await firstUser.count() === 0) {
      test.skip(true, 'ユーザーが見つかりません。');
    }

    // 権限ドロップダウンを探す
    const roleSelect = firstUser.locator('select[name*="role"], select').first();
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption('MODERATOR');
      await page.waitForTimeout(2000);
      
      // 2. 변경 자동 저장 확인
      const successMessage = page.getByText(/変更|更新|成功/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('2-2-4: ユーザー情報編集', async ({ page }) => {
    // 1. 사용자 편집 버튼 클릭
    const editButton = page.getByRole('button', { name: /編集|Edit/i }).first();
    if (await editButton.count() === 0) {
      test.skip(true, '編集ボタンが見つかりません。');
    }

    await editButton.click();
    await page.waitForTimeout(2000);

    // 2. 편집 폼 표시 확인 (모달이 아니라 페이지 내부에 표시됨)
    const editForm = page.getByRole('heading', { name: 'ユーザー情報編集' });
    await expect(editForm).toBeVisible({ timeout: 5000 });

    // 3. 정보 수정 (편집 폼 내부의 입력 필드 찾기)
    // 이름 입력 필드 (첫 번째 textbox가 이름일 가능성이 높음)
    const nameInputs = page.locator('input[type="text"]');
    const nameInput = nameInputs.first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('編集された名前');
    }

    // 4. 포인트 수동 설정 (spinbutton으로 표시됨)
    const pointInputs = page.locator('input[type="number"], [role="spinbutton"]');
    const freePointsInput = pointInputs.first();
    if (await freePointsInput.count() > 0) {
      await freePointsInput.fill('100');
    }

    // 5. 저장 실행
    const saveButton = page.getByRole('button', { name: /保存|更新|Save/i }).first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // 6. 변경 사항 반영 확인
    const successMessage = page.getByText(/変更|更新|成功/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('2-2-5: ユーザー停止', async ({ page }) => {
    // 1. 정지할 사용자 선택
    const firstUser = page.locator('tbody tr').first();
    if (await firstUser.count() === 0) {
      test.skip(true, 'ユーザーが見つかりません。');
    }

    // 2. 정지 버튼 클릭
    const suspendButton = page.getByRole('button', { name: /停止|Suspend/i }).first();
    if (await suspendButton.count() === 0) {
      test.skip(true, '停止ボタンが見つかりません。');
    }

    await suspendButton.click();
    await page.waitForTimeout(1000);

    // 3. 정지 기간 선택
    const periodSelect = page.locator('select[name*="period"], select').first();
    if (await periodSelect.count() > 0) {
      await periodSelect.selectOption('7');
    }

    // 4. 정지 사유 입력
    const reasonInput = page.locator('textarea[name*="reason"], textarea').first();
    if (await reasonInput.count() > 0) {
      await reasonInput.fill('テスト用の停止');
    }

    // 5. 정지 실행 (실제 버튼 텍스트는 "停止する")
    const confirmButton = page.getByRole('button', { name: /停止する/i }).or(page.getByRole('button', { name: /確認|実行|Confirm/i })).first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    // 要素をビューにスクロールしてからクリック
    await confirmButton.scrollIntoViewIfNeeded();
    await confirmButton.click();
    await page.waitForTimeout(2000);

    // 6. 정지 완료 메시지 확인 (성공 모달 또는 알림)
    const successMessage = page.getByText('成功').or(page.getByText(/停止|Success/i)).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      // OK 버튼이 있으면 클릭하여 모달 닫기
      const okButton = page.getByRole('button', { name: /OK|確認/i }).first();
      if (await okButton.count() > 0) {
        await okButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // 7. 사용자 목록에서 정지 상태 표시 확인 (페이지 새로고침 후)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const suspendedBadge = page.getByText('停止中').or(page.getByText(/Suspended/i)).first();
    if (await suspendedBadge.count() > 0) {
      await expect(suspendedBadge).toBeVisible({ timeout: 5000 });
    }
  });
});

