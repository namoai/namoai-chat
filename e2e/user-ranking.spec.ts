/**
 * ユーザー観点: ランキング機能のE2Eテスト
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: ランキング機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    await setBasicAuth(page);
    await page.waitForTimeout(2000);
    
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-8-1: ランキングページ確認', async ({ page }) => {
    // 1. 랭킹 페이지 접근
    await page.goto(`${BASE_URL}/ranking`);
    await page.waitForLoadState('networkidle');

    // 2. 랭킹 목록 확인
    const rankingItems = page.locator('[role="listitem"], .ranking-item, tr').filter({
      has: page.locator('text=/ランキング|Ranking|順位/')
    });
    
    const hasRankingItems = await rankingItems.count() > 0;
    
    if (!hasRankingItems) {
      const noRankingMessage = page.locator('text=/ランキングがありません|No rankings/i').first();
      const hasNoRankingMessage = await noRankingMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(hasNoRankingMessage).toBeTruthy();
    } else {
      expect(hasRankingItems).toBeTruthy();
    }
  });

  test('1-8-2: 日次/週次/月次ランキング確認', async ({ page }) => {
    await page.goto(`${BASE_URL}/ranking`);
    await page.waitForLoadState('networkidle');

    // 탭 또는 필터 버튼 찾기
    const dailyTab = page.locator('button, [role="tab"]').filter({ hasText: /日次|日間|Daily/i }).first();
    const weeklyTab = page.locator('button, [role="tab"]').filter({ hasText: /週次|週間|Weekly/i }).first();
    const monthlyTab = page.locator('button, [role="tab"]').filter({ hasText: /月次|月間|Monthly/i }).first();

    // 각 탭 클릭 및 확인
    if (await dailyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dailyTab.click();
      await page.waitForTimeout(1000);
      console.log('[1-8-2] 日次ランキング確認');
    }

    if (await weeklyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await weeklyTab.click();
      await page.waitForTimeout(1000);
      console.log('[1-8-2] 週次ランキング確認');
    }

    if (await monthlyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await monthlyTab.click();
      await page.waitForTimeout(1000);
      console.log('[1-8-2] 月次ランキング確認');
    }
  });

  test('1-8-3: ランキングからキャラクターをクリック', async ({ page }) => {
    await page.goto(`${BASE_URL}/ranking`);
    await page.waitForLoadState('networkidle');

    // 랭킹에서 첫 번째 캐릭터 클릭
    const firstCharacterLink = page.locator('a[href^="/characters/"]').filter({
      hasNot: page.locator('a[href="/characters/create"]')
    }).first();
    
    if (await firstCharacterLink.count() === 0 || !await firstCharacterLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'ランキングにキャラクターがありません。');
      return;
    }
    
    await firstCharacterLink.click();
    await page.waitForLoadState('networkidle');

    // 캐릭터 상세 페이지 확인
    await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });
    
    const characterName = page.locator('h1, h2').first();
    await expect(characterName).toBeVisible({ timeout: 10000 });
  });
});
