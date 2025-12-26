import { Page, expect } from '@playwright/test';

// 前回 変数: 連続 ログイン 失敗 回数 追跡 (テスト 間 共有)
let consecutiveLoginFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // 5回 以上 連続 失敗 時 テスト 中止

/**
 * 認証関連のヘルパー関数
 */

/**
 * Basic認証を設定（管理者ページアクセス用）
 * 環境変数 ADMIN_BASIC_AUTH_USER と ADMIN_BASIC_AUTH_PASSWORD を使用
 * 環境変数が設定されていない場合はデフォルト値を使用
 */
export async function setBasicAuth(page: Page): Promise<void> {
  // 環境変数から取得、なければデフォルト値を使用
  const basicAuthUser = process.env.ADMIN_BASIC_AUTH_USER || 'admin';
  const basicAuthPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD || 'namoai20250701';
  
  // Playwrightでは context.setHTTPCredentials() を使用
  await page.context().setHTTPCredentials({
    username: basicAuthUser,
    password: basicAuthPassword,
  });
  
  // デバッグ情報（開発時のみ）
  if (process.env.NODE_ENV !== 'production') {
    const usingEnv = process.env.ADMIN_BASIC_AUTH_USER && process.env.ADMIN_BASIC_AUTH_PASSWORD;
    console.log(`[setBasicAuth] Basic認証を設定しました (${usingEnv ? '環境変数から' : 'デフォルト値を使用'})`);
  }
}

/**
 * メールアドレスとパスワードでログイン
 * 2FAが有効な場合は自動的に処理します
 */
