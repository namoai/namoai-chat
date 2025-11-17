#!/usr/bin/env node

/**
 * API 테스트 러너 (CLI 버전)
 * 
 * 사용법:
 *   node scripts/test-runner.mjs [옵션]
 * 
 * 옵션:
 *   --url <url>            API 서버 URL (기본값: http://localhost:3000)
 *   --email <email>        로그인 이메일 (필수)
 *   --password <password>  로그인 비밀번호 (필수)
 *   --category <name>     특정 카테고리만 테스트
 *   --test <name>         특정 테스트만 실행
 *   --json                 JSON 형식으로 출력
 *   --output <file>        결과를 파일로 저장
 *   --ai-analysis          AI 분석 포함
 *   --auto-create          테스트용 캐릭터 자동 생성 (없을 경우)
 *   --help                 도움말 표시
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 전역 변수
let baseUrl = process.env.API_URL || 'http://localhost:3000';
let cookies = '';
let testCharacterId = null;
let testUserId = null;
let globalOptions = { autoCreate: false };

function parseExistingCookies() {
  if (!cookies) return new Map();
  const map = new Map();
  cookies
    .split(/;\s*/)
    .filter(Boolean)
    .forEach(entry => {
      const [name, ...rest] = entry.split('=');
      if (!name) return;
      map.set(name.trim(), rest.join('=').trim());
    });
  return map;
}

function extractSetCookieHeaders(responseHeaders) {
  if (!responseHeaders) return [];

  if (typeof responseHeaders.getSetCookie === 'function') {
    const result = responseHeaders.getSetCookie();
    if (result?.length) return result;
  }

  if (typeof responseHeaders.raw === 'function') {
    const raw = responseHeaders.raw()['set-cookie'];
    if (raw?.length) return raw;
  }

  const single = responseHeaders.get?.('set-cookie');
  return single ? [single] : [];
}

// 쿠키 파싱 및 저장
function setCookies(responseHeaders) {
  const setCookieHeaders = extractSetCookieHeaders(responseHeaders);
  if (!setCookieHeaders.length) return;

  const cookieMap = parseExistingCookies();

  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0];
    const [name, ...rest] = pair.split('=');
    if (!name) continue;
    cookieMap.set(name.trim(), rest.join('=').trim());
  }

  cookies = Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// fetch with cookies
async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 쿠키 업데이트
  setCookies(response.headers);

  return response;
}

// 로그인
async function login(email, password) {
  const formData = new URLSearchParams();
  formData.append('email', email);
  formData.append('password', password);
  formData.append('redirect', 'false');
  formData.append('json', 'true');

  const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
    credentials: 'include',
  });

  // 쿠키 저장
  setCookies(response.headers);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ログインに失敗しました: ${error}`);
  }

  // 세션 확인
  const sessionRes = await fetchWithAuth(`${baseUrl}/api/auth/session`);
  let session = null;
  try {
    session = await sessionRes.json();
  } catch (error) {
    const raw = await sessionRes.text();
    throw new Error(`セッションAPIの応答を解析できませんでした (status ${sessionRes.status}): ${raw}`);
  }

  if (!session?.user) {
    const raw = JSON.stringify(session);
    throw new Error(`セッションが取得できませんでした (status ${sessionRes.status}): ${raw}`);
  }

  testUserId = parseInt(session.user.id);
  return session;
}

// 테스트용 캐릭터 생성
async function createTestCharacter(session) {
  if (!globalOptions.autoCreate) return null;
  
  try {
    const characterData = {
      userId: testUserId,
      name: 'テストキャラクター',
      description: 'これはテスト用に自動生成されたキャラクターです。',
      systemTemplate: 'あなたはテスト用のキャラクターです。',
      firstSituation: 'テストシチュエーション',
      firstMessage: 'こんにちは！テストです。',
      visibility: 'public',
      safetyFilter: true,
      category: 'テスト',
      hashtags: ['テスト'],
      detailSetting: 'テスト用の詳細設定',
      images: [], // 画像なしで作成
    };

    const res = await fetchWithAuth(`${baseUrl}/api/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(characterData),
    });

    if (res.ok) {
      const result = await res.json();
      return result.character?.id || null;
    } else {
      const errorData = await res.json();
      console.warn(`⚠️  テストキャラクター作成に失敗: ${errorData.message || res.statusText}`);
      return null;
    }
  } catch (error) {
    console.warn(`⚠️  テストキャラクター作成に失敗: ${error.message}`);
    return null;
  }
}

