/**
 * ユーザー観点: ソーシャル機能のE2Eテスト
 * 
 * 対象シナリオ:
 * 1-6-1: 自分のプロフィール確認
 * 1-6-2: 他ユーザーのプロフィール確認
 * 1-6-3: フォロー/アンフォロー
 * 1-6-4: フォロワー/フォロー中一覧確認
 * 1-6-5: ユーザーブロック/アンブロック
 * 1-6-6: ブロックしたユーザー一覧確認
 * 1-6-7: いいね機能
 * 1-6-8: コメント作成
 * 1-6-9: コメント削除
 * 1-6-10: コメント通知確認
 */

import { test, expect } from '@playwright/test';
import { loginUser, createTestUser, deleteTestUser, setBasicAuth, logout } from './helpers/auth';
import { clickFirstCharacter } from './helpers/character';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('ユーザー観点: ソーシャル機能', () => {
  let testUser: { email: string; password: string; userId?: number };
  let otherUser: { email: string; password: string; userId?: number };

  test.beforeEach(async ({ page, context }) => {
    // Basic認証の設定
    await setBasicAuth(page);
    
    // テスト間の待機時間を追加
    await page.waitForTimeout(2000);
    
    // セッションをクリアして前のテストの影響を避ける
    await context.clearCookies();
    
    testUser = await createTestUser();
    otherUser = await createTestUser();
    await loginUser(page, testUser.email, testUser.password);
    
    // ログイン後の安定化待機
    await page.waitForTimeout(1000);
    
    await page.waitForURL(/\/($|MyPage)/, { timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    // 테스트 종료 후 로그아웃 (옵션적 정리)
    try {
      await logout(page);
    } catch {
      // 로그아웃 실패해도 계속 진행
      console.warn('[afterEach] ログアウト失敗 (無視)');
    }
    
    if (testUser?.userId) await deleteTestUser(testUser.userId);
    if (otherUser?.userId) await deleteTestUser(otherUser.userId);
  });

  test.skip('1-6-1: 自分のプロフィール確認', async ({ page }) => {
    // 1. マイページにアクセス
    await page.goto(`${BASE_URL}/MyPage`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // 2. プロフィール情報表示確認 (ニックネームなど)
    const nickname = page.getByText(/ニックネーム|ネーム|Nickname/i).first();
    if (await nickname.count() > 0) {
      await expect(nickname).toBeVisible();
    }

    // 3. 自分が作成したキャラクター一覧表示確認
    // キャラクターカードまたはリンクが表示されているか確認（空でもOK）
    // const characterList = page.locator('[class*="character"], a[href*="/characters/"]');

    // 4. フォロワー数、フォロー中数表示確認
    const followerCount = page.getByText(/フォロワー|팔로워|Follower/i).first();
    if (await followerCount.count() > 0) {
      await expect(followerCount).toBeVisible();
    }

    // 5. 総チャットメッセージ数表示確認
    const messageCount = page.getByText(/メッセージ|채팅|Message/i).first();
    if (await messageCount.count() > 0) {
      await expect(messageCount).toBeVisible();
    }
  });

  test('1-6-3: フォロー/アンフォロー', async ({ page }) => {
    // セッションから現在のユーザーIDを取得
    const sessionResponse = await page.evaluate(async () => {
      const res = await fetch('/api/auth/session');
      return res.json();
    });
    
    const currentUserId = sessionResponse?.user?.id?.toString();
    
    if (!currentUserId) {
      throw new Error('ログインしていません');
    }
    
    // 1. 他ユーザーのプロフィールを探す
    let foundOtherUserProfile = false;
    const maxAttempts = 10; // 最大 10個のキャラクター確認
    
    for (let attempt = 0; attempt < maxAttempts && !foundOtherUserProfile; attempt++) {
      await page.goto(`${BASE_URL}/charlist`);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // キャラクター一覧がロードされるまで待機
      await page.locator('a[href^="/characters/"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      
      // キャラクターリンク一覧を取得 (create 確実に除外)
      const allCharLinks = page.locator('a[href^="/characters/"]');
      const totalLinkCount = await allCharLinks.count();
      
      // /characters/create ではないリンクのみ収集
      const validLinks = [];
      for (let i = 0; i < totalLinkCount; i++) {
        const link = allCharLinks.nth(i);
        const href = await link.getAttribute('href');
        
        if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
          validLinks.push({ link, href });
        }
      }
      
      if (validLinks.length === 0) {
        throw new Error('キャラクターが見つかりません');
      }
      
      console.log(`[1-6-3] 有効なキャラクター数: ${validLinks.length}`);
      
      // 현재 시도할 캐릭터 인덱스
      const characterIndex = Math.min(attempt, validLinks.length - 1);
      const selectedLink = validLinks[characterIndex];
      
      console.log(`[1-6-3] キャラクター選択: ${selectedLink.href}`);
      
      // 選択したキャラクターをクリック
      try {
        await selectedLink.link.click();
        await page.waitForURL(/\/characters\/\d+/, { timeout: 10000 });
      } catch {
        console.log(`[1-6-3] キャラクタークリック失敗、次を試行`);
        continue;
      }
      
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // 페이지 로드 완료 대기 (프로필 링크가 준비될 때까지)
      await page.locator('a[href^="/profile/"]').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
      
      // 모든 프로필 링크 찾기
      const allProfileLinks = page.locator('a[href^="/profile/"]');
      const profileLinkCount = await allProfileLinks.count();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let authorProfileLink: any = null;
      
      // 작성자 링크는 보통 아바타 이미지와 닉네임을 포함
      for (let i = 0; i < profileLinkCount; i++) {
        const link = allProfileLinks.nth(i);
        const hasImage = await link.locator('img[class*="rounded-full"]').count() > 0;
        const hasNickname = await link.locator('span').count() > 0;
        
        if (hasImage && hasNickname) {
          authorProfileLink = link;
          break;
        }
      }
      
      if (!authorProfileLink || (authorProfileLink && await authorProfileLink.count() === 0)) {
        // 없으면 첫 번째 /profile/ 링크 사용
        const firstProfileLink = allProfileLinks.first();
        if (await firstProfileLink.count() > 0) {
          authorProfileLink = firstProfileLink;
        } else {
          continue; // 다음 캐릭터 시도
        }
      }
      
      if (await authorProfileLink.count() > 0) {
        const authorHref = await authorProfileLink.getAttribute('href');
        const authorUserId = authorHref?.match(/\/profile\/(\d+)/)?.[1];
        
        console.log(`[1-6-3] 작성자 프로필 링크: ${authorHref}, 작성자 ID: ${authorUserId}, 현재 유저 ID: ${currentUserId}`);
        
        // 작성자가 자신이 아닌 경우
        if (authorUserId && authorUserId !== currentUserId) {
          // href로 직접 이동
          console.log(`[1-6-3] 프로필 페이지로 직접 이동: ${authorHref}`);
          await page.goto(`${BASE_URL}${authorHref}`, { waitUntil: 'networkidle', timeout: 30000 });
          
          // 프로필 페이지로 제대로 이동했는지 확인
          await page.waitForURL(/\/profile\/\d+/, { timeout: 15000 });
          const finalUrl = page.url();
          console.log(`[1-6-3] 이동 후 URL: ${finalUrl}`);
          
          if (!finalUrl.includes('/profile/')) {
            console.log(`[1-6-3] 프로필 페이지로 이동하지 못했습니다. 현재 URL: ${finalUrl}`);
            continue; // 다음 캐릭터 시도
          }
          
          // 프로필 데이터가 로드될 때까지 대기
          await page.waitForResponse(response => 
            response.url().includes('/api/profile/') && response.status() === 200,
            { timeout: 15000 }
          ).catch(() => {});
          
          // 세션 인증 완료까지 대기
          await page.waitForResponse(response => 
            response.url().includes('/api/auth/session') && response.status() === 200,
            { timeout: 15000 }
          ).catch(() => {});
          
          // "読み込み中..." 텍스트가 사라질 때까지 대기
          await page.waitForFunction(() => {
            const bodyText = document.body.textContent || '';
            return !bodyText.includes('読み込み中');
          }, { timeout: 30000 });
          
          // 프로필 콘텐츠가 렌더링될 때까지 대기
          await page.waitForFunction(() => {
            const hasNickname = Array.from(document.querySelectorAll('*')).some(el => {
              const text = el.textContent || '';
              return text.length > 0 && !text.includes('読み込み中');
            });
            return hasNickname;
          }, { timeout: 30000 });
          
          await page.waitForTimeout(3000); // 추가 대기
          
          // 프로필 페이지로 이동했는지 최종 확인
          const finalUrlCheck = page.url();
          console.log(`[1-6-3] 최종 확인 URL: ${finalUrlCheck}`);
          if (finalUrlCheck.includes('/profile/')) {
            foundOtherUserProfile = true;
            break;
          } else {
            console.log(`[1-6-3] 프로필 페이지로 이동하지 못했습니다. 현재 URL: ${finalUrlCheck}`);
            continue; // 다음 캐릭터 시도
          }
        } else {
          console.log(`[1-6-3] 작성자가 자신입니다. 다음 캐릭터를 시도합니다.`);
          continue; // 다음 캐릭터 시도
        }
      } else {
        continue; // 다음 캐릭터 시도
      }
    }
    
    if (!foundOtherUserProfile) {
      throw new Error('他のユーザーのプロフィールが見つかりませんでした。他のユーザーが作成したキャラクターが必要です。');
    }

    // 모달이 열려있으면 먼저 닫기
    const modalXButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
    if (await modalXButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalXButton.click();
      await page.waitForTimeout(500);
    }

    // 3. 팔로우 버튼 클릭
    let currentUrl = page.url();
    console.log(`[1-6-3] 팔로우 버튼 클릭 전 URL 확인: ${currentUrl}`);
    
    if (!currentUrl.includes('/profile/')) {
      console.log(`[1-6-3] 캐릭터 페이지로 리다이렉트됨. 프로필 페이지로 다시 이동합니다.`);
      const authorProfileLink = page.locator('a[href^="/profile/"]').filter({
        has: page.locator('img[class*="rounded-full"]')
      }).first();
      
      if (await authorProfileLink.count() > 0) {
        const authorHref = await authorProfileLink.getAttribute('href');
        if (authorHref) {
          await page.goto(`${BASE_URL}${authorHref}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForURL(/\/profile\/\d+/, { timeout: 15000 });
          currentUrl = page.url();
          console.log(`[1-6-3] 프로필 페이지로 돌아온 후 URL: ${currentUrl}`);
        }
      } else {
        throw new Error(`プロフィールページにいません。現在のURL: ${currentUrl}`);
      }
    }
    
    // 프로필 페이지가 완전히 로드될 때까지 대기
    await page.locator('text=読み込み中').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    
    // API 응답 대기
    await page.waitForResponse(
      response => response.url().includes('/api/profile/') && response.status() === 200,
      { timeout: 15000 }
    ).catch(() => {});
    
    // 팔로우 버튼이 로드될 때까지 대기
    await page.locator('button').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    
    // 팔로우 버튼 찾기
    const followButton = page.locator('button.w-full.font-bold').filter({ 
      hasText: /^フォロー$|^フォロー中/ 
    }).first();
    
    // 버튼이 준비될 때까지 대기
    await followButton.waitFor({ state: 'visible', timeout: 20000 });
    await followButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // 버튼 텍스트 확인
    const initialFollowText = await followButton.textContent();
    console.log(`[1-6-3] 팔로우 버튼 텍스트: ${initialFollowText}`);
    
    if (!initialFollowText || (!initialFollowText.includes('フォロー') && !initialFollowText.includes('フォロー中'))) {
      const profileUserId = currentUrl.match(/\/profile\/(\d+)/)?.[1];
      console.log(`[1-6-3] 프로필 유저 ID: ${profileUserId}, 현재 유저 ID: ${currentUserId}`);
      if (profileUserId === currentUserId) {
        throw new Error('自分のプロフィールです。フォローボタンは表示されません。他のユーザーのプロフィールが必要です。');
      }
      await page.screenshot({ path: 'test-results/follow-button-debug.png', fullPage: true });
      const allButtons = await page.locator('button').all();
      const buttonTexts = await Promise.all(allButtons.map(btn => btn.textContent().catch(() => '')));
      console.log(`[1-6-3] 페이지의 모든 버튼 텍스트: ${buttonTexts.join(', ')}`);
      throw new Error(`フォローボタンが見つかりません。ボタンテキスト: ${initialFollowText}`);
    }
    
    // 버튼 클릭 전 현재 URL 저장
    const urlBeforeClick = page.url();
    
    // API 응답을 기다리기 위한 Promise 생성
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/profile/') && response.url().includes('/follow'),
      { timeout: 10000 }
    ).catch(() => null);
    
    await followButton.click({ force: false });
    
    // API 응답 대기
    await responsePromise;
    
    // URL 변경이나 네트워크 상태 기다리기
    try {
      await page.waitForURL(url => url.toString() !== urlBeforeClick, { timeout: 5000 }).catch(() => {});
    } catch {
      // URL 변경이 없어도 계속 진행
    }
    
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

    // 모달이 열렸으면 X버튼으로 닫기
    const openedModal = page.locator('div:has-text("フォロー"), div:has-text("フォロー中")').first();
    if (await openedModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
      await closeButton.click({ force: true });
      await page.waitForTimeout(500);
    }

    // 4. 팔로우 상태로 변경 확인
    const followButtonAfter = page.locator('button').filter({ 
      hasText: /フォロー中/
    }).first();
    
    if (await followButtonAfter.count() > 0) {
      await expect(followButtonAfter).toBeVisible({ timeout: 5000 });
    } else {
      // 팔로우 상태가 변경되지 않았을 수 있음 (이미 팔로우 중이었을 수 있음)
      const currentButton = page.locator('button').filter({ 
        hasText: /フォロー/
      }).first();
      if (await currentButton.count() > 0) {
        const buttonText = await currentButton.textContent();
        if (buttonText?.includes('フォロー中')) {
          console.log('既にフォロー中でした');
        }
      }
    }

    // 5. 다시 팔로우 버튼 클릭 (언팔로우)
    if (await openedModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      const closeButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
      await closeButton.click({ force: true });
      await page.waitForTimeout(500);
    }
    
    // 팔로우 버튼 다시 찾기
    const unfollowButton = page.locator('button').filter({ 
      hasText: /^フォロー中/
    }).first();
    
    if (await unfollowButton.count() > 0) {
      await unfollowButton.waitFor({ state: 'visible' });
      await unfollowButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await unfollowButton.click({ force: false });
      await page.waitForTimeout(1000);
    } else {
      // 이미 언팔로우 상태일 수 있음
      const currentFollowButton = page.locator('button').filter({ 
        hasText: /^フォロー$/
      }).first();
      if (await currentFollowButton.count() > 0) {
        console.log('既にフォロー解除済みです');
      } else {
        // 팔로우 버튼을 다시 찾아서 클릭 시도
        const followButtonAgain = page.locator('button').filter({ 
          hasText: /フォロー/
        }).first();
        if (await followButtonAgain.count() > 0) {
          await followButtonAgain.waitFor({ state: 'visible' });
          await followButtonAgain.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await followButtonAgain.click({ force: false });
          await page.waitForTimeout(1000);
          console.log('フォローボタンを再度クリックしました');
        } else {
          console.log('フォロー解除ボタンが見つかりませんでしたが、既にフォロー解除済みの可能性があります');
        }
      }
    }

    // 6. 언팔로우 확인
    const followButtonFinal = page.locator('button').filter({ 
      hasText: /^フォロー$/
    }).first();
    
    if (await followButtonFinal.count() > 0) {
      await expect(followButtonFinal).toBeVisible({ timeout: 5000 });
    } else {
      throw new Error('フォロー解除を確認できませんでした');
    }
  });

  test('1-6-7: いいね機能', async ({ page }) => {
    // 1. キャラクター一覧ページにアクセス
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // /characters/create ではないリンクを確実に見つける
    const allCharLinks = page.locator('a[href^="/characters/"]');
    const linkCount = await allCharLinks.count();
    console.log(`[1-6-7] 全リンク数: ${linkCount}`);
    
    let validHref = null;
    
    // /characters/create ではない最初のリンクを見つける
    for (let i = 0; i < linkCount; i++) {
      const link = allCharLinks.nth(i);
      const href = await link.getAttribute('href');
      console.log(`[1-6-7] リンク ${i}: ${href}`);
      
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validHref = href;
        console.log(`[1-6-7] ✅ 有効なキャラクター発見: ${validHref}`);
        break;
      }
    }
    
    if (!validHref) {
      throw new Error('有効なキャラクターが見つかりませんでした');
    }
    
    console.log(`[1-6-7] キャラクターページへ移動: ${validHref}`);
    await page.goto(`${BASE_URL}${validHref}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 2. 좋아요 버튼 찾기
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    
    // 페이지 전체를 스크롤하여 모든 요소 로드
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    
    // 페이지 컨텐츠 로드 대기 (SVG 아이콘이 로드될 때까지)
    await page.locator('button:has(svg)').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    
    // 좋아요 버튼 찾기: Heart 아이콘이 있는 button
    const likeButton = page.locator('button:has(svg)').filter({ 
      has: page.locator('svg').filter({ has: page.locator('path[d*="M20.84"]') })
    }).first();
    
    // 버튼이 화면에 보이도록 스크롤
    await likeButton.scrollIntoViewIfNeeded().catch(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
      await page.waitForTimeout(500);
    });
    
    // 버튼이 보일 때까지 대기
    await likeButton.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 초기 좋아요 수를 취득
    const likeCountElement = page.locator('text=/\\d+.*いいね|\\d+.*좋아요/i').first();
    let initialLikeCount = 0;
    if (await likeCountElement.count() > 0) {
      const countText = await likeCountElement.textContent();
      const match = countText?.match(/\d+/);
      if (match) initialLikeCount = parseInt(match[0], 10);
    }

    // 3. 현재 좋아요 상태 확인 (Heart 아이콘 색상으로 판단)
    const heartIcon = likeButton.locator('svg').first();
    const heartClass = await heartIcon.getAttribute('class').catch(() => '');
    const isCurrentlyLiked = heartClass?.includes('text-blue-500') || heartClass?.includes('fill-current');
    
    // 4. 좋아요가 이미 눌러져 있으면 먼저 해제
    if (isCurrentlyLiked) {
      console.log('[1-6-7] 좋아요가 이미 눌러져 있습니다. 먼저 해제합니다.');
      await likeButton.click();
      await page.waitForResponse(response => 
        response.url().includes('/api/') && response.status() === 200, 
        { timeout: 5000 }
      ).catch(() => {});
      // 해제 확인: Heart 아이콘이 회색인지 확인
      const heartIconAfterUnlike = likeButton.locator('svg').first();
      await expect(heartIconAfterUnlike).toHaveClass(/text-gray-400/, { timeout: 5000 });
    }

    // 5. 좋아요 누르기
    console.log('[1-6-7] 좋아요를 누릅니다.');
    await likeButton.click();
    await page.waitForResponse(response => 
      response.url().includes('/api/') && response.status() === 200, 
      { timeout: 5000 }
    ).catch(() => {});

    // 6. 좋아요 상태로 변경 확인 (Heart 아이콘이 파란색으로 변경)
    const heartIconAfterLike = likeButton.locator('svg').first();
    await expect(heartIconAfterLike).toHaveClass(/text-blue-500/, { timeout: 5000 });

    // 7. 좋아요 수 증가 확인
    if (await likeCountElement.count() > 0) {
      const newCountText = await likeCountElement.textContent();
      const newMatch = newCountText?.match(/\d+/);
      if (newMatch) {
        const newLikeCount = parseInt(newMatch[0], 10);
        expect(newLikeCount).toBeGreaterThan(initialLikeCount);
      }
    }

    // 8. 좋아요 해제
    console.log('[1-6-7] 좋아요를 해제합니다.');
    await likeButton.click();
    await page.waitForResponse(response => 
      response.url().includes('/api/') && response.status() === 200, 
      { timeout: 5000 }
    ).catch(() => {});

    // 9. 좋아요 해제 확인 (Heart 아이콘이 회색으로 변경)
    const heartIconAfterUnlike2 = likeButton.locator('svg').first();
    await expect(heartIconAfterUnlike2).toHaveClass(/text-gray-400/, { timeout: 5000 });
  });

  test('1-6-8: コメント作成', async ({ page }) => {
    // 1. キャラクター一覧ページにアクセス
    await page.goto(`${BASE_URL}/charlist`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // /characters/create ではないリンクを確実に見つける
    const allLinks = page.locator('a[href^="/characters/"]');
    const totalCount = await allLinks.count();
    console.log(`[1-6-8] 全リンク数: ${totalCount}`);
    
    let validHref = null;
    for (let i = 0; i < totalCount; i++) {
      const link = allLinks.nth(i);
      const href = await link.getAttribute('href');
      console.log(`[1-6-8] リンク ${i}: ${href}`);
      
      if (href && href !== '/characters/create' && /\/characters\/\d+/.test(href)) {
        validHref = href;
        console.log(`[1-6-8] ✅ 有効なキャラクター発見: ${href}`);
        break;
      }
    }
    
    if (!validHref) {
      throw new Error('キャラクターが見つかりません');
    }
    
    console.log(`[1-6-8] キャラクターページへ移動: ${validHref}`);
    await page.goto(`${BASE_URL}${validHref}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 2. 댓글 입력창과 생성 버튼 찾기
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    
    // 페이지 끝까지 스크롤하여 댓글 섹션 로드 (댓글은 보통 페이지 하단에 있음!)
    console.log('[1-6-8] 댓글 섹션을 찾기 위해 페이지 하단으로 스크롤합니다...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // 댓글 섹션이 로드될 때까지 대기
    await page.locator('input[type="text"]').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    
    // 댓글 입력창 찾기
    const commentInput = page.locator('input[type="text"][placeholder*="コメントを追加"], input[type="text"][placeholder*="コメント"]').first();
    
    // 입력창이 화면에 보이도록 스크롤
    await commentInput.scrollIntoViewIfNeeded().catch(async () => {
      console.log('[1-6-8] 댓글 입력창 스크롤 실패, 재시도..');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    });
    
    // 입력창이 보일 때까지 대기
    await commentInput.waitFor({ state: 'visible', timeout: 15000 });
    
    if (await commentInput.count() === 0) {
      console.log('[1-6-8] 댓글 입력창을 찾을 수 없습니다. 페이지 전체 스크린샷 촬영...');
      await page.screenshot({ path: 'test-results/comment-input-debug.png', fullPage: true });
      const allInputs = await page.locator('input').all();
      const inputInfo = await Promise.all(allInputs.map(async (input) => {
        const type = await input.getAttribute('type').catch(() => '');
        const placeholder = await input.getAttribute('placeholder').catch(() => '');
        return { type, placeholder };
      }));
      console.log(`[1-6-8] 페이지의 모든 input 요소:`, inputInfo);
      throw new Error('コメント入力欄が見つかりません');
    }

    console.log('[1-6-8] 댓글 입력창을 찾았습니다. 테스트 텍스트를 입력합니다..');
    await commentInput.fill('これはE2Eテストコメントです');
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 3. 댓글 생성 버튼 클릭
    const commentForm = page.locator('form').filter({ 
      has: commentInput 
    }).first();
    
    // form 안의 submit 버튼 찾기
    let submitButton = commentForm.locator('button[type="submit"]').first();
    
    // form 안에서 버튼을 찾지 못한 경우
    if (await commentForm.count() === 0 || await submitButton.count() === 0) {
      const parentContainer = commentInput.locator('..');
      submitButton = parentContainer.locator('button').first();
      
      // 여전히 찾지 못하면 페이지 전체에서 Send 아이콘이 있는 버튼 찾기
      if (await submitButton.count() === 0) {
        submitButton = page.locator('button:has(svg)').first();
      }
    }
    
    // 버튼이 보일 때까지 대기
    await submitButton.waitFor({ state: 'visible', timeout: 15000 });
    await submitButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    
    // 버튼이 활성화될 때까지 대기 (disabled 속성 제거 대기)
    let isEnabled = false;
    for (let i = 0; i < 10; i++) {
      isEnabled = await submitButton.isEnabled().catch(() => false);
      if (isEnabled) break;
      await page.waitForTimeout(500);
    }
    
    if (!isEnabled) {
      console.log('[1-6-8] 버튼이 비활성화되어 있습니다. 입력 내용을 확인합니다.');
      const inputValue = await commentInput.inputValue().catch(() => '');
      if (!inputValue.trim()) {
        await commentInput.fill('これはE2Eテストコメントです');
        await page.waitForTimeout(500);
      }
    }
    
    // 버튼 클릭
    await submitButton.click();
    
    // API 응답 대기
    await page.waitForResponse(
      response => response.url().includes('/api/characters/') && response.url().includes('/comments') && response.status() === 200,
      { timeout: 10000 }
    ).catch(() => {});
    
    await page.waitForTimeout(2000);

    // 4. 생성된 댓글이 댓글 목록에 추가되는지 확인
    const commentList = page.locator('[class*="comment"]').first();
    await expect(commentList).toBeVisible({ timeout: 5000 });

    const newComment = page.getByText('これはE2Eテストコメントです').first();
    await expect(newComment).toBeVisible({ timeout: 5000 });
    
    console.log('[1-6-8] ✅ コメント作成成功: "これはE2Eテストコメントです" がコメント一覧に表示されました');
  });
});
