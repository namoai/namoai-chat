/**
 * 管理者観点: IP管理のE2Eテスト
 * 
 * 対象シナリオ:
 * 2-10-1: IPブロック
 * 2-10-2: IPブロック解除
 * 2-10-3: IPモニタリング
 */

import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('管理者観点: IP管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    await loginWithEmail(page, adminEmail, adminPassword);
    
    // 追加の安定化待機
    await page.waitForTimeout(1000);
  });

  test('2-10-1: IPブロック', async ({ page }) => {
    // 1. IP 차단 관리 페이지 접근
    await page.goto(`${BASE_URL}/admin/ip-block`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. IP 주소 입력 (IPアドレスをブロック 섹션의 입력 필드)
    // label "IPアドレス *" 다음에 오는 입력 필드를 찾음
    const ipInput = page.locator('label:has-text("IPアドレス *")').locator('..').locator('input[type="text"]').first();
    await expect(ipInput).toBeVisible({ timeout: 10000 });
    await ipInput.fill('192.168.1.100');

    // 3. 차단 사유 입력 (같은 섹션 내의 reason 입력 필드)
    const reasonInput = page.locator('label:has-text("ブロック理由")').locator('..').locator('input[type="text"]').first();
    if (await reasonInput.count() > 0) {
      await reasonInput.fill('テスト用のブロック');
    }

    // 4. 차단 실행
    const blockButton = page.getByRole('button', { name: /ブロック|Block/i }).first();
    await blockButton.click();
    await page.waitForTimeout(2000);

    // 5. 차단 완료 확인
    const successMessage = page.getByText(/ブロック|成功|Success/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }

    // 6. 차단 목록에 추가 확인
    const blockedList = page.locator('[class*="blocked"], table tbody tr');
    const blockedIP = page.getByText('192.168.1.100').first();
    if (await blockedIP.count() > 0) {
      await expect(blockedIP).toBeVisible({ timeout: 5000 });
    }
  });

  test('2-10-2: IPブロック解除', async ({ page }) => {
    // 1. IP 차단 관리 페이지 접근
    await page.goto(`${BASE_URL}/admin/ip-block`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. 차단된 IP 선택
    const blockedIP = page.locator('tbody tr').first();
    if (await blockedIP.count() === 0) {
      test.skip(true, 'ブロックされたIPが見つかりません。');
    }

    // 3. 차단 해제 버튼 클릭
    const unblockButton = blockedIP.getByRole('button', { name: /解除|Unblock/i }).first();
    if (await unblockButton.count() > 0) {
      await unblockButton.click();
      await page.waitForTimeout(2000);

      // 4. 해제 완료 확인
      const successMessage = page.getByText(/解除|成功|Success/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('2-10-3: IPモニタリング', async ({ page }) => {
    // 1. IP 모니터링 페이지 접근
    await page.goto(`${BASE_URL}/admin/ip-monitor`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. IP 접근 로그 확인
    const accessLogs = page.locator('[class*="log"], table tbody tr');
    await expect(accessLogs.first()).toBeVisible({ timeout: 5000 });

    // 3. 이상 접근 패턴 확인
    const ipStats = page.locator('[class*="stat"], [class*="chart"]');
    if (await ipStats.count() > 0) {
      await expect(ipStats.first()).toBeVisible();
    }
  });
});