// 테스트용 계정 생성
async function createTestUser() {
  const testEmail = `test_${Date.now()}@test.com`;
  const testPassword = 'Test1234!';
  const testNickname = `テストユーザー_${Date.now()}`;
  
  const registerRes = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'テストユーザー',
      phone: `090${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
      nickname: testNickname,
    }),
  });

  if (!registerRes.ok) {
    const error = await registerRes.json();
    throw new Error(error.error || 'テストユーザー作成に失敗');
  }

  const registerData = await registerRes.json();
  return {
    userId: registerData.user.id,
    email: testEmail,
    password: testPassword,
  };
}

// AI를 사용한 캐릭터 자동 생성
async function createCharacterWithAI(testUserId) {
  const categories = [
    "シミュレーション", "ロマンス", "ファンタジー/SF", "ドラマ", "武侠/時代劇", 
    "GL", "BL", "ホラー/ミステリー", "アクション", "コメディ/日常", 
    "スポーツ/学園", "その他"
  ];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];

  // プロフィール生成
  const profileRes = await fetch(`${baseUrl}/api/characters/generate-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      genre: randomCategory,
      characterType: 'テスト用キャラクター',
    }),
  });

  if (!profileRes.ok) {
    throw new Error('プロフィール生成に失敗');
  }

  const profileData = await profileRes.json();
  const { name, description } = profileData;

  // 詳細設定生成
  const detailRes = await fetch(`${baseUrl}/api/characters/generate-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });

  if (!detailRes.ok) {
    throw new Error('詳細設定生成に失敗');
  }

  const detailData = await detailRes.json();
  const detailSetting = detailData.detailSetting;

  // 開始状況生成
  const situationRes = await fetch(`${baseUrl}/api/characters/generate-situation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, detailSetting }),
  });

  if (!situationRes.ok) {
    throw new Error('開始状況生成に失敗');
  }

  const situationData = await situationRes.json();
  const { firstSituation, firstMessage } = situationData;

  // キャラクター作成
  const characterRes = await fetchWithAuth(`${baseUrl}/api/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: testUserId,
      name,
      description,
      detailSetting,
      firstSituation,
      firstMessage,
      visibility: 'private', // 非公開
      safetyFilter: true,
      category: randomCategory,
      hashtags: ['テスト', randomCategory],
      images: [], // 画像なし
    }),
  });

  if (!characterRes.ok) {
    const error = await characterRes.json();
    throw new Error(error.message || 'キャラクター作成に失敗');
  }

  const characterData = await characterRes.json();
  return characterData.character.id;
}

// 캐릭터 찾기 또는 생성
async function ensureTestCharacter(session, requireOtherUser = false) {
  // 먼저 기존 캐릭터 확인
  const charsRes = await fetchWithAuth(`${baseUrl}/api/charlist`);
  const chars = await charsRes.json();
  
  if (Array.isArray(chars) && chars.length > 0) {
    if (requireOtherUser) {
      // 다른 사용자가 만든 캐릭터 찾기
      const otherUserChar = chars.find(char => char.author_id && char.author_id !== testUserId);
      if (otherUserChar) {
        return otherUserChar.id;
      }
    } else {
      // 아무 캐릭터나 사용
      return chars[0].id;
    }
  }
  
  // 캐릭터가 없으면 생성 시도
  if (globalOptions.autoCreate) {
    if (!globalOptions.json) {
      console.log('   ℹ️  テスト用キャラクターを作成中（AI自動生成）...');
    }
    try {
      // 테스트용 계정 생성
      const testUser = await createTestUser();
      
      // AI로 캐릭터 생성
      const newCharId = await createCharacterWithAI(testUser.userId);
      if (newCharId) {
        return newCharId;
      }
    } catch (error) {
      console.warn(`   ⚠️  キャラクター作成に失敗: ${error.message}`);
    }
  }
  
  return null;
}

// 테스트 정의
const testCategories = [
  {
    name: '認証・セッション',
    tests: [
      {
        name: 'セッション確認',
        description: '現在のログインセッションが有効かどうかを確認します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/auth/session`);
          const result = await res.json();
          if (res.ok && result?.user) {
            return { userId: result.user.id };
          }
          throw new Error('セッションが取得できませんでした');
        }
      },
      {
        name: 'ユーザー情報取得',
        description: 'ログイン中のユーザーの基本情報を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/auth/session`);
          const session = await res.json();
          if (session?.user?.id) {
            return { name: session.user.name || 'N/A' };
          }
          throw new Error('ユーザー情報が取得できませんでした');
        }
      }
    ]
  },
  {
    name: 'ポイント機能',
    tests: [
      {
        name: 'ポイント情報取得',
        description: 'ユーザーの保有ポイントを取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/points`);
          const result = await res.json();
          if (res.ok) {
            const total = (result.free_points || 0) + (result.paid_points || 0);
            return { total };
          }
          throw new Error(result.error || 'ポイント取得に失敗');
        }
      },
      {
        name: 'ポイントチャージ',
        description: 'ポイントを100ポイントチャージします',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/points`, {
            method: 'POST',
            body: JSON.stringify({ action: 'charge', amount: 100 }),
          });
          const result = await res.json();
          if (res.ok) {
            return { message: result.message || 'チャージ成功' };
          }
          throw new Error(result.error || 'チャージに失敗');
        }
      },
      {
        name: '出席チェック',
        description: '毎日出席イベントに参加します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/points`, {
            method: 'POST',
            body: JSON.stringify({ action: 'attend' }),
          });
          const result = await res.json();
          if (res.ok) {
            return { message: result.message || '出席成功' };
          }
          // 既に出席済みの場合は正常な動作として扱う
          if (result.message && result.message.includes('既に出席済み')) {
            return { message: result.message || '既に出席済み（正常）' };
          }
          // その他のエラーの場合
          return { message: result.message || '出席エラー', isError: true };
        }
      }
    ]
  },
  {
    name: 'キャラクター機能',
    tests: [
      {
        name: 'キャラクター一覧取得',
        description: '公開されているキャラクターの一覧を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/charlist`);
          const result = await res.json();
          if (res.ok && Array.isArray(result)) {
            return { count: result.length };
          }
          throw new Error('キャラクター一覧取得に失敗');
        }
      },
      {
        name: 'キャラクター詳細取得',
        description: '特定のキャラクターの詳細情報を取得します',
        run: async () => {
          const charId = await ensureTestCharacter(session);
          if (!charId) {
            return { 
              message: 'キャラクターが存在しません（--auto-create オプションで自動生成可能）', 
              isSkipped: true 
            };
          }
          const charRes = await fetchWithAuth(`${baseUrl}/api/characters/${charId}`);
          const result = await charRes.json();
          if (charRes.ok) {
            return { name: result.name };
          }
          throw new Error('キャラクター詳細取得に失敗');
        }
      },
      {
        name: 'キャラクター検索',
        description: '検索機能をテストします',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/search?q=test`);
          const result = await res.json();
          if (res.ok) {
            return { count: result.characters?.length || 0 };
          }
          throw new Error('検索に失敗');
        }
      }
    ]
  },
  {
    name: 'チャット機能',
    tests: [
      {
        name: 'チャットリスト取得',
        description: 'ユーザーが作成したチャットルームの一覧を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/chatlist`);
          const result = await res.json();
          if (res.ok && Array.isArray(result)) {
            return { count: result.length };
          }
          throw new Error('チャットリスト取得に失敗');
        }
      },
      {
        name: '新規チャット作成',
        description: '新しいチャットルームを作成します',
        run: async () => {
          const charId = await ensureTestCharacter(session);
          if (!charId) {
            return { 
              message: 'キャラクターが存在しません（--auto-create オプションで自動生成可能）', 
              isSkipped: true 
            };
          }
          const res = await fetchWithAuth(`${baseUrl}/api/chat/new`, {
            method: 'POST',
            body: JSON.stringify({ characterId: charId }),
          });
          const result = await res.json();
          if (res.ok) {
            return { chatId: result.chatId };
          }
          throw new Error(result.error || 'チャット作成に失敗');
        }
      },
      {
        name: 'メッセージ送信',
        description: 'チャットにメッセージを送信します（ポイント消費）',
        run: async () => {
          const chatListRes = await fetchWithAuth(`${baseUrl}/api/chatlist`);
          const chats = await chatListRes.json();
          if (chats.length > 0) {
            const chatId = chats[0].id;
            const res = await fetchWithAuth(`${baseUrl}/api/chat/${chatId}`, {
              method: 'POST',
              body: JSON.stringify({
                message: 'テストメッセージ',
                settings: {},
              }),
            });
            if (res.ok) {
              return { message: 'メッセージ送信成功' };
            }
            const errorData = await res.json();
            throw new Error(errorData.error || 'メッセージ送信に失敗');
          }
          throw new Error('チャットが存在しません');
        }
      }
    ]
  },
  {
    name: '通知機能',
    tests: [
      {
        name: '通知一覧取得',
        description: 'ユーザーが受け取った通知の一覧を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/notifications`);
          const result = await res.json();
          if (res.ok) {
            return { count: result.notifications?.length || 0 };
          }
          throw new Error('通知取得に失敗');
        }
      },
      {
        name: '未読通知数取得',
        description: '未読通知の数を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/notifications/unread-count`);
          const result = await res.json();
          if (res.ok) {
            return { unreadCount: result.unreadCount || 0 };
          }
          throw new Error('未読通知数取得に失敗');
        }
      },
      {
        name: '通知既読処理',
        description: '通知を既読にマークします',
        run: async () => {
          const notifRes = await fetchWithAuth(`${baseUrl}/api/notifications`);
          const notifs = await notifRes.json();
          if (notifs.notifications?.length > 0) {
            const res = await fetchWithAuth(`${baseUrl}/api/notifications/read`, {
              method: 'PUT',
              body: JSON.stringify({ notificationIds: [notifs.notifications[0].id] }),
            });
            if (res.ok) {
              return { message: '既読処理成功' };
            }
            throw new Error('既読処理に失敗');
          }
          return { message: '通知がありません', isError: true };
        }
      }
    ]
  },
  {
    name: 'ソーシャル機能',
    tests: [
      {
        name: 'プロフィール取得',
        description: 'ユーザーのプロフィール情報を取得します',
        run: async () => {
          const sessionRes = await fetchWithAuth(`${baseUrl}/api/auth/session`);
          const session = await sessionRes.json();
          if (session?.user?.id) {
            const res = await fetchWithAuth(`${baseUrl}/api/profile/${session.user.id}`);
            const result = await res.json();
            if (res.ok) {
              return { nickname: result.nickname };
            }
            throw new Error('プロフィール取得に失敗');
          }
          throw new Error('セッションが取得できません');
        }
      },
      {
        name: 'フォロー/アンフォロー',
        description: '他のユーザーをフォロー/アンフォローします',
        run: async () => {
          // 다른 사용자가 만든 캐릭터 찾기
          const charsRes = await fetchWithAuth(`${baseUrl}/api/charlist`);
          const chars = await charsRes.json();
          
          if (Array.isArray(chars) && chars.length > 0) {
            // 다른 사용자가 만든 캐릭터 찾기
            const otherUserChar = chars.find(char => char.author_id && char.author_id !== testUserId);
            if (otherUserChar && otherUserChar.author_id) {
              const authorId = otherUserChar.author_id;
              const res = await fetchWithAuth(`${baseUrl}/api/profile/${authorId}/follow`, {
                method: 'POST',
              });
              const result = await res.json();
              if (res.ok) {
                return { isFollowing: result.isFollowing };
              }
              throw new Error(result.error || 'フォロー処理に失敗');
            }
            return { 
              message: '他のユーザーが作成したキャラクターが見つかりません（テストをスキップ）', 
              isSkipped: true 
            };
          }
          return { 
            message: 'キャラクターが存在しません（--auto-create オプションで自動生成可能）', 
            isSkipped: true 
          };
        }
      },
      {
        name: 'いいね機能',
        description: 'キャラクターにいいねを付けます',
        run: async () => {
          const charId = await ensureTestCharacter(session);
          if (!charId) {
            return { 
              message: 'キャラクターが存在しません（--auto-create オプションで自動生成可能）', 
              isSkipped: true 
            };
          }
          const res = await fetchWithAuth(`${baseUrl}/api/characters/${charId}/favorite`, {
            method: 'POST',
          });
          const result = await res.json();
          if (res.ok) {
            return { isFavorite: result.isFavorite };
          }
          throw new Error(result.error || 'いいね処理に失敗');
        }
      },
      {
        name: 'コメント機能',
        description: 'キャラクターにコメントを投稿します',
        run: async () => {
          const charId = await ensureTestCharacter(session);
          if (!charId) {
            return { 
              message: 'キャラクターが存在しません（--auto-create オプションで自動生成可能）', 
              isSkipped: true 
            };
          }
          const res = await fetchWithAuth(`${baseUrl}/api/characters/${charId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content: 'テストコメント' }),
          });
          const result = await res.json();
          if (res.ok) {
            return { message: 'コメント投稿成功' };
          }
          throw new Error(result.error || 'コメント投稿に失敗');
        }
      }
    ]
  },
  {
    name: 'その他機能',
    tests: [
      {
        name: 'ランキング取得',
        description: 'キャラクターのランキング情報を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/ranking`);
          if (res.ok) {
            return { message: 'ランキング取得成功' };
          }
          throw new Error('ランキング取得に失敗');
        }
      },
      {
        name: '検索機能',
        description: '検索APIをテストします',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/search?q=test`);
          const result = await res.json();
          if (res.ok) {
            return { count: result.characters?.length || 0 };
          }
          throw new Error('検索に失敗');
        }
      },
      {
        name: 'ペルソナ機能',
        description: 'ユーザーのペルソナ情報を取得します',
        run: async () => {
          const res = await fetchWithAuth(`${baseUrl}/api/persona`);
          const result = await res.json();
          if (res.ok) {
            return { count: result.personas?.length || 0 };
          }
          throw new Error('ペルソナ取得に失敗');
        }
      }
    ]
  }
];

// 테스트 실행
async function runTest(category, test, session) {
  const startTime = Date.now();
  let status = 'success';
  let message = '';
  let data = null;
  
  try {
    data = await test.run(session);
    message = JSON.stringify(data);
    
    // isSkipped 플래그가 있으면 스킵으로 처리
    if (data.isSkipped) {
      status = 'skipped';
    }
    // isError 플래그가 있으면 에러로 처리
    else if (data.isError) {
      status = 'error';
    }
  } catch (error) {
    status = 'error';
    message = error.message;
  }
  
  const duration = Date.now() - startTime;
  
  return {
    category: category.name,
    name: test.name,
    status,
    message,
    duration,
    timestamp: new Date().toISOString()
  };
}

// 모든 테스트 실행
async function runAllTests(session, options = {}) {
  const results = [];
  
  for (const category of testCategories) {
    if (options.category && options.category !== category.name) continue;
    
    for (const test of category.tests) {
      if (options.test && options.test !== test.name) continue;
      
      const result = await runTest(category, test, session);
      results.push(result);
      
      // 콘솔 출력
      if (!options.json) {
        let icon = '✅';
        if (result.status === 'error') icon = '❌';
        else if (result.status === 'skipped') icon = '⏭️';
        
        const categoryName = category.name.padEnd(12);
        const testName = test.name.padEnd(20);
        console.log(`${icon} [${categoryName}] ${testName} (${result.duration}ms)`);
        if (result.status === 'error' || result.status === 'skipped') {
          console.log(`   ${result.message}`);
        }
      }
      
      // 테스트 간 대기
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// AI 분석
async function analyzeWithAI(results, baseUrl) {
  try {
    const response = await fetchWithAuth(`${baseUrl}/api/admin/test/analyze`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.analysis || '分析結果が取得できませんでした。';
    }
    throw new Error('AI分析に失敗しました');
  } catch (error) {
    return `AI分析中にエラーが発生しました: ${error.message}`;
  }
}

// 통계 생성
function generateSummary(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total || 0;
  
  return {
    total,
    passed,
    failed,
    skipped,
    successRate: ((passed / total) * 100).toFixed(2) + '%',
    avgDuration: Math.round(avgDuration) + 'ms',
    failedTests: results.filter(r => r.status === 'error'),
    skippedTests: results.filter(r => r.status === 'skipped'),
    slowTests: results.filter(r => r.duration > 1000).sort((a, b) => b.duration - a.duration)
  };
}

// 도움말 출력
function printHelp() {
  console.log(`
API 테스트 러너 (CLI 버전)

사용법:
  node scripts/test-runner.mjs [옵션]

옵션:
  --url <url>            API 서버 URL (기본값: http://localhost:3000)
  --email <email>        로그인 이메일 (필수)
  --password <password>  로그인 비밀번호 (필수)
  --category <name>      특정 카테고리만 테스트
  --test <name>          특정 테스트만 실행
  --json                 JSON 형식으로 출력
  --output <file>        결과를 파일로 저장
  --ai-analysis          AI 분석 포함
  --help                 이 도움말 표시

예제:
  # 기본 실행
  node scripts/test-runner.mjs --email admin@example.com --password pass123

  # JSON 출력
  node scripts/test-runner.mjs --email admin@example.com --password pass123 --json

  # 특정 카테고리만
  node scripts/test-runner.mjs --email admin@example.com --password pass123 --category "ポイント機能"

  # AI 분석 포함
  node scripts/test-runner.mjs --email admin@example.com --password pass123 --ai-analysis

  # 결과 파일 저장
  node scripts/test-runner.mjs --email admin@example.com --password pass123 --output test-results.json

  # 테스트용 캐릭터 자동 생성 (없을 경우)
  node scripts/test-runner.mjs --email admin@example.com --password pass123 --auto-create

환경 변수:
  API_URL                API 서버 URL (--url 옵션보다 우선순위 낮음)
  TEST_EMAIL             로그인 이메일 (--email 옵션보다 우선순위 낮음)
  TEST_PASSWORD          로그인 비밀번호 (--password 옵션보다 우선순위 낮음)
`);
}

// 메인 함수
async function main() {
  const args = process.argv.slice(2);
  const options = {
    url: process.env.API_URL || 'http://localhost:3000',
    email: process.env.TEST_EMAIL,
    password: process.env.TEST_PASSWORD,
    json: false,
    output: null,
    aiAnalysis: false,
    category: null,
    test: null,
    autoCreate: false
  };
  
  // 인자 파싱
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        options.url = args[++i];
        break;
      case '--email':
        options.email = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--json':
        options.json = true;
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--ai-analysis':
        options.aiAnalysis = true;
        break;
      case '--category':
        options.category = args[++i];
        break;
      case '--test':
        options.test = args[++i];
        break;
      case '--auto-create':
        options.autoCreate = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  baseUrl = options.url;
  globalOptions = options;
  
  if (!options.email || !options.password) {
    console.error('❌ エラー: メールアドレスとパスワードが必要です');
    console.error('使用方法: node scripts/test-runner.mjs --email <email> --password <password>');
    console.error('または環境変数 TEST_EMAIL と TEST_PASSWORD を設定してください');
    process.exit(1);
  }
  
    try {
      if (!options.json) {
        console.log('🔐 ログイン中...');
      }
      
      // 로그인
      const session = await login(options.email, options.password);
      
      if (!options.json) {
        console.log(`✅ ログイン成功: ${session.user.name || session.user.email}\n`);
      }
      
      // テスト環境セットアップ（オプション）
      if (globalOptions.autoCreate) {
        if (!options.json) {
          console.log('🔧 テスト環境をセットアップ中（テスト用ユーザーとキャラクターを自動生成）...');
        }
        try {
          const testUser = await createTestUser();
          const testCharId = await createCharacterWithAI(testUser.userId);
          if (!options.json) {
            console.log(`✅ テスト環境セットアップ完了: ユーザーID ${testUser.userId}, キャラクターID ${testCharId}\n`);
          }
        } catch (error) {
          if (!options.json) {
            console.warn(`⚠️  テスト環境セットアップに失敗しましたが、既存のデータでテストを続行します: ${error.message}\n`);
          }
        }
      }
      
      if (!options.json) {
        console.log('🚀 テストを開始します...\n');
      }
      
      const results = await runAllTests(session, options);
    
    const summary = generateSummary(results);
    
    const output = {
      timestamp: new Date().toISOString(),
      baseUrl: options.url,
      user: {
        email: options.email,
        name: session.user.name,
        id: session.user.id
      },
      summary,
      results
    };
    
    // AI 분석
    if (options.aiAnalysis) {
      if (!options.json) {
        console.log('\n🤖 AI分析を実行中...');
      }
      output.analysis = await analyzeWithAI(results, baseUrl);
    }
    
    // 출력
    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('\n📊 テスト結果サマリー:');
      console.log(`  総テスト数: ${summary.total}`);
      console.log(`  成功: ${summary.passed} (${summary.successRate})`);
      console.log(`  失敗: ${summary.failed}`);
      console.log(`  スキップ: ${summary.skipped}`);
      console.log(`  平均実行時間: ${summary.avgDuration}`);
      
      if (summary.skippedTests.length > 0) {
        console.log('\n⏭️  スキップされたテスト:');
        summary.skippedTests.forEach(test => {
          console.log(`  - [${test.category}] ${test.name}: ${test.message}`);
        });
        if (!options.autoCreate) {
          console.log('\n💡 ヒント: --auto-create オプションを使用すると、テスト用キャラクターを自動生成できます');
        }
      }
      
      if (summary.failedTests.length > 0) {
        console.log('\n❌ 失敗したテスト:');
        summary.failedTests.forEach(test => {
          console.log(`  - [${test.category}] ${test.name}: ${test.message}`);
        });
      }
      
      if (summary.slowTests.length > 0) {
        console.log('\n⏱️  実行時間が長いテスト (>1000ms):');
        summary.slowTests.forEach(test => {
          console.log(`  - [${test.category}] ${test.name}: ${test.duration}ms`);
        });
      }
      
      if (output.analysis) {
        console.log('\n🤖 AI分析結果:');
        console.log(output.analysis);
      }
    }
    
    // 파일 저장
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
      if (!options.json) {
        console.log(`\n💾 結果を保存しました: ${options.output}`);
      }
    }
    
    // 종료 코드
    process.exit(summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (!options.json) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