export async function loginWithEmail(
  page: Page,
  email: string,
  password: string,
  twoFactorCode?: string
): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  // 環境変数のデバッグ情報（開発時のみ）
  if (process.env.NODE_ENV !== 'production') {
    console.log('[loginWithEmail] 環境変数確認:');
    console.log(`  ADMIN_EMAIL: ${process.env.ADMIN_EMAIL ? '設定済み' : '未設定'}`);
    console.log(`  TEST_EMAIL: ${process.env.TEST_EMAIL ? '設定済み' : '未設定'}`);
    console.log(`  PLAYWRIGHT_BASE_URL: ${BASE_URL}`);
    console.log(`  使用するメール: ${email}`);
  }
  
  // まず、既にログインされているか確認（APIでセッション確認）
  try {
    const sessionCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        return data && Object.keys(data).length > 0 && data.user?.email;
      } catch {
        return null;
      }
    });
    
    if (sessionCheck && sessionCheck === email) {
      // 既に同じユーザーでログイン済み
      console.log(`[loginWithEmail] 既にログイン済みです (${email})。ログインをスキップします。`);
      // MyPageに移動してログイン状態を確認
      await page.goto(`${BASE_URL}/MyPage`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      const finalUrl = page.url();
      if (/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i.test(finalUrl)) {
        return; // ログイン成功
      }
    }
  } catch (error) {
    // セッション確認に失敗しても続行
    console.log('[loginWithEmail] セッション確認に失敗しました。ログインを続行します。');
  }
  
  // ログインページに移動（最初の試行）
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // ページが完全にロードされるまで待つ（最初のリクエストが完了するまで）
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {
    // domcontentloadedがタイムアウトしても続行
  });
  
  // 追加の安定化待機（Next.jsのビルドファイルアクセスが完了するまで）
  await page.waitForTimeout(3000);
  
  // 現在のURLを確認（textContentは呼ばずにURLのみ確認）
  const currentPageUrl = page.url();
  
  // エラーページか確認（URLベース）
  const isErrorPageUrl = currentPageUrl.includes('/api/auth/error');
  
  // ページ内容を確認する前に、レスポンスのステータスコードを確認
  let pageContent = '';
  let hasInternalServerError = false;
  
  try {
    // レスポンスを待ってから内容を確認
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000); // 追加の待機
    
    // ページ内容を確認（エラーがない場合のみ）
    if (!isErrorPageUrl) {
      pageContent = await page.textContent('body').catch(() => '');
      hasInternalServerError = /Internal Server Error/i.test(pageContent);
    }
  } catch (error) {
    // エラーが発生した場合は、ページ内容を確認せずに続行
    console.warn('[loginWithEmail] ページ内容の確認中にエラーが発生しました:', error);
  }
  
  // アカウント ロック エラー 確認 および 処理
  try {
    const bodyText = await page.textContent('body').catch(() => '');
    if (/アカウントがロックされました|アカウントがロックされています/i.test(bodyText)) {
      consecutiveLoginFailures++;
      console.warn(`[loginWithEmail] アカウントが ロックされています. (連続 失敗: ${consecutiveLoginFailures}回)`);
      console.warn(`[loginWithEmail] アカウント: ${email}`);
      
      // 5回 以上 連続 失敗 時 テスト 中止
      if (consecutiveLoginFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[loginWithEmail] ⚠️ 警告: ${MAX_CONSECUTIVE_FAILURES}回 以上 連続で ログイン 失敗しました. テストを 中止します.`);
        console.error('[loginWithEmail] 解決 方法:');
        console.error('  1. 管理者 ページで 該当 アカウントの ロックを 解除するか または');
        console.error('  2. DBで 直接 ロック 解除: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
        throw new Error(`アカウントが ロックされています: ${email}. ${MAX_CONSECUTIVE_FAILURES}回 以上 連続 失敗で テストを 中止します. 管理者 ページで ロックを 解除してください.`);
      }
      
      console.warn('[loginWithEmail] 解決 方法:');
      console.warn('  1. 管理者 ページで 該当 アカウントの ロックを 解除するか または');
      console.warn('  2. DBで 直接 ロック 解除: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
      throw new Error(`アカウントが ロックされています: ${email}. 管理者 ページで ロックを 解除するか または 15分 後に 再度 試行してください.`);
    }
  } catch (error) {
    // 既に エラーが 発生した 場合は そのまま 前回の エラーを 返す
    if (error instanceof Error && error.message.includes('アカウントが ロックされています')) {
      throw error;
    }
  }

  // エラーページか確認
  if (isErrorPageUrl || hasInternalServerError) {
    // エラーの詳細を確認
    const errorDetails = pageContent.substring(0, 500);
    console.error('[loginWithEmail] エラーページが表示されました:');
    console.error(`  URL: ${currentPageUrl}`);
    console.error(`  ページ内容: ${errorDetails}`);
    
    // Internal Server Errorの場合は、十分に待ってから再試行（ファイルロックを避けるため）
    if (hasInternalServerError) {
      console.log('[loginWithEmail] Internal Server Errorが検出されました。10秒待機してから再試行します...');
      
      // 最初のリクエストが完全に完了するまで待機
      await page.waitForTimeout(10000);
      
      // ページのナビゲーションが完全に停止していることを確認
      const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 1000 }).catch(() => null);
      await navigationPromise;
      
      // 再度ログインページに移動（前のリクエストが完全に完了した後）
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // ページが完全にロードされるまで待つ
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000); // 追加の安定化待機
      
      // 再度確認（レスポンスを待ってから）
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
      
      const retryUrl = page.url();
      const retryContent = await page.textContent('body').catch(() => '');
      
      if (/Internal Server Error/i.test(retryContent)) {
        throw new Error(`ログインページにアクセスできません。Internal Server Errorが継続しています。URL: ${retryUrl}`);
      }
      
      // 再試行後、URLを更新
      const updatedUrl = page.url();
      
      // 既にログインされているか確認
      if (!updatedUrl.includes('/login') && /\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i.test(updatedUrl)) {
        console.log('[loginWithEmail] 再試行後、既にログイン済みと判断します。URL:', updatedUrl);
        return;
      }
    } else {
      throw new Error(`ログインページにアクセスできません。エラーページが表示されています。URL: ${currentPageUrl}`);
    }
  }
  
  // 既にログインされているか確認（URLとページ内容を確認）
  if (!currentPageUrl.includes('/login')) {
    // 既にログイン済みのページにリダイレクトされた場合
    console.log('[loginWithEmail] 既にログイン済みです。URL:', currentPageUrl);
    // ログイン成功ページにいることを確認
    if (/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i.test(currentPageUrl)) {
      return; // ログイン成功
    }
  }
  
  // ログインページにいる場合、メールアドレス入力フィールドを探す
  // まず "読み込み中..." が消えるまで待つ
  if (currentPageUrl.includes('/login')) {
    try {
      // "読み込み中..." が消えるまで待つ
      await page.locator('text=読み込み中...').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      
      // ページが 完全に ロードされる時まで 待機
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      
      // 追加 安定化 待機
      await page.waitForTimeout(1000);
    } catch {
      // タイムアウトが 発生しても 続行 進行
    }
  }
  
  // より広範囲の選択子を使用
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="メール"], input[placeholder*="email"]').first();
  
  // 入力フィールドが表示されるまで待つ（より長いタイムアウト）
  const emailInputVisible = await emailInput.isVisible({ timeout: 15000 }).catch(() => false);
  
  if (!emailInputVisible) {
    // 入力フィールドが見つからない場合、ページの状態を確認
    // pageContentが空の場合は、必要に応じて読み込む
    let contentToCheck = pageContent;
    if (!contentToCheck) {
      // ページ内容を読み込む（エラーが発生した場合は空文字列）
      contentToCheck = await page.textContent('body').catch(() => '');
    }
    
    const hasLoginText = /ログイン|Login|メールアドレス|email/i.test(contentToCheck);
    
    if (!hasLoginText && !currentPageUrl.includes('/login')) {
      // ログインページではない場合、既にログイン済みと判断
      console.log('[loginWithEmail] ログインページではないため、既にログイン済みと判断します。URL:', currentPageUrl);
      return;
    }
    
    // それでも見つからない場合はエラー
    throw new Error(`ログインページのメールアドレス入力フィールドが見つかりません。URL: ${currentPageUrl}, ページ内容: ${contentToCheck.substring(0, 200)}`);
  }
  
  await emailInput.fill(email);
  
  // パスワード入力
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await passwordInput.fill(password);
  
  // ログインボタンをクリック
  const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login"), button[type="submit"]').first();
  await loginButton.click();
  
  // ログイン処理の完了を待つ（API呼び出しが完了するまで）
  await page.waitForTimeout(2000);
  
  // URL変更または2FA画面を待つ（より効率的な方法）
  try {
    // URL変更を待つ（10秒）
    await page.waitForURL(/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i, { timeout: 10000 });
  } catch {
    // URL変更がタイムアウトした場合、2FAまたはエラーを確認
  }
  
  // 現在のURLを確認
  const currentUrl = page.url();
  
  // MyPageにリダイレクトされた場合、データロード完了を待つ
  if (/\/MyPage/i.test(currentUrl)) {
    // ログイン 成功: 連続 失敗 回数 リセット
    consecutiveLoginFailures = 0;
    
    // ポイント表示や主要要素が表示されるまで待つ（より確実な方法）
    try {
      // ポイントカードまたはマイページの主要要素が表示されるまで待つ
      await page.waitForSelector('text=/ポイント|残高|マイページ/i', { timeout: 10000 }).catch(() => {
        // 要素が見つからない場合でも続行
      });
    } catch {
      // タイムウトしても続行
    }
    
    // ページの基本ロード完了を待つ（domcontentloaded）
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {
      // タイムアウトしても続行
    });
    
    // 少し待機してAPI呼び出しが開始されることを確認
    await page.waitForTimeout(2000);
    
    return; // ログイン成功
  }
  
  // その他のページ（home, dashboard, admin, complete-profile）の場合
  if (/\/(home|dashboard|admin|complete-profile)/i.test(currentUrl)) {
    // ログ 成功: 連続 失敗 回数 リセット
    consecutiveLoginFailures = 0;
    
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // networkidleがタイムしても続行
    });
    return; // 既にログイン成功
  }
  
  // 2FAコード入力画面が表示されるか確認
  
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 2FAコード入力が必要な場合
    
    if (twoFactorCode) {
      // 2FA コード 入力
      await twoFactorInput.fill(twoFactorCode);
      
      // 確認ボタンをクリック
      const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証"), button[type="submit"]').first();
      await verifyButton.click();
      
      // ログイン完了を待つ
      await page.waitForURL(/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i, { timeout: 15000 });
    } else {
      // 2FAコードが提供されていない場合
      // 環境変数から取得を試みる
      const envCode = process.env.TEST_2FA_CODE;
      
      if (envCode) {
        await twoFactorInput.fill(envCode);
        const verifyButton = page.locator('button:has-text("確認"), button:has-text("認証")').first();
        await verifyButton.click();
        await page.waitForURL(/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i, { timeout: 15000 });
      } else {
        // 2FAが 必要なのに コードが なければ エラー
        throw new Error(
          '2FAが 活性化された アカウントです. 次 の中 一つを 実行してください:\n' +
          '1. 環境 変数 TEST_2FA_CODEを 設定\n' +
          '2. テスト用 アカウントの 2FAを 無効化\n' +
          '3. loginWith2FA() すべき数を 使用して 2FA コードを 提供'
        );
      }
    }
  } else {
    // 2FAが ない場合、通常のログイン完了を待つ
    try {
      await page.waitForURL(/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i, { timeout: 15000 });
      // URL変更成功後、MyPageの場合はデータロード完了を待つ
      const finalUrl = page.url();
      // ロ 成功: 連続 失敗 回数 リセット
      consecutiveLoginFailures = 0;
      
      if (/\/MyPage/i.test(finalUrl)) {
        try {
          await page.waitForSelector('text=/ポイント|残高|マイページ/i', { timeout: 10000 }).catch(() => {});
        } catch {}
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      // URL変更がタイムアウトした場合、現在のURLを確認
      const finalUrl = page.url();
      if (/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i.test(finalUrl)) {
        // ロ 成功: 連続 失敗 回数 リセット
        consecutiveLoginFailures = 0;
        
        // 既にログイン成功ページにいる場合
        if (/\/MyPage/i.test(finalUrl)) {
          try {
            await page.waitForSelector('text=/ポイント|残高|マイページ/i', { timeout: 5000 }).catch(() => {});
          } catch {}
          await page.waitForTimeout(2000);
        }
        return; // ログイン成功
      }
      // suspendedページにリダイレクトされた場合を確認
      if (finalUrl.includes('/suspended')) {
        const bodyText = await page.textContent('body').catch(() => '');
        const isSuspended = /アカウント停止中|アカウントが停止されています|suspended/i.test(bodyText);
        if (isSuspended) {
          console.warn(`[loginWithEmail] ⚠️ アカウントが停止状態です。URL: ${finalUrl}`);
          const suspendedError: any = new Error(`アカウントが停止されています。管理者に連絡してアカウントの停止を解除してください。URL: ${finalUrl}`);
          suspendedError.isSuspended = true;
          throw suspendedError;
        }
      }
      
      // エラーページにリダイレクトされた場合
      if (finalUrl.includes('/api/auth/error') || finalUrl.includes('/login') || finalUrl.includes('/suspended')) {
        // ログイン 失敗: 連続 失敗 回数増加
        consecutiveLoginFailures++;
        
        // URLパラメータのエラーを 確認
        const urlParams = new URL(finalUrl).searchParams;
        const errorParam = urlParams.get('error');
        
        // ページで エラー メッセージ 確認 (迅速な 確認)
        const bodyText = await page.textContent('body').catch(() => '');
        const isLocked = /アカウントがロックされました|アカウントがロックされています/i.test(bodyText);
        const isSuspended = /アカウント停止中|アカウントが停止されています|suspended/i.test(bodyText) || finalUrl.includes('/suspended');
        
        // 詳細な デバッグ 出力
        console.warn(`[loginWithEmail] ログイン 失敗 (連続 失敗: ${consecutiveLoginFailures}回)`);
        console.warn(`[loginWithEmail] アカウント: ${email}`);
        console.warn(`[loginWithEmail] 現在 URL: ${finalUrl}`);
        if (errorParam) {
          console.warn(`[loginWithEmail] エラー パラメータ: ${errorParam}`);
        }
        if (isLocked) {
          console.warn(`[loginWithEmail] ⚠️ アカウントが ロック 状態です.`);
        }
        if (isSuspended) {
          console.warn(`[loginWithEmail] ⚠️ アカウントが 停止 状態です.`);
          const suspendedError: any = new Error(`アカウントが停止されています。管理者に連絡してアカウントの停止を解除してください。URL: ${finalUrl}`);
          suspendedError.isSuspended = true;
          throw suspendedError;
        }
        
        // 5回 以上 連続 失敗 時 テスト 中止
        if (consecutiveLoginFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(`[loginWithEmail] ⚠️ 警告: ${MAX_CONSECUTIVE_FAILURES}回 以上 連続で ログイン 失敗しました. テストを 中止します.`);
          console.error('[loginWithEmail] 解決 方法:');
          console.error('  1. 管理者 ページで 該当 アカウントの ロックを 解除するか または');
          console.error('  2. DBで 直接 ロック 解除: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
          throw new Error(`ログイン 失敗: ${email}. ${MAX_CONSECUTIVE_FAILURES}回 以上 連続 失敗で テストを 中止します. 管理者 ページで ロックを 解除してください.`);
        }
        
        // ページ上のエラーメッセージを確認（モーダル、アラート、テキストなど）
        let errorMessages: string[] = [];
        
        // Internal Server Error の場合は詳細を確認
        if (finalUrl.includes('/api/auth/error')) {
          // エラーページの内容を確認
          const errorPageContent = await page.textContent('body').catch(() => '');
          errorMessages.push(`エラーページ内容: ${errorPageContent.substring(0, 500)}`);
          
          // コンソールエラーを確認（可能な場合）
          const consoleErrors: string[] = [];
          page.on('console', msg => {
            if (msg.type() === 'error') {
              consoleErrors.push(msg.text());
            }
          });
          
          // ネットワークエラーを確認
          const networkErrors: string[] = [];
          page.on('response', response => {
            if (!response.ok() && response.url().includes('/api/auth')) {
              networkErrors.push(`${response.status()} ${response.statusText()}: ${response.url()}`);
            }
          });
          
          if (consoleErrors.length > 0) {
            errorMessages.push(`コンソールエラー: ${consoleErrors.join(', ')}`);
          }
          if (networkErrors.length > 0) {
            errorMessages.push(`ネットワークエラー: ${networkErrors.join(', ')}`);
          }
        }
        
        // モーダルのエラーメッセージを確認
        const modalError = page.locator('[role="dialog"] [class*="error"], [role="alert"]').first();
        if (await modalError.count() > 0 && await modalError.isVisible({ timeout: 2000 }).catch(() => false)) {
          const modalText = await modalError.textContent().catch(() => '');
          if (modalText) errorMessages.push(`モーダル: ${modalText}`);
        }
        
        // ページ上のエラーメッセージを確認
        const pageError = page.locator('text=/エラー|error|失敗|incorrect|invalid|Internal Server Error/i').first();
        if (await pageError.count() > 0 && await pageError.isVisible({ timeout: 2000 }).catch(() => false)) {
          const pageErrorText = await pageError.textContent().catch(() => '');
          if (pageErrorText) errorMessages.push(`ページ: ${pageErrorText}`);
        }
        
        // エラーメッセージを組み立て
        let errorDetails = '';
        if (errorParam) {
          errorDetails += `URLパラメータ: ${errorParam}\n`;
        }
        if (errorMessages.length > 0) {
          errorDetails += errorMessages.join('\n');
        } else {
          const bodyText = await page.textContent('body').catch(() => '');
          errorDetails += `ページ内容: ${bodyText.substring(0, 500)}`;
        }
        
        throw new Error(`ログインに失敗しました。URL: ${finalUrl}\n${errorDetails}`);
      }
      throw new Error(`ログイン後のリダイレクトがタイムアウトしました。現在のURL: ${finalUrl}`);
    }
  }
}

/**
 * ログアウト
 */
export async function logout(page: Page): Promise<void> {
  try {
    // ログアウトボタンを探す (複数 選択子 試行)
    const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout"), a:has-text("ログアウト")').first();
    
    // ボタンが あるか 確認
    const isVisible = await logoutButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      // ボタンが 安定化される時まで 待機
      await logoutButton.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      
      // スクロールして ボタンが 見えるように すべき
      await logoutButton.scrollIntoViewIfNeeded().catch(() => {});
      
      // ボタンが 活性化される時まで 待機
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      // force オプションで クリック (element detached  解決)
      await logoutButton.click({ force: true, timeout: 10000 }).catch(async (error) => {
        console.log('[logout] 最初の クリック 失敗, 再試行:', error.message);
        // 再試行: 新しい locatorで 再度 検索
        const retryButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout"), a:has-text("ログアウト")').first();
        await retryButton.click({ force: true, timeout: 5000 });
      });
      
      // ログインページにリダイレクトされることを確認
      try {
        await page.waitForURL(/\/login/, { timeout: 15000 });
      } catch (error) {
        // タイムアウトが 発生しても 現在 URL 確認して ログイン ページかどうか 確認
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
          // ログイン ページが または 強制で 移動
          await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
        }
      }
    } else {
      // ログアウト ボタンが なければ 既に ログアウト 状態の可能性がある
      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
      }
    }
  } catch {
    console.log('[logout] ログアウト 中 エラー 発生 (無視)');
    // エラーが 発生しても ログイン ページで 強制 移動
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }
  }
}

/**
 * ログイン状態を確認
 */
export async function expectLoggedIn(page: Page): Promise<void> {
  // ログインページにいないことを確認
  expect(page.url()).not.toContain('/login');
  
  // ログアウトボタンまたはユーザーメニューが表示されていることを確認
  const userMenu = page.locator('button:has-text("ログアウト"), [data-testid="user-menu"], [aria-label*="user"]').first();
  await expect(userMenu).toBeVisible({ timeout: 5000 });
}

/**
 * ログアウト状態を確認
 */
export async function expectLoggedOut(page: Page): Promise<void> {
  // ログインページにいることを確認
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
}

/**
 * テスト用ユーザーでログイン（loginWithEmailのエイリアス）
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await loginWithEmail(page, email, password);
}

/**
 * テスト用ユーザーを作成
 * 注意: 実際の実装に応じてAPIエンドポイントを調整してください
 */
export async function createTestUser(): Promise<{ email: string; password: string; userId?: number }> {
  /**
   * NOTE:
   *  現時点では 実際 回元の API(/api/register 等)を 呼び出さず,
   *  `.env.local` に 設定された 共用 テスト アカウント(TEST_EMAIL/TEST_PASSWORD)を
   *  そのまま 再使用する 方式で 通します.
   *
   *  - 長所: DBに 別途 ユーザーを 作成しないで 済むので, ログイン 失敗の 対部分 原因
   *          (存在しない メール, メール 未認証 等)を 避ける ことが あります.
   *  - 前提条件:
   *      1) 実際 サービス DBに TEST_EMAIL/TEST_PASSWORDで ログイン 可能な アカウントが 存在
   *      2) その アカウントは メール 認証 完了, 2FA 無効化, 停止/ロック 状態 ではない
   */

  const envEmail = process.env.TEST_EMAIL;
  const envPassword = process.env.TEST_PASSWORD;

  if (!envEmail || !envPassword) {
    throw new Error(
      '[createTestUser] TEST_EMAIL / TEST_PASSWORD 環境変数が 設定されて いません. ' +
      '.env.local または システム 環境変数を 確認してください.'
    );
  }

  // アカウント ロック 解除は loginUserで 処理 (管理者 権限 必要 時)

  return {
    email: envEmail,
    password: envPassword,
    userId: undefined,
  };
}

/**
 * テスト アカウント ロック 解除 (管理者 権限 必要)
 * 主に: が すべきなのは 管理者 セッションが ある ページ コンテキストで 呼び出すべき
 */
export async function unlockUserAccountByEmail(
  page: Page,
  email: string
): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  try {
    // 管理者 ページで ユーザー ID 照会 後 ロック 解除
    // または 直接 APIを 呼び出す (管理者 セッションが ある 場合)
    const response = await page.request.get(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(email)}`);
    
    if (response.ok()) {
      const users = await response.json();
      if (users && users.length > 0) {
        const userId = users[0].id;
        const unlockResponse = await page.request.post(`${BASE_URL}/api/admin/users/unlock`, {
          data: { userId }
        });
        
        if (unlockResponse.ok()) {
          console.log(`[unlockUserAccountByEmail] アカウント ロック 解除 成功: ${email}`);
        } else {
          console.warn(`[unlockUserAccountByEmail] アカウント ロック 解除 失敗: ${email}`);
        }
      }
    }
  } catch (error) {
    console.warn('[unlockUserAccountByEmail] アカウント ロック 解除 中 エラー (無視して 続行):', error);
  }
}

