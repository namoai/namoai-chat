import { Page, expect } from '@playwright/test';

// 전역 변수: 연속 로그인 실패 횟수 추적 (테스트 간 공유)
let consecutiveLoginFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // 5번 이상 연속 실패 시 테스트 중지

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
  
  // 계정 잠금 에러 확인 및 처리
  try {
    const bodyText = await page.textContent('body').catch(() => '');
    if (/アカウントがロックされました|アカウントがロックされています/i.test(bodyText)) {
      consecutiveLoginFailures++;
      console.warn(`[loginWithEmail] 계정이 잠겨있습니다. (연속 실패: ${consecutiveLoginFailures}회)`);
      console.warn(`[loginWithEmail] 계정: ${email}`);
      
      // 5번 이상 연속 실패 시 테스트 중지
      if (consecutiveLoginFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[loginWithEmail] ⚠️ 경고: ${MAX_CONSECUTIVE_FAILURES}번 이상 연속으로 로그인 실패했습니다. 테스트를 중지합니다.`);
        console.error('[loginWithEmail] 해결 방법:');
        console.error('  1. 관리자 페이지에서 해당 계정의 잠금을 해제하거나');
        console.error('  2. DB에서 직접 잠금 해제: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
        throw new Error(`계정이 잠겨있습니다: ${email}. ${MAX_CONSECUTIVE_FAILURES}번 이상 연속 실패로 테스트를 중지합니다. 관리자 페이지에서 잠금을 해제하세요.`);
      }
      
      console.warn('[loginWithEmail] 해결 방법:');
      console.warn('  1. 관리자 페이지에서 해당 계정의 잠금을 해제하거나');
      console.warn('  2. DB에서 직접 잠금 해제: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
      throw new Error(`계정이 잠겨있습니다: ${email}. 관리자 페이지에서 잠금을 해제하거나 15분 후에 다시 시도하세요.`);
    }
  } catch (error) {
    // 이미 에러가 발생한 경우는 그대로 전달
    if (error instanceof Error && error.message.includes('계정이 잠겨있습니다')) {
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
      
      // ページ가 완전히 로드될 때까지 대기
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      
      // 추가 안정화 대기
      await page.waitForTimeout(1000);
    } catch {
      // 타임아웃이 발생해도 계속 진행
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
    // ログイン 성공: 연속 실패 횟수 리셋
    consecutiveLoginFailures = 0;
    
    // ポイント表示や主要要素が表示されるまで待つ（より確実な方法）
    try {
      // ポイントカードまたはマイページの主要要素が表示されるまで待つ
      await page.waitForSelector('text=/ポイント|残高|マイページ/i', { timeout: 10000 }).catch(() => {
        // 要素が見つからない場合でも続行
      });
    } catch {
      // タイム아ウトしても続行
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
    // ログ인 성공: 연속 실패 횟수 리셋
    consecutiveLoginFailures = 0;
    
    // ページが完全にロードされるまで待つ
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // networkidleがタイム아웃しても続行
    });
    return; // 既にログイン成功
  }
  
  // 2FAコード入力画面が表示されるか確認
  
  const twoFactorInput = page.locator('input[placeholder*="コード"], input[placeholder*="コード"], input[name*="code"]').first();
  
  if (await twoFactorInput.count() > 0 && await twoFactorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    // 2FAコード入力が必要な場合
    
    if (twoFactorCode) {
      // 2FA 코드 입력
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
        // 2FA가 필요한데 코드가 없으면 에러
        throw new Error(
          '2FA가 활성화된 계정입니다. 다음 중 하나를 수행하세요:\n' +
          '1. 환경 변수 TEST_2FA_CODE를 설정\n' +
          '2. 테스트용 계정의 2FA를 비활성화\n' +
          '3. loginWith2FA() 함수를 사용하여 2FA 코드를 제공'
        );
      }
    }
  } else {
    // 2FA가 없는場合、通常のログイン完了を待つ
    try {
      await page.waitForURL(/\/(MyPage|mypage|home|dashboard|admin|complete-profile)/i, { timeout: 15000 });
      // URL変更成功後、MyPageの場合はデータロード完了を待つ
      const finalUrl = page.url();
      // ロ그인 성공: 연속 실패 횟수 리셋
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
        // ロ그인 성공: 연속 실패 횟수 리셋
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
      // エラーページにリダイレクトされた場合
      if (finalUrl.includes('/api/auth/error') || finalUrl.includes('/login')) {
        // 로그인 실패: 연속 실패 횟수 증가
        consecutiveLoginFailures++;
        
        // URLパラメータのエラーを 확인
        const urlParams = new URL(finalUrl).searchParams;
        const errorParam = urlParams.get('error');
        
        // 페이지에서 에러 메시지 확인 (빠른 확인)
        const bodyText = await page.textContent('body').catch(() => '');
        const isLocked = /アカウントがロックされました|アカウントがロックされています/i.test(bodyText);
        const isSuspended = /アカウント停止中|アカウントが停止されています/i.test(bodyText);
        
        // 상세한 로그 출력
        console.warn(`[loginWithEmail] 로그인 실패 (연속 실패: ${consecutiveLoginFailures}회)`);
        console.warn(`[loginWithEmail] 계정: ${email}`);
        console.warn(`[loginWithEmail] 현재 URL: ${finalUrl}`);
        if (errorParam) {
          console.warn(`[loginWithEmail] 에러 파라미터: ${errorParam}`);
        }
        if (isLocked) {
          console.warn(`[loginWithEmail] ⚠️ 계정이 잠금 상태입니다.`);
        }
        if (isSuspended) {
          console.warn(`[loginWithEmail] ⚠️ 계정이 정지 상태입니다.`);
        }
        
        // 5번 이상 연속 실패 시 테스트 중지
        if (consecutiveLoginFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(`[loginWithEmail] ⚠️ 경고: ${MAX_CONSECUTIVE_FAILURES}번 이상 연속으로 로그인 실패했습니다. 테스트를 중지합니다.`);
          console.error('[loginWithEmail] 해결 방법:');
          console.error('  1. 관리자 페이지에서 해당 계정의 잠금을 해제하거나');
          console.error('  2. DB에서 직접 잠금 해제: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?');
          throw new Error(`로그인 실패: ${email}. ${MAX_CONSECUTIVE_FAILURES}번 이상 연속 실패로 테스트를 중지합니다. 관리자 페이지에서 잠금을 해제하세요.`);
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
    // ログアウトボタンを探す (여러 선택자 시도)
    const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout"), a:has-text("ログアウト")').first();
    
    // 버튼이 있는지 확인
    const isVisible = await logoutButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isVisible) {
      // 버튼이 안정화될 때까지 대기
      await logoutButton.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      
      // 스크롤하여 버튼이 보이도록 함
      await logoutButton.scrollIntoViewIfNeeded().catch(() => {});
      
      // 버튼이 활성화될 때까지 대기
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      // force 옵션으로 클릭 (element detached 문제 해결)
      await logoutButton.click({ force: true, timeout: 10000 }).catch(async (error) => {
        console.log('[logout] 첫 번째 클릭 실패, 재시도:', error.message);
        // 재시도: 새로운 locator로 다시 찾기
        const retryButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout"), a:has-text("ログアウト")').first();
        await retryButton.click({ force: true, timeout: 5000 });
      });
      
      // ログインページにリダイレクトされることを確認
      try {
        await page.waitForURL(/\/login/, { timeout: 15000 });
      } catch (error) {
        // 타임아웃이 발생해도 현재 URL 확인하여 로그인 페이지인지 확인
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
          // 로그인 페이지가 아니면 강제로 이동
          await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
        }
      }
    } else {
      // 로그아웃 버튼이 없으면 이미 로그아웃 상태일 수 있음
      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
      }
    }
  } catch {
    console.log('[logout] 로그아웃 중 오류 발생 (무시)');
    // 오류가 발생해도 로그인 페이지로 강제 이동
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
   *  現時点では 실제 회원가입 API(/api/register 등)를 호출하지 않고,
   *  `.env.local` 에 정의된 공용 테스트 계정(TEST_EMAIL/TEST_PASSWORD)을
   *  그대로 재사용하는 방식으로 통일합니다.
   *
   *  - 장점: DB에 별도 유저를 만들지 않아도 되므로, 로그인 실패의 대부분 원인
   *          (존재하지 않는 이메일, 이메일 미인증 등)을 피할 수 있습니다.
   *  - 전제조건:
   *      1) 실제 서비스 DB에 TEST_EMAIL/TEST_PASSWORD로 로그인 가능한 계정이 존재
   *      2) 그 계정은 이메일 인증 완료, 2FA 비활성화, 정지/락 상태 아님
   */

  const envEmail = process.env.TEST_EMAIL;
  const envPassword = process.env.TEST_PASSWORD;

  if (!envEmail || !envPassword) {
    throw new Error(
      '[createTestUser] TEST_EMAIL / TEST_PASSWORD 환경변수가 설정되어 있지 않습니다. ' +
      '.env.local 또는 시스템 환경변수를 확인하세요.'
    );
  }

  // 계정 잠금 해제는 loginUser에서 처리 (관리자 권한 필요 시)

  return {
    email: envEmail,
    password: envPassword,
    userId: undefined,
  };
}

/**
 * 테스트 계정 잠금 해제 (관리자 권한 필요)
 * 주의: 이 함수는 관리자 세션이 있는 페이지 컨텍스트에서 호출해야 함
 */
export async function unlockUserAccountByEmail(
  page: Page,
  email: string
): Promise<void> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  try {
    // 관리자 페이지에서 사용자 ID 조회 후 잠금 해제
    // 또는 직접 API를 호출 (관리자 세션이 있는 경우)
    const response = await page.request.get(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(email)}`);
    
    if (response.ok()) {
      const users = await response.json();
      if (users && users.length > 0) {
        const userId = users[0].id;
        const unlockResponse = await page.request.post(`${BASE_URL}/api/admin/users/unlock`, {
          data: { userId }
        });
        
        if (unlockResponse.ok()) {
          console.log(`[unlockUserAccountByEmail] 계정 잠금 해제 성공: ${email}`);
        } else {
          console.warn(`[unlockUserAccountByEmail] 계정 잠금 해제 실패: ${email}`);
        }
      }
    }
  } catch (error) {
    console.warn('[unlockUserAccountByEmail] 계정 잠금 해제 중 오류 (무시하고 계속):', error);
  }
}

