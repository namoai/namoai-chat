/**
 * ポイント関連のヘルパー関数
 */

import { Page, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * UIからポイント残高を取得
 */
export async function getPointsFromUI(page: Page): Promise<number> {
  // ポイントページに移動
  await page.goto(`${BASE_URL}/points`);
  await page.waitForLoadState('networkidle');

  // ポイント表示を探す（複数のパターンを試す）
  const pointsSelectors = [
    '[data-testid="total-points"]',
    '[data-testid="points-total"]',
    '.points-total',
    'text=/保有ポイント|総ポイント|Total Points/i',
  ];

  for (const selector of pointsSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0 && await element.isVisible()) {
      const text = await element.textContent();
      if (text) {
        // 数値を抽出（カンマ区切りを考慮）
        const match = text.match(/[\d,]+/);
        if (match) {
          return parseInt(match[0].replace(/,/g, ''), 10);
        }
      }
    }
  }

  // フォールバック: 大きなテキストから数値を探す
  const largeText = page.locator('text=/\\d{1,3}(,\\d{3})*/').first();
  if (await largeText.count() > 0) {
    const text = await largeText.textContent();
    if (text) {
      const match = text.match(/[\d,]+/);
      if (match) {
        return parseInt(match[0].replace(/,/g, ''), 10);
      }
    }
  }

  throw new Error('ポイント表示が見つかりませんでした');
}

/**
 * APIからポイント残高を取得
 */
export async function getPointsFromAPI(page: Page): Promise<{ total: number; free_points: number; paid_points: number }> {
  // セッションクッキーを取得
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // APIを直接呼び出す
  const response = await page.request.get(`${BASE_URL}/api/users/points`, {
    headers: {
      'Cookie': cookieHeader,
    },
  });

  if (!response.ok()) {
    throw new Error(`ポイント取得APIが失敗しました: ${response.status()}`);
  }

  const data = await response.json();
  return {
    total: (data.free_points || 0) + (data.paid_points || 0),
    free_points: data.free_points || 0,
    paid_points: data.paid_points || 0,
  };
}

/**
 * ポイントが更新されるまで待つ
 */
export async function waitForPointsUpdate(
  page: Page,
  previousTotal: number,
  timeout: number = 10000
): Promise<number> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const currentPoints = await getPointsFromAPI(page);
    
    if (currentPoints.total !== previousTotal) {
      return currentPoints.total;
    }

    await page.waitForTimeout(500); // 0.5秒待機
  }

  // タイムアウト時は現在のポイントを返す
  const currentPoints = await getPointsFromAPI(page);
  return currentPoints.total;
}

/**
 * ポイントが特定の値になるまで待つ
 */
export async function waitForPointsToBe(
  page: Page,
  expectedTotal: number,
  timeout: number = 10000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const currentPoints = await getPointsFromAPI(page);
    
    if (currentPoints.total === expectedTotal) {
      return;
    }

    await page.waitForTimeout(500);
  }

  const currentPoints = await getPointsFromAPI(page);
  throw new Error(`ポイントが期待値(${expectedTotal})に到達しませんでした。現在値: ${currentPoints.total}`);
}








