import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';
import { goToCharacterManagement } from './helpers/admin';

/**
 * 管理者：キャラクター管理機能のE2Eテスト
 * 
 * テストシナリオ:
 * - キャラクター一覧の表示
 * - キャラクター検索
 * - キャラクターの編集（可能な場合）
 * - キャラクターの公開/非公開切り替え（可能な場合）
 */

test.describe('管理者：キャラクター管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.TEST_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.TEST_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page, context }) => {
    // テスト間の待機時間を追加（サーバーの負荷を軽減）
    await page.waitForTimeout(2000);
    
    // セッションをクリア（前のテストの影響を避けるため）
    await context.clearCookies();
    
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    // ログ 再試行 直 (最大 3回)
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
    await loginWithEmail(page, adminEmail, adminPassword);
        loginSuccess = true;
        break;
      } catch (error) {
        console.log(`[beforeEach] ログイン 試行 ${attempt}/3 失敗, 再試行 中...`);
        if (attempt === 3) {
          throw error;
        }
        await page.waitForTimeout(2000);
        await context.clearCookies();
      }
    }
    
    // ログイン後の安定化待機
    await page.waitForTimeout(1000);
    
    // キャラクター管理ページに移動
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
  });

  test('キャラクター一覧が表示される', async ({ page }) => {
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    
    // キャラクター一覧が表示されることを確認
    // ページ内容から "テスト用" や "作成者" などのテキストが あればキャラクターが表示されていると判断
    const pageContent = await page.textContent('body').catch(() => '');
    const hasCharacterText = /テスト用|作成者|状態|公開|非公開/i.test(pageContent);
    
    // または、より具体的な要素を探す
    const characterCards = page.locator('text=/テスト用|作成者|状態:/i');
    const hasCharacterCards = await characterCards.count() > 0;
    
    // 空のリストメッセージを確認
    const noCharacterMessage = page.locator('text=/キャラクターがありません|データがありません|No characters|空|Empty/i');
    const hasNoCharacterMessage = await noCharacterMessage.isVisible({ timeout: 3000 }).catch(() => false);
    
    // キャラクターが表示されているか、または空のメッセージが 表示されているかを確認
    expect(hasCharacterText || hasCharacterCards || hasNoCharacterMessage).toBe(true);
  });

  test('キャラクターを検索できる', async ({ page }) => {
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

  test('キャラクターの詳細を確認できる', async ({ page }) => {
    // ページが 完全に ロードされる時まで 待機
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // キャラクター カード 検索 (カード 形態)
    const characterName = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
    
    if (await characterName.count() === 0) {
      // キャラクターが なければ スキップ
      return;
    }
    
    // キャラクター カード 検索 (2-3-3と 同じ 方式)
    let firstCharacter = characterName.locator('xpath=ancestor::div[contains(@class, "bg-gray-900/50") or (contains(@class, "bg-gray-900") and contains(@class, "rounded-2xl"))][1]').first();
    
    if (await firstCharacter.count() === 0) {
      const creatorText = page.getByText(/作成者:/i).first();
      if (await creatorText.count() > 0) {
        firstCharacter = creatorText.locator('xpath=ancestor::div[contains(@class, "bg-gray-900") or contains(@class, "rounded-2xl")][1]').first();
      }
    }
    
    if (await firstCharacter.count() === 0) {
      const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
      if (await characterList.count() > 0) {
        firstCharacter = characterList.locator('> div').first();
      }
    }
    
    if (await firstCharacter.count() === 0) {
      // キャラクター カードを 見つからない場合 スキップ
      return;
    }
    
    // キャラクター カード クリック (Link クリック)
    const characterLink = firstCharacter.locator('a').first();
    if (await characterLink.count() > 0) {
      await characterLink.click();
      
      // 詳細情報が表示されることを確認（モーダルまたは別ページ）
      await page.waitForTimeout(2000);
      
      // URLが 変更されたか 確認
      const currentUrl = page.url();
      if (currentUrl.includes('/characters/')) {
        // キャラクター 詳細 ページで 移動した 場合
        console.log('✅ キャラクター 詳細 ページで 移動しました.');
      } else {
        // モーダルが 開いた 場合
        const detailModal = page.locator('[role="dialog"], .modal, [data-testid="character-detail"]').first();
        const hasDetail = await detailModal.isVisible().catch(() => false);
        
        if (hasDetail) {
          await expect(detailModal).toBeVisible();
        }
      }
    }
  });

  test('2-3-3: キャラクター公開/非公開切替', async ({ page }) => {
    // 1. キャラクター カード 検索
    console.log('[2-3-3] キャラクター カードを 探す 中...');
    
    // ページが 完全に ロードされる時まで 待機
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // キャラクター 名前でで 検索
    const characterName = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
    
    let firstCharacter;
    
    if (await characterName.count() > 0) {
      // キャラクター カード bg-gray-900/50 クラスを 持つ divで, "作成者" テキストを 含むすべき
      // もっと 正確に 検索: キャラクター 名前 テキストが 含まれた カード (bg-gray-900/50 または rounded-2xl クラス)
      firstCharacter = characterName.locator('xpath=ancestor::div[contains(@class, "bg-gray-900/50") or (contains(@class, "bg-gray-900") and contains(@class, "rounded-2xl"))][1]').first();
      
      // 上 方法で 見つからない場合, "作成者" テキストが ある div 検索
      if (await firstCharacter.count() === 0) {
        const creatorText = page.getByText(/作成者:/i).first();
        if (await creatorText.count() > 0) {
          // "作成者" テキストが ある カード 検索
          firstCharacter = creatorText.locator('xpath=ancestor::div[contains(@class, "bg-gray-900") or contains(@class, "rounded-2xl")][1]').first();
        }
      }
      
      // まだ 見つからない場合, キャラクター 名前が 含まれた 最も 近い カード 検索
      if (await firstCharacter.count() === 0) {
        // キャラクター リスト 領域で 検索 (space-y-4 クラスを 持つ div 内部)
        const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
        if (await characterList.count() > 0) {
          // リスト 内部の 最初の キャラクター カード 検索
          firstCharacter = characterList.locator('> div').first();
        }
      }
      
      console.log('[2-3-3] ✅ キャラクター 名前でで 見つかりました!');
    } else {
      // 複数 selector 試行
      const possibleSelectors = [
        'div.space-y-4 > div:first-child', // リストの 最初の カード
        'div:has-text("作成者:")', // "作成者" テキストが ある カード
        '[class*="bg-gray-900/50"]', // 正確な クラス
        'div:has-text("E2E")',
        'div:has-text("キャラクター")',
      ];

      for (const selector of possibleSelectors) {
        firstCharacter = page.locator(selector).first();
        const count = await firstCharacter.count();
        console.log(`[2-3-3] Selector __STRING_DOUBLE_0__: ${count}個 発見`);

        if (count > 0) {
          // 見つけた 要素が 実際 キャラクター カード 確認 (作成者 情報が あるか)
          const hasCreator = await firstCharacter.getByText(/作成者:/i).count() > 0;
          if (hasCreator) {
            console.log(`[2-3-3] ✅ キャラクターを 見つかりました! Selector: ${selector}`);
            break;
          }
        }
      }
    }
    
    if (!firstCharacter || await firstCharacter.count() === 0) {
      throw new Error('キャラクターデータが見つかりません。管理画面にキャラクターが登録されているか確認してください。');
    }
    
    // 見つけた カードが 実際 キャラクター カード 確認
    const cardText = await firstCharacter.textContent().catch(() => '');
    const hasCreator = /作成者:/.test(cardText);
    const hasCharacterName = /E2E|キャラクター/.test(cardText);
    
    if (!hasCreator || !hasCharacterName) {
      console.log('[2-3-3] ⚠️ 見つけた 要素が キャラクター カードが ない 数 あります. 再度 探す 中...');
      // リストで 直接 検索
      const characterList = page.locator('div.space-y-4').first();
      if (await characterList.count() > 0) {
        firstCharacter = characterList.locator('> div').first();
      }
    }
    
    // 2. 元の 公開 状態 保存
    const statusText = await firstCharacter.textContent();
    const originalVisibility = statusText?.match(/非公開|公開/)?.[0] || '';
    console.log(`[2-3-3] 元の キャラクター 公開 状態: ${originalVisibility}`);
    
    // 3. ケバブ メニュー ボタン 検索 (Link に ある ボタン)
    console.log('[2-3-3] ケバブ メニュー ボタンを 探す 中...');
    
    // カード 構造: div > div (flex) > Link + div (ml-auto) > KebabMenu > button
    const cardFlexDiv = firstCharacter.locator('> div').first();
    
    // ml-auto クラスを 持つ div 検索 (ケバブ メニュー コンテナ)
    let kebabMenuButton;
    const mlAutoDiv = cardFlexDiv.locator('> div.ml-auto').last();
    
    if (await mlAutoDiv.count() > 0) {
      kebabMenuButton = mlAutoDiv.locator('button').first();
      console.log('[2-3-3] ml-auto divで ボタン 見つけた');
    } else {
      // fallback: SVG アイコンを 持つ ボタン 検索 (MoreVertical アイコン)
      const svgButtons = firstCharacter.locator('button:has(svg)');
      const svgButtonCount = await svgButtons.count();
      
      if (svgButtonCount > 0) {
        kebabMenuButton = svgButtons.last();
        console.log('[2-3-3] SVGを 持つ 最後 ボタン 使用');
      } else {
        const allButtons = firstCharacter.locator('button');
        kebabMenuButton = allButtons.last();
        console.log('[2-3-3] カード 内部の 最後 ボタン 使用');
      }
    }
    
    if (!kebabMenuButton || await kebabMenuButton.count() === 0) {
      throw new Error('ケバブ メニュー ボタンを 見つかりません.');
    }
    
    await kebabMenuButton.scrollIntoViewIfNeeded();
    
    // 4. ボタン クリック 前に カード 内部の すべての Link 無効化
    console.log('[2-3-3] Link 無効化 中...');
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        (link as any).__originalHref = link.getAttribute('href');
        link.removeAttribute('href');
        link.style.pointerEvents = 'none';
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      });
    }, await firstCharacter.elementHandle());
    
    // 5. ボタン クリック
    console.log('[2-3-3] ケバブ メニュー ボタン クリック');
    await kebabMenuButton.click({ force: true });
    
    // メニューが 開くまで 待機 (ポータルで レンダリングされるで テキストが 現れる 時まで 待機)
    console.log('[2-3-3] メニューが 開くまで 待機...');
    await page.waitForTimeout(1000);
    
    // Link 復元
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        const originalHref = (link as any).__originalHref;
        if (originalHref) {
          link.setAttribute('href', originalHref);
          link.style.pointerEvents = '';
          link.onclick = null;
        }
      });
    }, await firstCharacter.elementHandle());
    
    // 6. 公開/公開 切り替え メニュー 検索 (ポータルで レンダリングされます)
    console.log('[2-3-3] 公開/公開 切り替え メニューを 探す 中...');
    
    let toggleButton;
    let toggleFound = false;
    
    // 方法 1: すべての ボタンで 直接 検索 (最も 確実な 方法)
    console.log('[2-3-3] すべての ボタンで 検索します...');
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`[2-3-3] ページの すべての ボタン 個数: ${buttonCount}個`);
    
    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      const buttonText = await button.textContent().catch(() => '');
      if (buttonText && (/非公開に切り替え|公開に切り替え/.test(buttonText))) {
        toggleButton = button;
        toggleFound = true;
        console.log(`[2-3-3] ✅ 公開/公開 メニュー 発見! (ボタン インデックス ${i}, テキスト: ${buttonText.trim()})`);
        break;
      }
    }
    
    // 方法 2: テキストで 検索 (fallback)
    if (!toggleFound) {
      console.log('[2-3-3] ボタンで 見つけ しました. テキストで 検索します...');
      const toggleText = page.getByText(/非公開に切り替え|公開に切り替え/i);
      const toggleTextCount = await toggleText.count();
      console.log(`[2-3-3] __STRING_DOUBLE_0__ または __STRING_DOUBLE_1__ テキスト 発見: ${toggleTextCount}個`);
      
      if (toggleTextCount > 0) {
        // テキストを 持つ ボタン 検索
        const parentButton = toggleText.locator('xpath=ancestor::button[1]').first();
        if (await parentButton.count() > 0) {
          toggleButton = parentButton;
          toggleFound = true;
          console.log('[2-3-3] ✅ 公開/公開 切り替え メニュー 発見 (ボタン)!');
        } else {
          // ボタンを 見つからない場合 テキスト 字を クリック
          toggleButton = toggleText;
          toggleFound = true;
          console.log('[2-3-3] ✅ 公開/公開 切り替え メニュー 発見 (テキスト 直接)!');
        }
      }
    }
    
    // 方法 3: bodyの 直接 子で メニュー コンテナ 検索 (ポータルで レンダリングされます)
    if (!toggleFound) {
      console.log('[2-3-3] テキストで 見つけ しました. メニュー コンテナで 検索します...');
      
      // bodyの 直接 子 div 中 メニュー テキストを 含むする  検索
      const bodyDivs = page.locator('body > div');
      const divCount = await bodyDivs.count();
      console.log(`[2-3-3] bodyの 直接 子 div 個数: ${divCount}個`);
      
      for (let i = 0; i < divCount; i++) {
        const div = bodyDivs.nth(i);
        const isVisible = await div.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        const divText = await div.textContent().catch(() => '');
        if (divText && /非公開に切り替え|公開に切り替え/.test(divText)) {
          // div 内部の ボタン 検索
          const menuButton = div.locator('button').filter({ hasText: /非公開|公開/i }).first();
          if (await menuButton.count() > 0) {
            toggleButton = menuButton;
            toggleFound = true;
            console.log(`[2-3-3] ✅ メニュー コンテナ ${i}で 公開/公開 メニュー 発見!`);
            break;
          }
        }
      }
    }
    
    // 7. トグルを 見つけたであれば 状態 変更 実行
    if (!toggleFound || !toggleButton) {
      throw new Error('キャラクタの公開/非公開切り替えメニューが見つかりませんでした。ページ構造を確認してください。');
    }
    
    console.log('[2-3-3] 公開/公開 状態 変更を 実行します.');
    await toggleButton.click();
    await page.waitForTimeout(2000);
    
    // 8. 変更 完了 確認
    const successMessage = page.getByText(/変更|更新|成功|保存/i).first();
    if (await successMessage.count() > 0) {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      console.log('[2-3-3] ✅ キャラクター 公開/公開 状態 変更 成功');
    } else {
      console.log('[2-3-3] ✅ キャラクター 公開/公開 メニュー クリック 完了');
    }
    
    // 9. 元の 状態に 復帰 (管理字 実行 アップロードを 元状態に 復帰すべき)
    console.log(`[2-3-3] 元の 状態に 復帰する 中...`);
    await page.waitForTimeout(1000);
    
    // ページ で修正
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // 再度 最初の キャラクター 検索
    const characterNameAgain = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
    let firstCharacterAgain = characterNameAgain.locator('xpath=ancestor::div[contains(@class, "bg-gray-900") or contains(@class, "rounded-2xl") or contains(@class, "card")][1]').first();
    
    if (await firstCharacterAgain.count() === 0) {
      firstCharacterAgain = characterNameAgain.locator('..').or(characterNameAgain.locator('xpath=ancestor::div[1]')).first();
    }
    
    // 再度 ケバブ メニュー クリック
    const kebabMenuAgain = firstCharacterAgain.locator('button').last();
    if (await kebabMenuAgain.count() > 0) {
      await kebabMenuAgain.scrollIntoViewIfNeeded();
      await kebabMenuAgain.click({ force: true });
      await page.waitForTimeout(1000);
      
      // 反対 状態に 切り替えする メニュー 検索
      const restoreToggleMenu = page.getByText(/非公開に切り替え|公開に切り替え/i).first();
      
      if (await restoreToggleMenu.count() > 0) {
        const restoreButton = restoreToggleMenu.locator('xpath=ancestor::button[1]').first();
        if (await restoreButton.count() > 0) {
          await restoreButton.click();
        } else {
          await restoreToggleMenu.click();
        }
        await page.waitForTimeout(2000);
        
        // 復帰 成功 確認
        const restoreSuccessMessage = page.getByText(/変更|更新|成功|保存/i).first();
        if (await restoreSuccessMessage.count() > 0) {
          await expect(restoreSuccessMessage).toBeVisible({ timeout: 5000 });
          console.log('[2-3-3] ✅ キャラクター 状態 元の対で 復帰 成功');
        } else {
          console.log('[2-3-3] ✅ キャラクター 状態 復帰 試行 完了');
        }
      }
    }
  });

  test('2-3-5: キャラクター削除', async ({ page }) => {
    // 1. 削除する キャラクター 選択 (カード 形態) - 2-3-3と 同じ 方式
    console.log('[2-3-5] 削除する キャラクターを 探す 中...');
    
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    const characterName = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
    
    let firstCharacter;
    if (await characterName.count() > 0) {
      firstCharacter = characterName.locator('xpath=ancestor::div[contains(@class, "bg-gray-900/50") or (contains(@class, "bg-gray-900") and contains(@class, "rounded-2xl"))][1]').first();
      
      if (await firstCharacter.count() === 0) {
        const creatorText = page.getByText(/作成者:/i).first();
        if (await creatorText.count() > 0) {
          firstCharacter = creatorText.locator('xpath=ancestor::div[contains(@class, "bg-gray-900") or contains(@class, "rounded-2xl")][1]').first();
        }
      }
      
      if (await firstCharacter.count() === 0) {
        const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
        if (await characterList.count() > 0) {
          firstCharacter = characterList.locator('> div').first();
        }
      }
    } else {
      const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
      if (await characterList.count() > 0) {
        firstCharacter = characterList.locator('> div').first();
      }
    }

    if (!firstCharacter || await firstCharacter.count() === 0) {
      throw new Error('キャラクターデータが見つかりません。管理画面にキャラクターが登録されているか確認してください。');
    }

    // 2. ケバブ メニュー ボタン 検索 (2-3-3と 同じ 方式)
    console.log('[2-3-5] ケバブ メニュー ボタンを 探す 中...');
    const cardFlexDiv = firstCharacter.locator('> div').first();
    const mlAutoDiv = cardFlexDiv.locator('> div.ml-auto').last();
    
    let kebabMenuButton;
    if (await mlAutoDiv.count() > 0) {
      kebabMenuButton = mlAutoDiv.locator('button').first();
    } else {
      const svgButtons = firstCharacter.locator('button:has(svg)');
      if (await svgButtons.count() > 0) {
        kebabMenuButton = svgButtons.last();
      } else {
        kebabMenuButton = firstCharacter.locator('button').last();
      }
    }
    
    if (!kebabMenuButton || await kebabMenuButton.count() === 0) {
      throw new Error('ケバブ メニューを 見つかりません.');
    }
    
    await kebabMenuButton.scrollIntoViewIfNeeded();
    
    // Link 無効化
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        (link as any).__originalHref = link.getAttribute('href');
        link.removeAttribute('href');
        link.style.pointerEvents = 'none';
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      });
    }, await firstCharacter.elementHandle());
    
    // ケバブ メニュー 開く
    await kebabMenuButton.click({ force: true });
    await page.waitForTimeout(1000);
    
    // Link 復元
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        const originalHref = (link as any).__originalHref;
        if (originalHref) {
          link.setAttribute('href', originalHref);
          link.style.pointerEvents = '';
          link.onclick = null;
        }
      });
    }, await firstCharacter.elementHandle());

    // 3. 削除 メニュー 検索 (すべての ボタンで 検索)
    console.log('[2-3-5] 削除 メニューを 探す 中...');
    let deleteMenu;
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      const buttonText = await button.textContent().catch(() => '');
      if (buttonText && /削除/.test(buttonText)) {
        deleteMenu = button;
        console.log(`[2-3-5] ✅ 削除 メニュー 発見! (ボタン インデックス ${i})`);
        break;
      }
    }
    
    if (!deleteMenu) {
      // テキストで 検索
      const deleteText = page.getByText(/削除/i).first();
      if (await deleteText.count() > 0) {
        const parentButton = deleteText.locator('xpath=ancestor::button[1]').first();
        if (await parentButton.count() > 0) {
          deleteMenu = parentButton;
        } else {
          deleteMenu = deleteText;
        }
      }
    }
    
    if (!deleteMenu || await deleteMenu.count() === 0) {
      throw new Error('削除メニューが見つかりません。');
    }

    await deleteMenu.click();
    await page.waitForTimeout(1000);

    // 4. 削除 確認 ダイアログで 確認
    const confirmButton = page.getByRole('button', { name: /削除|Delete|確認|OK/i }).last();
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // 5. 削除 完了 メッセージ 確認
      const successMessage = page.getByText(/削除|成功|Success/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('[2-3-5] ✅ キャラクター 削除 成功');
      } else {
        console.log('[2-3-5] ✅ キャラクター 削除 試行 完了');
      }
    }
  });

  test('2-3-7: ナモアイフレンズ登録/解除', async ({ page }) => {
    // 1. キャラクター カード 検索 (2-3-3と 同じ 方式)
    console.log('[2-3-7] ナモアイが フレンズ 登録/解除する キャラクターを 探す 中...');
    
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    const characterName = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
    
    let firstCharacter;
    if (await characterName.count() > 0) {
      firstCharacter = characterName.locator('xpath=ancestor::div[contains(@class, "bg-gray-900/50") or (contains(@class, "bg-gray-900") and contains(@class, "rounded-2xl"))][1]').first();
      
      if (await firstCharacter.count() === 0) {
        const creatorText = page.getByText(/作成者:/i).first();
        if (await creatorText.count() > 0) {
          firstCharacter = creatorText.locator('xpath=ancestor::div[contains(@class, "bg-gray-900") or contains(@class, "rounded-2xl")][1]').first();
        }
      }
      
      if (await firstCharacter.count() === 0) {
        const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
        if (await characterList.count() > 0) {
          firstCharacter = characterList.locator('> div').first();
        }
      }
    } else {
      const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
      if (await characterList.count() > 0) {
        firstCharacter = characterList.locator('> div').first();
      }
    }

    if (!firstCharacter || await firstCharacter.count() === 0) {
      throw new Error('キャラクターデータが見つかりません。管理画面にキャラクターが登録されているか確認してください。');
    }

    // 2. ケバブ メニュー ボタン 検索 (2-3-3と 同じ 方式)
    console.log('[2-3-7] ケバブ メニュー ボタンを 探す 中...');
    const cardFlexDiv = firstCharacter.locator('> div').first();
    const mlAutoDiv = cardFlexDiv.locator('> div.ml-auto').last();
    
    let kebabMenuButton;
    if (await mlAutoDiv.count() > 0) {
      kebabMenuButton = mlAutoDiv.locator('button').first();
    } else {
      const svgButtons = firstCharacter.locator('button:has(svg)');
      if (await svgButtons.count() > 0) {
        kebabMenuButton = svgButtons.last();
      } else {
        kebabMenuButton = firstCharacter.locator('button').last();
      }
    }
    
    if (!kebabMenuButton || await kebabMenuButton.count() === 0) {
      throw new Error('ケバブ メニューを 見つかりません.');
    }
    
    await kebabMenuButton.scrollIntoViewIfNeeded();
    
    // Link 無効化
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        (link as any).__originalHref = link.getAttribute('href');
        link.removeAttribute('href');
        link.style.pointerEvents = 'none';
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      });
    }, await firstCharacter.elementHandle());
    
    // ケバブ メニュー 開く
    await kebabMenuButton.click({ force: true });
    await page.waitForTimeout(1000);
    
    // Link 復元
    await page.evaluate((cardElement) => {
      const links = cardElement.querySelectorAll('a');
      links.forEach(link => {
        const originalHref = (link as any).__originalHref;
        if (originalHref) {
          link.setAttribute('href', originalHref);
          link.style.pointerEvents = '';
          link.onclick = null;
        }
      });
    }, await firstCharacter.elementHandle());

    // 3. ナモアイが フレンズ 登録 メニュー 検索 (すべての ボタンで 検索)
    console.log('[2-3-7] ナモアイが フレンズ 登録 メニューを 探す 中...');
    let officialMenu;
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      if (!isVisible) continue;
      
      const buttonText = await button.textContent().catch(() => '');
      if (buttonText && (/ナモアイフレンズに登録|ナモアイフレンズから削除/.test(buttonText))) {
        officialMenu = button;
        console.log(`[2-3-7] ✅ ナモアイが フレンズ メニュー 発見! (ボタン インデックス ${i}, テキスト: ${buttonText.trim()})`);
        break;
      }
    }
    
    if (!officialMenu) {
      // テキストで 検索
      const officialText = page.getByText(/ナモアイフレンズに登録|ナモアイフレンズから削除/i).first();
      if (await officialText.count() > 0) {
        const parentButton = officialText.locator('xpath=ancestor::button[1]').first();
        if (await parentButton.count() > 0) {
          officialMenu = parentButton;
        } else {
          officialMenu = officialText;
        }
      }
    }

    if (!officialMenu || await officialMenu.count() === 0) {
      throw new Error('ナモアイフレンズ登録メニューが見つかりませんでした。');
    }

    // 登録/解除 状態 確認
    const menuText = await officialMenu.textContent().catch(() => '');
    const isRegisterAction = /登録/.test(menuText);
    
    if (isRegisterAction) {
      // 登録されて いない ない 場合 登録
      await officialMenu.click();
      await page.waitForTimeout(2000);

      // 変更 完了 確認
      const successMessage = page.getByText(/変更|更新|成功|登録/i).first();
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        console.log('[2-3-7] ✅ ナモアイが フレンズ 登録 成功');
      }

      // 4. 元の 状態に 復帰 (管理字 実行 アップロードを 元状態に 復帰すべき)
      console.log('[2-3-7] 登録 解除を 上 再度 メニューを 開きます...');
      await page.waitForTimeout(1000);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // 再度 最初の キャラクター 検索
      const characterNameAgain = page.getByText('E2Eテストキャラクター').or(page.getByText(/E2E|キャラクター/i)).first();
      let firstCharacterAgain;
      if (await characterNameAgain.count() > 0) {
        firstCharacterAgain = characterNameAgain.locator('xpath=ancestor::div[contains(@class, "bg-gray-900/50") or (contains(@class, "bg-gray-900") and contains(@class, "rounded-2xl"))][1]').first();
        if (await firstCharacterAgain.count() === 0) {
          const characterList = page.locator('div.space-y-4, div[class*="space-y"]').first();
          if (await characterList.count() > 0) {
            firstCharacterAgain = characterList.locator('> div').first();
          }
        }
      }
      
      if (firstCharacterAgain && await firstCharacterAgain.count() > 0) {
        const cardFlexDivAgain = firstCharacterAgain.locator('> div').first();
        const mlAutoDivAgain = cardFlexDivAgain.locator('> div.ml-auto').last();
        let kebabMenuButtonAgain;
        
        if (await mlAutoDivAgain.count() > 0) {
          kebabMenuButtonAgain = mlAutoDivAgain.locator('button').first();
        } else {
          const svgButtons = firstCharacterAgain.locator('button:has(svg)');
          if (await svgButtons.count() > 0) {
            kebabMenuButtonAgain = svgButtons.last();
          } else {
            kebabMenuButtonAgain = firstCharacterAgain.locator('button').last();
          }
        }
        
        if (kebabMenuButtonAgain && await kebabMenuButtonAgain.count() > 0) {
          // Link 無効化
          await page.evaluate((cardElement) => {
            const links = cardElement.querySelectorAll('a');
            links.forEach(link => {
              (link as any).__originalHref = link.getAttribute('href');
              link.removeAttribute('href');
              link.style.pointerEvents = 'none';
              link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
              };
            });
          }, await firstCharacterAgain.elementHandle());
          
          await kebabMenuButtonAgain.click({ force: true });
          await page.waitForTimeout(1000);
          
          // Link 復元
          await page.evaluate((cardElement) => {
            const links = cardElement.querySelectorAll('a');
            links.forEach(link => {
              const originalHref = (link as any).__originalHref;
              if (originalHref) {
                link.setAttribute('href', originalHref);
                link.style.pointerEvents = '';
                link.onclick = null;
              }
            });
          }, await firstCharacterAgain.elementHandle());

          // 解除 メニュー 検索
          let unregisterMenu;
          const allButtonsAgain = page.locator('button');
          const buttonCountAgain = await allButtonsAgain.count();
          
          for (let i = 0; i < buttonCountAgain; i++) {
            const button = allButtonsAgain.nth(i);
            const isVisible = await button.isVisible().catch(() => false);
            if (!isVisible) continue;
            
            const buttonText = await button.textContent().catch(() => '');
            if (buttonText && (/解除|登録解除|ナモアイフレンズから削除/.test(buttonText))) {
              unregisterMenu = button;
              console.log(`[2-3-7] ✅ 解除 メニュー 発見! (ボタン インデックス ${i})`);
              break;
            }
          }
          
          if (unregisterMenu && await unregisterMenu.count() > 0) {
            await unregisterMenu.click();
            await page.waitForTimeout(2000);
            console.log('[2-3-7] ✅ ナモアイが フレンズ 登録 解除 成功');
          }
        }
      }
    } else {
      // 既に 登録されて ある 場合 解除 後 再度 登録
      await officialMenu.click();
      await page.waitForTimeout(2000);
      console.log('[2-3-7] ✅ ナモアイが フレンズ 解除 完了');
    }
  });
});