/**
 * 계정 잠금 해제 (관리자 API 사용)
 * 주의: 이 함수는 관리자 권한이 있는 세션에서 호출해야 함
 * 
 * 실제 시스템:
 * - 관리자 페이지 UI: /admin/users 페이지에서 "ロック解除" 버튼
 * - 관리자 API: /api/admin/users/unlock (SUPER_ADMIN 권한 필요)
 * - 15분 자동 해제: 없음 (시간이 지나면 다음 로그인 시도 시 효과적으로 해제되지만, DB 값은 그대로)
 * - 로그인 성공 시: 자동으로 잠금 해제됨
 */
export async function resetAccountLockStatus(
  page: Page,
  email: string
): Promise<boolean> {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  
  try {
    // CSRF 토큰 가져오기
    const csrfResponse = await page.request.get(`${BASE_URL}/api/csrf-token`);
    let csrfToken: string | null = null;
    
    if (csrfResponse.ok()) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken || null;
    }
    
    // 관리자로 로그인한 상태에서 API 호출
    // 1. 사용자 검색
    const response = await page.request.get(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(email)}`);
    
    if (response.ok()) {
      const users = await response.json();
      if (users && users.length > 0) {
        const userId = users[0].id;
        
        // 2. 잠금 해제 API 호출 (CSRF 토큰 포함)
        const headers: Record<string, string> = {};
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }
        
        const unlockResponse = await page.request.post(`${BASE_URL}/api/admin/users/unlock`, {
          data: { userId },
          headers
        });
        
        if (unlockResponse.ok()) {
          console.log(`[resetAccountLockStatus] 계정 잠금 해제 성공: ${email} (userId: ${userId})`);
          return true;
        } else {
          const errorData = await unlockResponse.json().catch(() => ({}));
          console.warn(`[resetAccountLockStatus] 계정 잠금 해제 실패: ${email}`, errorData);
          return false;
        }
      } else {
        console.warn(`[resetAccountLockStatus] 사용자를 찾을 수 없음: ${email}`);
        return false;
      }
    } else {
      console.warn(`[resetAccountLockStatus] 사용자 검색 실패: ${email}`);
      return false;
    }
  } catch (error) {
    console.warn('[resetAccountLockStatus] 계정 잠금 해제 중 오류:', error);
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