/**
 * アカウント ロック 解除 (管理字 API 使用)
 * 主に: が すべきなのは 管理者 権限が ある セッションで 呼び出すべき
 * 
 * 実際 システム:
 * - 管理者 ページ UI: /admin/users ページで "ロック解除" ボタン
 * - 管理者 API: /api/admin/users/unlock (SUPER_ADMIN 権限 必要)
 * - 15分 自動 解除: なし (時間が 経てば 次 ログイン 試行 時 効果的に 解除されるが, DB 値は そのまま)
 * - ログイン 成功 時: 自動で ロック 解除されます
 */
export async function resetAccountLockStatus(
  page: Page,
  email: string
): Promise<boolean> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  try {
    // CSRF トークン を取得
    const csrfResponse = await page.request.get(`${BASE_URL}/api/csrf-token`);
    let csrfToken: string | null = null;
    
    if (csrfResponse.ok()) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken || null;
    }
    
    // 管理者で ログインした 状態で API 呼び出し
    // 1. ユーザー 検索
    const response = await page.request.get(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(email)}`);
    
    if (response.ok()) {
      const users = await response.json();
      if (users && users.length > 0) {
        const userId = users[0].id;
        
        // 2. ロック 解除 API 呼び出し (CSRF トークン 含む)
        const headers: Record<string, string> = {};
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }
        
        const unlockResponse = await page.request.post(`${BASE_URL}/api/admin/users/unlock`, {
          data: { userId },
          headers
        });
        
        if (unlockResponse.ok()) {
          console.log(`[resetAccountLockStatus] アカウント ロック 解除 成功: ${email} (userId: ${userId})`);
          return true;
        } else {
          const errorData = await unlockResponse.json().catch(() => ({}));
          console.warn(`[resetAccountLockStatus] アカウント ロック 解除 失敗: ${email}`, errorData);
          return false;
        }
      } else {
        console.warn(`[resetAccountLockStatus] ユーザーを 探す ことが できません: ${email}`);
        return false;
      }
    } else {
      console.warn(`[resetAccountLockStatus] ユーザー 検索 失敗: ${email}`);
      return false;
    }
  } catch (error) {
    console.warn('[resetAccountLockStatus] アカウント ロック 解除 中 エラー:', error);
    return false;
  }
}
/**
 * テスト用ユーザーを削除
 */
export async function deleteTestUser(userId: number): Promise<void> {
  // 実際の実装に応じて、APIを呼び出してユーザーを削除
  // ここでは簡単な実装例を示します
  // 実際には /api/admin/users/delete などのエンドポイントを呼び出す必要があります
  console.log(`テストユーザー削除: userId=${userId}`);
}

/**
 * 要素をビューにスクロールしてから操作するヘルパー関数
 * Playwrightは自動的にスクロールしますが、明示的にスクロールを保証します
 */
export async function scrollIntoViewAndClick(
  page: Page,
  locator: ReturnType<Page['locator']>,
  options?: { timeout?: number }
): Promise<void> {
  // 要素が表示されるまで待つ
  await locator.waitFor({ state: 'visible', timeout: options?.timeout || 10000 });
  
  // 要素をビューにスクロール
  await locator.scrollIntoViewIfNeeded();
  
  // 少し待ってからクリック（アニメーション完了を待つ）
  await page.waitForTimeout(200);
  
  // クリック
  await locator.click();
}

/**
 * 要素をビューにスクロールしてから入力するヘルパー関数
 */
export async function scrollIntoViewAndFill(
  page: Page,
  locator: ReturnType<Page['locator']>,
  value: string,
  options?: { timeout?: number }
): Promise<void> {
  // 要素が表示されるまで待つ
  await locator.waitFor({ state: 'visible', timeout: options?.timeout || 10000 });
  
  // 要素をビューにスクロール
  await locator.scrollIntoViewIfNeeded();
  
  // 少し待ってから入力
  await page.waitForTimeout(200);
  
  // 入力
  await locator.fill(value);
}

