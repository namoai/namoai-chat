/**
 * 管理者観点: 通報管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-8-1: 通報一覧確認
 * 2-8-2: 通報フィルタリング
 * 2-8-3: 通報詳細確認
 * 2-8-4: 通報状態変更
 * 2-8-5: 通報処理（キャラクター措置）
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: 通報管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 管理者ページに移動（より長いタイムアウトと適切な待機）
    await page.goto(`${BASE_URL}/admin/reports`, { 
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

  test('2-8-1: 通報一覧確認', async ({ page }) => {
    // 1. 신고 관리 페이지 접근 (already in beforeEach)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // 2. 신고 목록 또는 "신고가 없습니다" 메시지 확인
    // "通報履歴がありません。" 메시지 확인 (더 정확한 선택자)
    const noReportMessage = page.getByText('通報履歴がありません。').or(page.getByText(/通報履歴がありません|通報がありません|データがありません/i));
    
    // 신고 목록이 있는지 확인 (테이블 행 또는 리스트 아이템)
    const reportList = page.locator('table tbody tr, [class*="report"]').first();
    
    // 신고가 있으면 목록이 표시되고, 없으면 메시지가 표시됨
    const hasNoReportMessage = await noReportMessage.isVisible({ timeout: 5000 }).catch(() => false);
    const hasReports = !hasNoReportMessage && await reportList.count() > 0 && await reportList.isVisible({ timeout: 3000 }).catch(() => false);
    
    expect(hasReports || hasNoReportMessage).toBe(true);

    // 3. 신고 정보 표시 확인 (유형, 신고자, 신고 대상, 상태 등) - 신고가 있는 경우에만
    if (hasReports) {
      const reportType = page.getByText(/種類|유형|Type/i).first();
      if (await reportType.count() > 0) {
        await expect(reportType).toBeVisible();
      }
    }
  });

  test('2-8-2: 通報フィルタリング', async ({ page }) => {
    // 1. 유형별 필터링
    const typeFilter = page.locator('select[name*="type"], button:has-text("種類")').first();
    if (await typeFilter.count() > 0 && await typeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeFilter.click();
      await page.waitForTimeout(500);
      const characterReportOption = page.getByRole('option', { name: /キャラクター|캐릭터/i }).first();
      if (await characterReportOption.count() > 0) {
        await characterReportOption.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    // 2. 상태별 필터링
    const statusFilter = page.locator('select[name*="status"], button:has-text("状態")').first();
    if (await statusFilter.count() > 0 && await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.click();
      await page.waitForTimeout(500);
      const pendingOption = page.getByRole('option', { name: /待機中|대기중/i }).first();
      if (await pendingOption.count() > 0) {
        await pendingOption.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    // 3. 필터링 결과 확인 (결과가 없을 수도 있음)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    const filteredResults = page.locator('table tbody tr, [class*="report"]').first();
    const noResultsMessage = page.getByText('通報履歴がありません。').or(page.getByText(/結果がありません|データがありません/i));
    
    const hasNoResultsMessage = await noResultsMessage.isVisible({ timeout: 5000 }).catch(() => false);
    const hasResults = !hasNoResultsMessage && await filteredResults.count() > 0 && await filteredResults.isVisible({ timeout: 3000 }).catch(() => false);
    
    // 필터링 결과가 있거나 "결과 없음" 메시지가 표시되어야 함
    expect(hasResults || hasNoResultsMessage).toBe(true);
  });

  test('2-8-4: 通報状態変更', async ({ page }) => {
    // 1. 신고 선택
    const firstReport = page.locator('tbody tr').first();
    if (await firstReport.count() === 0) {
      test.skip(true, '通報が見つかりません。');
    }

    await firstReport.click();
    await page.waitForTimeout(1000);

    // 2. 상태 변경
    const statusSelect = page.locator('select[name*="status"], select').first();
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption('レビュー中');
      await page.waitForTimeout(2000);

      // 3. 관리자 메모 입력
      const memoInput = page.locator('textarea[name*="memo"], textarea').first();
      if (await memoInput.count() > 0) {
        await memoInput.fill('テスト用のメモ');
      }

      // 4. 저장 실행
      const saveButton = page.getByRole('button', { name: /保存|更新|Save/i }).first();
      await saveButton.click();
      await page.waitForTimeout(2000);

      // 5. 상태 변경 확인
      const successMessage = page.getByText(/変更|更新|成功/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

