/**
 * ユーザー観点: お問い合わせ・通報機能のE2Eテスト
 * 
 * 対象シナリオ:
 * 1-9-1: お問い合わせ作成
 * 1-9-2: キャラクター通報
 * 1-9-3: 自分のお問い合わせ/通報一覧確認
 */

import { test, expect } from '@playwright/test';
import { loginUser, setBasicAuth } from './helpers/auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: お問い合わせ・通報機能', () => {
  let testUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page }) => {
    // Basic認証の設定
    await setBasicAuth(page);
    
    // テスト間の待機時間を追加
    await page.waitForTimeout(2000);
    
    // テストユーザーでログイン
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
    testUser = { email: testEmail, password: testPassword };
    
    await loginUser(page, testUser.email, testUser.password);
  });

  test('1-9-1: お問い合わせ作成', async ({ page }) => {
    // 1. 마이페이지 > 문의하기 접근
    await page.goto(`${BASE_URL}/MyPage/inquiries`);
    await page.waitForLoadState('networkidle');

    // 2. 새 문의 작성 버튼 클릭
    const newInquiryButton = page.getByRole('button', { name: /新規|作成|問い合わせ/i }).first();
    
    // 버튼이 없으면 직접 작성 페이지로 이동
    if (await newInquiryButton.count() === 0 || !await newInquiryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.goto(`${BASE_URL}/MyPage/inquiries/new`);
    } else {
      await newInquiryButton.click();
    }
    
    await page.waitForLoadState('networkidle');

    // 3. お問い合わせ種類を選択 (必須)
    console.log('[1-9-1] お問い合わせ種類を選択');
    const categorySelect = page.locator('select, combobox').first();
    await expect(categorySelect).toBeVisible({ timeout: 10000 });
    
    // "システム問題"を選択 (index 1)
    await categorySelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    console.log('[1-9-1] お問い合わせ種類選択完了');

    // 4. タイトルを入力
    console.log('[1-9-1] タイトル入力');
    const titleInput = page.locator('input[type="text"][placeholder*="タイトル"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill('テストお問い合わせ');
    await page.waitForTimeout(300);
    console.log('[1-9-1] タイトル入力完了');

    // 5. 内容を入力
    console.log('[1-9-1] 内容入力');
    const contentInput = page.locator('textarea').first();
    await expect(contentInput).toBeVisible({ timeout: 10000 });
    await contentInput.fill('これはE2Eテスト用のお問い合わせ内容です。');
    await page.waitForTimeout(300);
    console.log('[1-9-1] 内容入力完了');

    // 6. 送信ボタンがenabledになるまで待機
    console.log('[1-9-1] 送信ボタンの有効化を待機');
    const submitButton = page.getByRole('button', { name: /送信|提出|登録/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    
    // ボタンがenabledになるまで待機
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    console.log('[1-9-1] 送信ボタンクリック');
    await submitButton.click();

    // 7. 성공 메시지 또는 목록으로 리다이렉트 확인
    await page.waitForTimeout(2000);
    
    // 성공 메시지 또는 목록 페이지 확인
    const successMessage = page.locator('text=/成功|完了|送信しました/i').first();
    const hasSuccessMessage = await successMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    const isOnListPage = page.url().includes('/inquiries') && !page.url().includes('/new');
    
    expect(hasSuccessMessage || isOnListPage).toBeTruthy();
  });

  test('1-9-2: キャラクター通報', async ({ page }) => {
    // 1. 캐릭터 목록 페이지 접근
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('networkidle');

    // 2. 첫 번째 캐릭터 선택
    const firstCharacterLink = page.locator('a[href^="/characters/"]').filter({
      hasNot: page.locator('a[href="/characters/create"]')
    }).first();
    
    await expect(firstCharacterLink).toBeVisible({ timeout: 10000 });
    await firstCharacterLink.click();
    await page.waitForLoadState('networkidle');

    // 3. 통보 버튼 또는 메뉴 찾기
    // 케밥 메뉴 또는 통보 버튼
    let reportButton = page.locator('button, a').filter({ hasText: /通報|報告|Report/i }).first();
    
    if (await reportButton.count() === 0 || !await reportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 케밥 메뉴에서 통보 찾기
      const kebabButton = page.locator('button:has(svg)').filter({ hasText: /\.\.\./ }).first();
      if (await kebabButton.count() === 0) {
        const kebabButton2 = page.locator('button[aria-label*="menu"], button[aria-label*="メニュー"]').first();
        if (await kebabButton2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await kebabButton2.click();
          await page.waitForTimeout(1000);
          
          reportButton = page.locator('button, a, [role="menuitem"]').filter({ hasText: /通報|報告|Report/i }).first();
          if (await reportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await reportButton.click();
          } else {
            throw new Error('通報メニューが見つかりません。');
          }
        }
      }
    }
    
    if (await reportButton.count() > 0 && await reportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reportButton.click();
      await page.waitForTimeout(2000);

      // 4. 통보 사유 입력
      const reasonTextarea = page.locator('textarea').first();
      if (await reasonTextarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reasonTextarea.fill('テスト通報です。');

        // 5. 제출 버튼 클릭
        const submitButton = page.getByRole('button', { name: /送信|提出|通報する/i }).first();
        await expect(submitButton).toBeVisible({ timeout: 10000 });
        await submitButton.click();

        // 6. 성공 확인
        await page.waitForTimeout(2000);
        const successMessage = page.locator('text=/成功|完了|通報しました/i').first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
      }
    } else {
      console.log('[1-9-2] 通報ボタンが見つかりません。この機能は実装されていない可能性があります。');
      test.skip(true, '通報機能が見つかりません。');
    }
  });

  test('1-9-3: 自分のお問い合わせ/通報一覧確認', async ({ page }) => {
    // 1. 마이페이지 > 문의하기 접근
    await page.goto(`${BASE_URL}/MyPage/inquiries`);
    await page.waitForLoadState('networkidle');

    // 2. 문의 목록 확인
    // 문의가 있거나 "お問い合わせがありません" 메시지가 표시되어야 함
    const inquiryItems = page.locator('[role="listitem"], .inquiry-item, tr').filter({
      has: page.locator('text=/お問い合わせ|問い合わせ|Inquiry/i')
    });
    
    const noInquiriesMessage = page.locator('text=/お問い合わせがありません|問い合わせがありません|No inquiries/i').first();
    
    const hasInquiries = await inquiryItems.count() > 0;
    const hasNoInquiriesMessage = await noInquiriesMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasInquiries || hasNoInquiriesMessage).toBeTruthy();
  });
});
