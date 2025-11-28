"use client";

import { useState, useRef, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { 
  CheckCircle2, XCircle, Loader2, Play, ArrowLeft, 
  User, Coins, MessageSquare, Bell, 
  Users, BookOpen, Settings, AlertCircle, Sparkles, Info, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { fetchWithCsrf } from '@/lib/csrf-client';

type TestResult = {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
};

type TestCategory = {
  name: string;
  icon: React.ReactNode;
  tests: TestResult[];
};

type GeneratedCharacterSpec = {
  name: string;
  description: string;
  detailSetting: string;
  firstSituation: string;
  firstMessage: string;
  category: string;
  hashtags: string[];
};

export default function TestToolPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [testCategories, setTestCategories] = useState<TestCategory[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [showTestDetails, setShowTestDetails] = useState<{ [key: string]: boolean }>({});
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [testUserInfo, setTestUserInfo] = useState<{ email: string; password: string; userId?: number } | null>(null);
  const [testCharacterId, setTestCharacterId] = useState<number | null>(null);
  const [testCharacterName, setTestCharacterName] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ message: string; deleted: { users: number; characters: number; chats: number } } | null>(null);
  const [isPreparingSocial, setIsPreparingSocial] = useState(false);
  const [socialSeedResult, setSocialSeedResult] = useState<{ message: string; details: string } | null>(null);

  const hasInitializedRef = useRef(false);
  const testUserInfoRef = useRef<{ email: string; password: string; userId?: number } | null>(null);
  const testCharacterIdRef = useRef<number | null>(null);
  const testCharacterNameRef = useRef<string | null>(null);
  const pointSnapshotRef = useRef<{ free: number; paid: number; total: number } | null>(null);
  const personaCreatedIdRef = useRef<number | null>(null);
  const partnerInfoRef = useRef<{ userId: number | null; characterId: number | null } | null>(null);
  const nativeFetch = globalThis.fetch.bind(globalThis);

  const secureFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return fetchWithCsrf(input.toString(), init);
    }
    return nativeFetch(input, init);
  };
  const fetch = secureFetch;

  const extractErrorMessage = (payload: unknown, fallback: string) => {
    if (!payload) return fallback;
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object') {
      const message = (payload as { message?: unknown; error?: unknown }).message ?? (payload as { message?: unknown; error?: unknown }).error;
      if (typeof message === 'string') return message;
      try {
        return JSON.stringify(payload);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const adoptExistingCharacter = async () => {
    const charsRes = await fetch('/api/charlist');
    const charsData = await charsRes.json() as { characters?: Array<{ id: number; name?: string; author_id?: number; [key: string]: unknown }> } | Array<{ id: number; name?: string; author_id?: number; [key: string]: unknown }>;
    const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
    if (!Array.isArray(chars) || chars.length === 0) {
      return null;
    }
    const first = chars[0] || null;
    if (first?.id) {
      setTestCharacterId(first.id);
      testCharacterIdRef.current = first.id;
      if (first.name && typeof first.name === 'string') {
        setTestCharacterName(first.name);
        testCharacterNameRef.current = first.name;
      }
      if (first.author_id) {
        const fallbackInfo = { email: '', password: '', userId: first.author_id };
        setTestUserInfo(prev => prev ?? fallbackInfo);
        testUserInfoRef.current = { 
          email: testUserInfoRef.current?.email ?? '', 
          password: testUserInfoRef.current?.password ?? '', 
          userId: first.author_id 
        };
      }
    }
    return first;
  };

  const buildFallbackCharacterSpec = (categoryLabel: string): GeneratedCharacterSpec => {
    const normalizedCategory = categoryLabel?.trim() || 'テスト';
    const fallbackHashtags = Array.from(new Set(['テスト', 'テスト検証', normalizedCategory]));
    return {
      name: 'テスト検証キャラクター',
      description: 'プラットフォームの機能テスト用に自動生成される安全なキャラクターです。#テスト ハッシュタグを必ず含み、検索機能の回帰テストに使用されます。',
      detailSetting:
        'このキャラクターはQA自動テスト専用です。ユーザーに危険な応答を返さず、プラットフォームの安定性を検証する目的のみで存在します。',
      firstSituation:
        'あなたは品質保証チームの一員としてシステム検証を行います。#テスト ハッシュタグでこのキャラクターを検索し、チャットを開始してください。',
      firstMessage: 'こんにちは、テスト検証キャラクターです。#テスト のタグでいつでも私を見つけられます！',
      category: normalizedCategory,
      hashtags: fallbackHashtags,
    };
  };

  const generateTestCharacterSpec = async (categoryLabel: string): Promise<GeneratedCharacterSpec> => {
    const category = categoryLabel?.trim() || 'テスト';
    try {
      const profileRes = await fetch('/api/characters/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: category,
          characterType: 'テスト用キャラクター',
        }),
      });
      const profilePayload = await profileRes.json().catch(() => null);
      if (!profileRes.ok || !profilePayload?.name) {
        throw new Error(extractErrorMessage(profilePayload, 'プロフィール生成に失敗しました'));
      }

      const detailRes = await fetch('/api/characters/generate-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profilePayload.name,
          description: profilePayload.description,
        }),
      });
      const detailPayload = await detailRes.json().catch(() => null);
      if (!detailRes.ok || !detailPayload?.detailSetting) {
        throw new Error(extractErrorMessage(detailPayload, '詳細設定生成に失敗しました'));
      }

      const situationRes = await fetch('/api/characters/generate-situation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profilePayload.name,
          description: profilePayload.description,
          detailSetting: detailPayload.detailSetting,
        }),
      });
      const situationPayload = await situationRes.json().catch(() => null);
      if (
        !situationRes.ok ||
        !situationPayload?.firstSituation ||
        !situationPayload?.firstMessage
      ) {
        throw new Error(extractErrorMessage(situationPayload, '開始状況生成に失敗しました'));
      }

      return {
        name: profilePayload.name,
        description: profilePayload.description ?? 'テスト用途で自動生成されたキャラクターです。',
        detailSetting: detailPayload.detailSetting,
        firstSituation: situationPayload.firstSituation,
        firstMessage: situationPayload.firstMessage,
        category,
        hashtags: Array.from(new Set(['テスト', category])),
      };
    } catch (error) {
      console.warn('テストキャラクター自動生成に失敗したためフォールバックに切り替えます:', error);
      return buildFallbackCharacterSpec(category);
    }
  };

  // ▼▼▼【追加】ログイン済みの場合でも一度だけ初期화
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !hasInitializedRef.current) {
      setIsLoggedIn(true);
      setTestCategories(initializeTests());
      hasInitializedRef.current = true;
    } else if (status === 'unauthenticated') {
      hasInitializedRef.current = false;
      setIsLoggedIn(false);
    }
  }, [status, session]);
  // ▲▲▲

  useEffect(() => {
    testUserInfoRef.current = testUserInfo;
  }, [testUserInfo]);

  useEffect(() => {
    testCharacterIdRef.current = testCharacterId;
  }, [testCharacterId]);

  useEffect(() => {
    testCharacterNameRef.current = testCharacterName;
  }, [testCharacterName]);

  // テストの詳細説明
  const testDescriptions: { [key: string]: string } = {
    'セッション確認': '現在のログインセッションが有効かどうかを確認します。セッション情報が正しく取得できるかテストします。',
    'ユーザー情報取得': 'ログイン中のユーザーの基本情報（ID、名前、メールアドレスなど）が正しく取得できるかテストします。',
    'ポイント情報取得': 'ユーザーの保有ポイント（有料ポイント、無料ポイント）が正しく取得できるかテストします。',
    'ポイントチャージ': 'ポイントを100ポイントチャージして、データベースに正しく反映されるかテストします。',
    '出席チェック': '毎日出席イベントに参加して、30ポイントが正しく付与されるかテストします（既に出席済みの場合はエラーになります）。',
    'キャラクター一覧取得': '公開されているキャラクターの一覧が正しく取得できるかテストします。',
    'キャラクター詳細取得': '特定のキャラクターの詳細情報（名前、説明、画像など）が正しく取得できるかテストします。',
    'キャラクター作成': 'テスト用キャラクターを新規作成できるかテストします。',
    'キャラクター検索': '検索機能が正常に動作し、キーワードでキャラクターを検索できるかテストします。',
    'チャットリスト取得': 'ユーザーが作成したチャットルームの一覧が正しく取得できるかテストします。',
    '新規チャット作成': '新しいチャットルームを作成して、正しく作成されるかテストします。',
    'メッセージ送信': 'チャットにメッセージを送信して、AIが応答を返すかテストします（ポイントが消費されます）。',
    '通知一覧取得': 'ユーザーが受け取った通知の一覧が正しく取得できるかテストします。',
    '未読通知数取得': '未読通知の数が正しくカウントされるかテストします。',
    '通知既読処理': '通知を既読にマークして、状態が正しく更新されるかテストします。',
    'プロフィール取得': 'ユーザーのプロフィール情報が正しく取得できるかテストします。',
    'フォロー/アンフォロー': '他のユーザーをフォロー/アンフォローして、状態が正しく更新されるかテストします。',
    'いいね機能': 'キャラクターにいいねを付けて、状態が正しく更新されるかテストします。',
    'コメント機能': 'キャラクターにコメントを投稿して、正しく保存されるかテストします。',
    'ポイント最終確認': '一連の操作後に最終的なポイント残高を検証します。',
    'ランキング取得': 'キャラクターのランキング情報が正しく取得できるかテストします。',
    '検索機能': '検索APIが正常に動作し、結果が返されるかテストします。',
    'ペルソナ一覧取得': 'ユーザーのペルソナ情報が正しく取得できるかテストします。',
    'ペルソナ作成': '新しいペルソナを追加してAPI動作を確認します。',
    'ペルソナ削除': '直前に作成したペルソナを削除して完了まで検証します。',
  };

  // テストカテゴリーの初期化
  const initializeTests = (): TestCategory[] => [
    {
      name: '認証・セッション',
      icon: <User size={20} className="text-blue-400" />,
      tests: [
        { name: 'セッション確認', status: 'pending' },
        { name: 'ユーザー情報取得', status: 'pending' },
      ]
    },
    {
      name: 'ポイント機能',
      icon: <Coins size={20} className="text-yellow-400" />,
      tests: [
        { name: 'ポイント情報取得', status: 'pending' },
        { name: 'ポイントチャージ', status: 'pending' },
        { name: '出席チェック', status: 'pending' },
        { name: 'ポイント最終確認', status: 'pending' },
      ]
    },
    {
      name: 'キャラクター機能',
      icon: <BookOpen size={20} className="text-pink-400" />,
      tests: [
        { name: 'キャラクター一覧取得', status: 'pending' },
        { name: 'キャラクター詳細取得', status: 'pending' },
        { name: 'キャラクター作成', status: 'pending' },
        { name: 'キャラクター検索', status: 'pending' },
      ]
    },
    {
      name: 'チャット機能',
      icon: <MessageSquare size={20} className="text-purple-400" />,
      tests: [
        { name: 'チャットリスト取得', status: 'pending' },
        { name: '新規チャット作成', status: 'pending' },
        { name: 'メッセージ送信', status: 'pending' },
      ]
    },
    {
      name: 'ソーシャル機能',
      icon: <Users size={20} className="text-green-400" />,
      tests: [
        { name: 'プロフィール取得', status: 'pending' },
        { name: 'フォロー/アンフォロー', status: 'pending' },
        { name: 'いいね機能', status: 'pending' },
        { name: 'コメント機能', status: 'pending' },
      ]
    },
    {
      name: '通知機能',
      icon: <Bell size={20} className="text-red-400" />,
      tests: [
        { name: '通知一覧取得', status: 'pending' },
        { name: '未読通知数取得', status: 'pending' },
        { name: '通知既読処理', status: 'pending' },
      ]
    },
    {
      name: 'その他機能',
      icon: <Settings size={20} className="text-gray-400" />,
      tests: [
        { name: 'ランキング取得', status: 'pending' },
        { name: '検索機能', status: 'pending' },
        { name: 'ペルソナ一覧取得', status: 'pending' },
        { name: 'ペルソナ作成', status: 'pending' },
        { name: 'ペルソナ削除', status: 'pending' },
      ]
    },
  ];

  // テスト用ユーザーとキャラクターの自動生成
  const setupTestEnvironment = async () => {
    setIsSettingUp(true);
    try {
      // 1. テスト用ユーザー作成
      const testEmail = `test_${Date.now()}@test.com`;
      const testPassword = 'Test1234!QA99';
      const testNickname = `テストユーザー_${Date.now()}`;
      
      const registerRes = await fetch('/api/register', {
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
      const testUserId = registerData.user.id;

      // 2. テスト用キャラクター作成（AI生成 + フォールバック）
      const categories = [
        "シミュレーション", "ロマンス", "ファンタジー/SF", "ドラマ", "武侠/時代劇", 
        "GL", "BL", "ホラー/ミステリー", "アクション", "コメディ/日常", 
        "スポーツ/学園", "その他"
      ];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const characterSpec = await generateTestCharacterSpec(randomCategory);

      // キャラクター作成（テスト用なので公開にする）
      const characterRes = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          name: characterSpec.name,
          description: characterSpec.description,
          detailSetting: characterSpec.detailSetting,
          firstSituation: characterSpec.firstSituation,
          firstMessage: characterSpec.firstMessage,
          visibility: 'public', // テスト用なので公開にする
          safetyFilter: true,
          category: characterSpec.category || randomCategory,
          hashtags: characterSpec.hashtags,
          images: [], // 画像なし
        }),
      });

      if (!characterRes.ok) {
        const error = await characterRes.json();
        throw new Error(error.message || 'キャラクター作成に失敗');
      }

      const characterData = await characterRes.json();
      if (!characterRes.ok || !characterData?.character?.id) {
        throw new Error(extractErrorMessage(characterData, 'キャラクター作成に失敗'));
      }
      const characterId = characterData.character.id;

      const userInfo = { email: testEmail, password: testPassword, userId: testUserId };
      setTestUserInfo(userInfo);
      testUserInfoRef.current = userInfo;

      setTestCharacterId(characterId);
      testCharacterIdRef.current = characterId;

      const createdName = characterData.character.name ?? characterSpec.name;
      setTestCharacterName(createdName);
      testCharacterNameRef.current = createdName;

      return { testUserId, characterId, testEmail, testPassword };
    } catch (error) {
      console.error('テスト環境セットアップエラー:', error);
      throw error;
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        alert('ログインに失敗しました: ' + result.error);
        setIsLoggingIn(false);
        return;
      }

      setIsLoggedIn(true);
      setTestCategories(initializeTests());
    } catch (error) {
      alert('ログインエラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updateTestResult = (
    categoryIndex: number,
    testIndex: number,
    status: TestResult['status'],
    message?: string,
    duration?: number
  ) => {
    setTestCategories(prev => {
      const updated = [...prev];
      updated[categoryIndex].tests[testIndex] = {
        ...updated[categoryIndex].tests[testIndex],
        status,
        message,
        duration,
      };
      return updated;
    });
  };

  const runTest = async (categoryIndex: number, testIndex: number) => {
    const startTime = Date.now();
    setCurrentTest(`${categoryIndex}-${testIndex}`);
    updateTestResult(categoryIndex, testIndex, 'running');

    try {
      const categoryName = testCategories[categoryIndex].name;
      
      // 現在のtestCharacterIdとtestUserInfoを取得（最新の状態を使用）
      let currentTestCharacterId = testCharacterIdRef.current;
      const currentTestUserInfo = testUserInfoRef.current;
      let currentTestCharacterName = testCharacterNameRef.current;

      switch (categoryName) {
        case '認証・セッション':
          if (testIndex === 0) {
            // セッション確認
            const sessionRes = await fetch('/api/auth/session');
            const sessionResult = await sessionRes.json() as { user?: { id?: string } };
            if (sessionRes.ok && sessionResult?.user) {
              updateTestResult(categoryIndex, testIndex, 'success', `ユーザーID: ${sessionResult.user.id}`, Date.now() - startTime);
            } else {
              throw new Error('セッションが取得できませんでした');
            }
          } else if (testIndex === 1) {
            // ユーザー情報取得
            const sessionRes = await fetch('/api/auth/session');
            const session = await sessionRes.json();
            if (session?.user?.id) {
              updateTestResult(categoryIndex, testIndex, 'success', `名前: ${session.user.name || 'N/A'}`, Date.now() - startTime);
            } else {
              throw new Error('ユーザー情報が取得できませんでした');
            }
          }
          break;

        case 'ポイント機能':
          if (testIndex === 0) {
            // ポイント情報取得
            const pointsRes = await secureFetch('/api/points');
            const pointsResult = await pointsRes.json() as { free_points?: number; paid_points?: number; error?: string };
            if (pointsRes.ok) {
              const total = (pointsResult.free_points || 0) + (pointsResult.paid_points || 0);
              pointSnapshotRef.current = {
                free: pointsResult.free_points || 0,
                paid: pointsResult.paid_points || 0,
                total,
              };
              updateTestResult(categoryIndex, testIndex, 'success', `総ポイント: ${total}`, Date.now() - startTime);
            } else {
              throw new Error(pointsResult.error || 'ポイント取得に失敗');
            }
          } else if (testIndex === 1) {
            // ポイントチャージ
            const chargeRes = await secureFetch('/api/points', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'charge', amount: 100 }),
            });
            const chargeResult = await chargeRes.json() as { message?: string; error?: string };
            if (chargeRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', chargeResult.message || 'チャージ成功', Date.now() - startTime);
            } else {
              throw new Error(extractErrorMessage(chargeResult, 'チャージに失敗'));
            }
          } else if (testIndex === 2) {
            // 出席チェック
            const attendRes = await secureFetch('/api/points', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'attend' }),
            });
            const attendResult = await attendRes.json() as { message?: string; error?: string };
            if (attendRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', attendResult.message || '出席成功', Date.now() - startTime);
            } else {
              // 既に出席済みの場合は正常な動作として扱う
              if (attendResult.message && attendResult.message.includes('既に出席済み')) {
                updateTestResult(categoryIndex, testIndex, 'success', attendResult.message || '既に出席済み（正常）', Date.now() - startTime);
              } else {
                updateTestResult(categoryIndex, testIndex, 'error', extractErrorMessage(attendResult, '出席エラー'), Date.now() - startTime);
              }
            }
          } else if (testIndex === 3) {
            const pointsRes = await secureFetch('/api/points');
            const pointsResult = await pointsRes.json() as { free_points?: number; paid_points?: number; error?: string };
            if (!pointsRes.ok) {
              throw new Error(pointsResult.error || 'ポイント取得に失敗');
            }
            const free = pointsResult.free_points || 0;
            const paid = pointsResult.paid_points || 0;
            const total = free + paid;
            if (total < 0) {
              throw new Error('ポイント残高が0未満です');
            }
            const snapshot = pointSnapshotRef.current;
            const diff = snapshot ? total - snapshot.total : 0;
            updateTestResult(
              categoryIndex,
              testIndex,
              'success',
              `残高: ${total}（差分: ${diff >= 0 ? '+' : ''}${diff}）`,
              Date.now() - startTime
            );
          }
          break;

        case 'キャラクター機能':
          if (testIndex === 0) {
            // キャラクター一覧取得
            const charsRes = await fetch('/api/charlist');
            const charsResult = await charsRes.json() as { characters?: unknown[] } | unknown[];
            if (charsRes.ok) {
              // /api/charlistは { characters: [...], tags: [...] } 形式で返す
              const characters = Array.isArray(charsResult) ? charsResult : (charsResult.characters || []);
              updateTestResult(categoryIndex, testIndex, 'success', `${characters.length}件のキャラクター`, Date.now() - startTime);
            } else {
              throw new Error('キャラクター一覧取得に失敗');
            }
          } else if (testIndex === 1) {
            // キャラクター詳細取得
            // テスト用キャラクターが作成されている場合はそれを使用
            if (currentTestCharacterId) {
              const charRes = await fetch(`/api/characters/${currentTestCharacterId}`);
              const charResult = await charRes.json() as { name?: string };
              if (charRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', `キャラクター: ${charResult.name}`, Date.now() - startTime);
              } else {
                throw new Error('キャラクター詳細取得に失敗');
              }
            } else {
              // 既存のキャラクターを探す
              const charsRes = await fetch('/api/charlist');
              const charsData = await charsRes.json() as { characters?: { id: number }[] } | { id: number }[];
              const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
              if (chars.length > 0) {
                const charRes = await fetch(`/api/characters/${chars[0].id}`);
                const charResult2 = await charRes.json() as { name?: string };
                if (charRes.ok) {
                  updateTestResult(categoryIndex, testIndex, 'success', `キャラクター: ${charResult2.name}`, Date.now() - startTime);
                } else {
                  throw new Error('キャラクター詳細取得に失敗');
                }
              } else {
                throw new Error('キャラクターが存在しません');
              }
            }
          } else if (testIndex === 2) {
            // キャラクター作成（現在ログイン中のユーザーでテストキャラクターを作成）
            const sessionRes = await fetch('/api/auth/session');
            const sessionData = await sessionRes.json() as { user?: { id?: string | number } };
            if (!sessionRes.ok || !sessionData?.user?.id) {
              throw new Error('セッションが取得できません');
            }
            const sessionUserId = Number(sessionData.user.id);
            if (!Number.isFinite(sessionUserId)) {
              throw new Error('ユーザーIDが不正です');
            }

            const spec = await generateTestCharacterSpec('テスト');
            const createRes = await fetch('/api/characters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: sessionUserId,
                name: spec.name,
                description: spec.description,
                detailSetting: spec.detailSetting,
                firstSituation: spec.firstSituation,
                firstMessage: spec.firstMessage,
                visibility: 'public',
                safetyFilter: true,
                category: spec.category,
                hashtags: spec.hashtags,
                images: [],
              }),
            });
            const createResult = await createRes.json() as { character?: { id?: number; name?: string }; error?: string; message?: string };
            if (!createRes.ok || !createResult?.character?.id) {
              throw new Error(extractErrorMessage(createResult, 'キャラクター作成に失敗しました'));
            }

            currentTestCharacterId = createResult.character.id;
            currentTestCharacterName = createResult.character.name ?? spec.name;
            testCharacterIdRef.current = currentTestCharacterId;
            testCharacterNameRef.current = currentTestCharacterName;
            setTestCharacterId(currentTestCharacterId);
            setTestCharacterName(currentTestCharacterName);

            updateTestResult(
              categoryIndex,
              testIndex,
              'success',
              `ID ${currentTestCharacterId} を作成`,
              Date.now() - startTime
            );
          } else if (testIndex === 3) {
            // キャラクター検索（テストキャラクターのハッシュタグ「テスト」で検索し、作成したキャラクターが含まれるか確認）
            if (!currentTestCharacterId) {
              currentTestCharacterId = partnerInfoRef.current?.characterId ?? null;
              if (currentTestCharacterId) {
                testCharacterIdRef.current = currentTestCharacterId;
                if (!currentTestCharacterName && partnerInfoRef.current?.characterId === currentTestCharacterId) {
                  // character name might already be set via seed; keep existing ref
                }
              }
            }
            
            if (!currentTestCharacterId) {
              const adopted = await adoptExistingCharacter();
              currentTestCharacterId = adopted?.id ?? null;
              currentTestCharacterName = adopted?.name ?? currentTestCharacterName;
            }

            if (!currentTestCharacterId) {
              throw new Error('テストキャラクターが存在しません。先にテスト環境をセットアップしてください。');
            }
            
            // ハッシュタグ「テスト」で検索
            const searchRes = await fetch('/api/search?query=テスト');
            const searchResult = await searchRes.json() as Array<{ id?: number; name?: string }>;
            if (searchRes.ok && Array.isArray(searchResult)) {
              if (searchResult.length === 0) {
                throw new Error('検索結果が0件です。テストキャラクターが作成されていないか、検索が機能していません。');
              }
              
              // 作成したキャラクターが検索結果に含まれているか確認
              const foundCharacter = searchResult.find(c => c.id === currentTestCharacterId);
              if (!foundCharacter) {
                // キャラクター名でも再検索を試みる
                if (currentTestCharacterName) {
                  const nameSearchRes = await fetch(`/api/search?query=${encodeURIComponent(currentTestCharacterName)}`);
                  const nameSearchResult = await nameSearchRes.json() as Array<{ id?: number }>;
                  if (nameSearchRes.ok && Array.isArray(nameSearchResult)) {
                    const foundByName = nameSearchResult.find(c => c.id === currentTestCharacterId);
                    if (foundByName) {
                      updateTestResult(categoryIndex, testIndex, 'success', `検索結果: ${searchResult.length}件（ハッシュタグ）、${nameSearchResult.length}件（名前）`, Date.now() - startTime);
                    } else {
                      throw new Error(`検索結果にテストキャラクター（ID: ${currentTestCharacterId}, 名前: ${currentTestCharacterName}）が含まれていません。`);
                    }
                  } else {
                    throw new Error('キャラクター名での検索に失敗');
                  }
                } else {
                  throw new Error(`検索結果にテストキャラクター（ID: ${currentTestCharacterId}）が含まれていません。`);
                }
              } else {
                updateTestResult(categoryIndex, testIndex, 'success', `検索結果: ${searchResult.length}件（テストキャラクター含む）`, Date.now() - startTime);
              }
            } else {
              throw new Error('検索に失敗');
            }
          }
          break;

        case 'チャット機能':
          if (testIndex === 0) {
            // チャットリスト取得
            const chatListRes = await fetch('/api/chatlist');
            const chatListResult = await chatListRes.json() as unknown[];
            if (chatListRes.ok && Array.isArray(chatListResult)) {
              updateTestResult(categoryIndex, testIndex, 'success', `${chatListResult.length}件のチャット`, Date.now() - startTime);
            } else {
              throw new Error('チャットリスト取得に失敗');
            }
          } else if (testIndex === 1) {
            // 新規チャット作成
            // テスト用キャラクターが作成されている場合はそれを使用
            let characterIdToUse = null;
            if (currentTestCharacterId) {
              characterIdToUse = currentTestCharacterId;
            } else {
              const charsRes = await fetch('/api/charlist');
              const charsData = await charsRes.json() as { characters?: { id: number }[] } | { id: number }[];
              const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
              if (chars.length > 0) {
                characterIdToUse = chars[0].id;
              }
            }
            
            if (characterIdToUse) {
              const newChatRes = await fetch('/api/chat/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characterId: characterIdToUse }),
              });
              const newChatResult = await newChatRes.json() as { chatId?: number; error?: string };
              if (newChatRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', `チャットID: ${newChatResult.chatId}`, Date.now() - startTime);
              } else {
                throw new Error(newChatResult.error || 'チャット作成に失敗');
              }
            } else {
              throw new Error('キャラクターが存在しません');
            }
          } else if (testIndex === 2) {
            // メッセージ送信
            const chatListRes = await fetch('/api/chatlist');
            const chats = await chatListRes.json() as { id: number }[];
            if (chats.length > 0) {
              const chatId = chats[0].id;
              const messageRes = await fetch(`/api/chat/${chatId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: 'テストメッセージ',
                  settings: {},
                }),
              });
              if (messageRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', 'メッセージ送信成功', Date.now() - startTime);
              } else {
                const errorData = await messageRes.json() as { error?: string };
                throw new Error(errorData.error || 'メッセージ送信に失敗');
              }
            } else {
              throw new Error('チャットが存在しません');
            }
          }
          break;

        case '通知機能':
          if (testIndex === 0) {
            // 通知一覧取得
            const notifRes = await fetch('/api/notifications');
            const notifResult = await notifRes.json() as { notifications?: unknown[] };
            if (notifRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', `${notifResult.notifications?.length || 0}件の通知`, Date.now() - startTime);
            } else {
              throw new Error('通知取得に失敗');
            }
          } else if (testIndex === 1) {
            // 未読通知数取得
            const unreadRes = await fetch('/api/notifications/unread-count');
            const unreadResult = await unreadRes.json() as { unreadCount?: number };
            if (unreadRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', `未読: ${unreadResult.unreadCount || 0}件`, Date.now() - startTime);
            } else {
              throw new Error('未読通知数取得に失敗');
            }
          } else if (testIndex === 2) {
            // 通知既読処理
            const notifRes = await fetch('/api/notifications');
            const notifs = await notifRes.json() as { notifications?: { id: number }[] };
            const notifications = notifs.notifications ?? [];
            if (notifications.length > 0) {
              const readRes = await fetch('/api/notifications/read', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: [notifications[0].id] }),
              });
              if (readRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', '既読処理成功', Date.now() - startTime);
              } else {
                throw new Error('既読処理に失敗');
              }
            } else {
              updateTestResult(categoryIndex, testIndex, 'error', '通知がありません', Date.now() - startTime);
            }
          }
          break;

        case 'ソーシャル機能':
          if (testIndex === 0) {
            // プロフィール取得
            const sessionRes = await fetch('/api/auth/session');
            const session = await sessionRes.json();
            if (session?.user?.id) {
              const profileRes = await fetch(`/api/profile/${session.user.id}`);
              const profileResult = await profileRes.json() as { nickname?: string };
              if (profileRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', `プロフィール: ${profileResult.nickname}`, Date.now() - startTime);
              } else {
                throw new Error('プロフィール取得に失敗');
              }
            } else {
              throw new Error('セッションが取得できません');
            }
          } else if (testIndex === 1) {
            // フォロー/アンフォロー
            // テスト用ユーザーが作成されている場合はそれを使用
            let authorIdToUse = partnerInfoRef.current?.userId ?? null;
            if (!authorIdToUse && currentTestUserInfo?.userId) {
              authorIdToUse = currentTestUserInfo.userId;
            }
            if (!authorIdToUse) {
              // パートナーユーザーが存在しない場合は、まずシードデータを生成を試みる
              try {
                await prepareSocialFixtures({ silent: true });
                authorIdToUse = partnerInfoRef.current?.userId ?? null;
              } catch (seedError) {
                console.warn('シードデータ生成に失敗しましたが、既存データで続行します:', seedError);
              }
            }
            if (!authorIdToUse) {
              const charsRes = await fetch('/api/charlist');
              const charsData = await charsRes.json() as { characters?: { author_id?: number }[] } | { author_id?: number }[];
              const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
              if (chars.length > 0 && chars[0].author_id) {
                authorIdToUse = chars[0].author_id;
              }
            }
            
            if (authorIdToUse) {
              const sessionRes = await fetch('/api/auth/session');
              const session = await sessionRes.json();
              if (session?.user?.id !== String(authorIdToUse)) {
                const followRes = await fetch(`/api/profile/${authorIdToUse}/follow`, {
                  method: 'POST',
                });
                const followResult = await followRes.json() as { isFollowing?: boolean; error?: string };
                if (followRes.ok) {
                  updateTestResult(categoryIndex, testIndex, 'success', `フォロー状態: ${followResult.isFollowing ? 'フォロー中' : '未フォロー'}`, Date.now() - startTime);
                } else {
                  throw new Error(followResult.error || 'フォロー処理に失敗');
                }
              } else {
                updateTestResult(categoryIndex, testIndex, 'error', '自分自身はフォローできません', Date.now() - startTime);
              }
            } else {
              throw new Error('テスト用ユーザーまたはキャラクターが存在しません');
            }
          } else if (testIndex === 2) {
            // いいね機能
            // テスト用キャラクターが作成されている場合はそれを使用
            let characterIdToUse = partnerInfoRef.current?.characterId ?? currentTestCharacterId ?? null;
            if (!characterIdToUse) {
              const charsRes = await fetch('/api/charlist');
              const charsData = await charsRes.json() as { characters?: Array<{ id: number; name?: string; [key: string]: unknown }> } | Array<{ id: number; name?: string; [key: string]: unknown }>;
              const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
              if (chars.length > 0) {
                characterIdToUse = chars[0].id;
                setTestCharacterId(chars[0].id);
                testCharacterIdRef.current = chars[0].id;
                if (chars[0].name && typeof chars[0].name === 'string') {
                  setTestCharacterName(chars[0].name);
                  testCharacterNameRef.current = chars[0].name;
                }
              }
            }
            
            if (characterIdToUse) {
              const favoriteRes = await fetch(`/api/characters/${characterIdToUse}/favorite`, {
                method: 'POST',
              });
              const favoriteResult = await favoriteRes.json() as { isFavorite?: boolean; error?: string };
              if (favoriteRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', `いいね状態: ${favoriteResult.isFavorite ? 'いいね済み' : '未いいね'}`, Date.now() - startTime);
              } else {
                throw new Error(favoriteResult.error || 'いいね処理に失敗');
              }
            } else {
              throw new Error('キャラクターが存在しません');
            }
          } else if (testIndex === 3) {
            // コメント機能
            // テスト用キャラクターが作成されている場合はそれを使用
            let characterIdToUse = partnerInfoRef.current?.characterId ?? currentTestCharacterId ?? null;
            if (!characterIdToUse) {
              const charsRes = await fetch('/api/charlist');
              const charsData = await charsRes.json() as { characters?: Array<{ id: number; name?: string; [key: string]: unknown }> } | Array<{ id: number; name?: string; [key: string]: unknown }>;
              const chars = Array.isArray(charsData) ? charsData : (charsData.characters || []);
              if (chars.length > 0) {
                characterIdToUse = chars[0].id;
                setTestCharacterId(chars[0].id);
                testCharacterIdRef.current = chars[0].id;
                if (chars[0].name && typeof chars[0].name === 'string') {
                  setTestCharacterName(chars[0].name);
                  testCharacterNameRef.current = chars[0].name;
                }
              }
            }
            
            if (characterIdToUse) {
              const commentRes = await fetch(`/api/characters/${characterIdToUse}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: 'テストコメント' }),
              });
              const commentResult = await commentRes.json() as { error?: string };
              if (commentRes.ok) {
                updateTestResult(categoryIndex, testIndex, 'success', 'コメント投稿成功', Date.now() - startTime);
              } else {
                throw new Error(commentResult.error || 'コメント投稿に失敗');
              }
            } else {
              throw new Error('キャラクターが存在しません');
            }
          }
          break;

        case 'その他機能':
          if (testIndex === 0) {
            // ランキング取得
            const rankingRes = await fetch('/api/ranking');
            await rankingRes.json();
            if (rankingRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', 'ランキング取得成功', Date.now() - startTime);
            } else {
              throw new Error('ランキング取得に失敗');
            }
          } else if (testIndex === 1) {
            // 検索機能（テストキャラクターのハッシュタグ「テスト」で検索し、作成したキャラクターが含まれるか確認）
            if (!currentTestCharacterId) {
              currentTestCharacterId = partnerInfoRef.current?.characterId ?? null;
              if (currentTestCharacterId) {
                testCharacterIdRef.current = currentTestCharacterId;
                if (!currentTestCharacterName && partnerInfoRef.current?.characterId === currentTestCharacterId) {
                  // keep existing name reference if any
                }
              }
            }
            
            if (!currentTestCharacterId) {
              const adopted = await adoptExistingCharacter();
              currentTestCharacterId = adopted?.id ?? null;
              currentTestCharacterName = adopted?.name ?? currentTestCharacterName;
            }
            
            if (!currentTestCharacterId) {
              throw new Error('テストキャラクターが存在しません。先にテスト環境をセットアップしてください。');
            }
            
            // ハッシュタグ「テスト」で検索
            const searchRes = await fetch('/api/search?query=テスト');
            const searchResult2 = await searchRes.json() as Array<{ id?: number; name?: string }>;
            if (searchRes.ok && Array.isArray(searchResult2)) {
              if (searchResult2.length === 0) {
                throw new Error('検索結果が0件です。テストキャラクターが作成されていないか、検索が機能していません。');
              }
              
              // 作成したキャラクターが検索結果に含まれているか確認
              const foundCharacter = searchResult2.find(c => c.id === currentTestCharacterId);
              if (!foundCharacter) {
                // キャラクター名でも再検索を試みる
                if (currentTestCharacterName) {
                  const nameSearchRes = await fetch(`/api/search?query=${encodeURIComponent(currentTestCharacterName)}`);
                  const nameSearchResult = await nameSearchRes.json() as Array<{ id?: number }>;
                  if (nameSearchRes.ok && Array.isArray(nameSearchResult)) {
                    const foundByName = nameSearchResult.find(c => c.id === currentTestCharacterId);
                    if (foundByName) {
                      updateTestResult(categoryIndex, testIndex, 'success', `検索結果: ${searchResult2.length}件（ハッシュタグ）、${nameSearchResult.length}件（名前）`, Date.now() - startTime);
                    } else {
                      throw new Error(`検索結果にテストキャラクター（ID: ${currentTestCharacterId}, 名前: ${currentTestCharacterName}）が含まれていません。`);
                    }
                  } else {
                    throw new Error('キャラクター名での検索に失敗');
                  }
                } else {
                  throw new Error(`検索結果にテストキャラクター（ID: ${currentTestCharacterId}）が含まれていません。`);
                }
              } else {
                updateTestResult(categoryIndex, testIndex, 'success', `検索結果: ${searchResult2.length}件（テストキャラクター含む）`, Date.now() - startTime);
              }
            } else {
              throw new Error('検索に失敗');
            }
          } else if (testIndex === 2) {
            // ペルソナ一覧取得
            const personaRes = await fetch('/api/persona');
            const personaResult = await personaRes.json() as { personas?: unknown[] };
            if (personaRes.ok) {
              updateTestResult(categoryIndex, testIndex, 'success', `${personaResult.personas?.length || 0}件のペルソナ`, Date.now() - startTime);
            } else {
              throw new Error('ペルソナ取得に失敗');
            }
          } else if (testIndex === 3) {
            // ペルソナ作成
            const timestamp = Date.now();
            const nicknameSuffix = (timestamp % 100000000).toString().padStart(8, '0');
            const payload = {
              nickname: `TP_${nicknameSuffix}`,
              age: 25,
              gender: 'female',
              description: 'テストツールで自動生成されたペルソナです。',
            };
            const createRes = await fetch('/api/persona', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const createResult = await createRes.json() as { id?: number; message?: string; error?: string };
            if (!createRes.ok || !createResult.id) {
              throw new Error(extractErrorMessage(createResult, 'ペルソナ作成に失敗しました'));
            }
            personaCreatedIdRef.current = createResult.id;
            updateTestResult(
              categoryIndex,
              testIndex,
              'success',
              `ID ${createResult.id} を作成`,
              Date.now() - startTime
            );
          } else if (testIndex === 4) {
            // ペルソナ削除
            const personaId = personaCreatedIdRef.current;
            if (!personaId) {
              throw new Error('削除対象のペルソナがありません。先にペルソナ作成テストを実行してください。');
            }
            const deleteRes = await fetch(`/api/persona/${personaId}`, { method: 'DELETE' });
            const deleteResult = await deleteRes.json() as { message?: string; error?: string };
            if (!deleteRes.ok) {
              throw new Error(extractErrorMessage(deleteResult, 'ペルソナ削除に失敗しました'));
            }
            personaCreatedIdRef.current = null;
            updateTestResult(
              categoryIndex,
              testIndex,
              'success',
              deleteResult.message || `ID ${personaId} を削除`,
              Date.now() - startTime
            );
          }
          break;
      }
    } catch (error) {
      updateTestResult(
        categoryIndex,
        testIndex,
        'error',
        error instanceof Error ? error.message : '不明なエラー',
        Date.now() - startTime
      );
    } finally {
      setCurrentTest(null);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setCurrentTest(null);
    setAiAnalysis(null);

    try {
      // テスト環境セットアップ（テスト用ユーザーとキャラクター作成）
      if (!testUserInfo || !testCharacterId) {
        try {
          await setupTestEnvironment();
          console.log('✅ テスト環境セットアップ完了');
        } catch (error) {
          console.warn('⚠️ テスト環境セットアップに失敗しましたが、既存のデータでテストを続行します:', error);
        }
      }

      try {
        await prepareSocialFixtures({ silent: true });
      } catch {
        // 既存データで続行
      }

      // すべてのテストをリセット
      const initialized = initializeTests();
      setTestCategories(initialized);
      pointSnapshotRef.current = null;
      personaCreatedIdRef.current = null;
      hasInitializedRef.current = true;

      for (let categoryIndex = 0; categoryIndex < initialized.length; categoryIndex++) {
        for (let testIndex = 0; testIndex < initialized[categoryIndex].tests.length; testIndex++) {
          await runTest(categoryIndex, testIndex);
          // テスト間に少し待機（API負荷軽減）
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setIsRunning(false);
      
      // テスト完了後、少し待ってからAI分析を実行（状態更新を待つ）
      await new Promise(resolve => setTimeout(resolve, 500));
      await analyzeTestResults();
    } catch (error) {
      console.error('テスト実行エラー:', error);
      setIsRunning(false);
    }
  };

  const analyzeTestResults = async () => {
    setIsAnalyzing(true);
    try {
      // 現在のtestCategories状態を取得（useState의 updater function 사용)
      await new Promise<void>((resolve) => {
        setTestCategories(current => {
          const results = current.flatMap((cat) =>
            cat.tests.map((test) => ({
              category: cat.name,
              name: test.name,
              status: test.status,
              message: test.message,
              duration: test.duration,
            }))
          );

          // 非同期でAI分析を実行
          fetch('/api/admin/test/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results }),
          })
            .then(async (response) => {
              const data = await response.json();
              if (response.ok) {
                setAiAnalysis(data.analysis || '分析結果が取得できませんでした。');
              } else {
                // エラーメッセージを表示
                const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
                setAiAnalysis(`❌ AI分析に失敗しました\n\nエラー: ${errorMsg}\n\n手動で結果を確認してください。`);
                console.error('AI分析APIエラー:', errorMsg);
              }
            })
            .catch((error) => {
              console.error('AI分析エラー:', error);
              const errorMsg = error instanceof Error ? error.message : '不明なエラー';
              setAiAnalysis(`❌ AI分析中にエラーが発生しました\n\nエラー: ${errorMsg}\n\n手動で結果を確認してください。`);
            })
            .finally(() => {
              setIsAnalyzing(false);
              resolve();
            });

          return current;
        });
      });
    } catch (error) {
      console.error('AI分析エラー:', error);
      setAiAnalysis('AI分析中にエラーが発生しました。手動で結果を確認してください。');
      setIsAnalyzing(false);
    }
  };

  const resetTests = () => {
    setTestCategories(initializeTests());
    pointSnapshotRef.current = null;
    personaCreatedIdRef.current = null;
    hasInitializedRef.current = true;
  };

  const cleanupTestData = async () => {
    if (!confirm('テストデータをすべて削除しますか？\nこの操作は取り消せません。')) {
      return;
    }

    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const response = await fetchWithCsrf('/api/admin/test/cleanup', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data.error === 'string'
            ? data.error
            : data?.error?.message ||
              data?.message ||
              (data.error ? JSON.stringify(data.error) : null) ||
              'テストデータの削除に失敗しました。';
        throw new Error(errorMessage);
      }

      setCleanupResult(data);
      // テスト環境情報もリセット
      setTestUserInfo(null);
      setTestCharacterId(null);
      testUserInfoRef.current = null;
      testCharacterIdRef.current = null;
      partnerInfoRef.current = null;
      // テスト結果もリセット
      setTestCategories(initializeTests());
      setAiAnalysis(null);
    } catch (error) {
      alert('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsCleaning(false);
    }
  };

  const prepareSocialFixtures = async (options: { silent?: boolean } = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setIsPreparingSocial(true);
      setSocialSeedResult(null);
    }
    try {
      const response = await fetchWithCsrf('/api/admin/test/seed', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ソーシャルテストデータの準備に失敗しました。');
      }
      if (data?.partnerUser) {
        partnerInfoRef.current = {
          userId: data.partnerUser.id ?? null,
          characterId: data.partnerCharacterId ?? null,
        };
      }
      if (data?.targetCharacterId && !testCharacterIdRef.current) {
        testCharacterIdRef.current = data.targetCharacterId;
        setTestCharacterId(data.targetCharacterId);
        try {
          const charDetailRes = await fetch(`/api/characters/${data.targetCharacterId}`);
          const detail = await charDetailRes.json();
          if (detail?.name) {
            setTestCharacterName(detail.name);
            testCharacterNameRef.current = detail.name;
          }
        } catch {
          // ignore detail fetch errors
        }
      }
      if (!silent) {
        setSocialSeedResult({
          message: data.message || 'ソーシャルデータを準備しました。',
          details: `通知 ${data.notificationsCreated || 0}件 / フォロー ${data.followCreated ? '作成' : '既存'} / いいね ${data.favoriteCreated ? '作成' : '既存'}`,
        });
      }
      return data;
    } catch (error) {
      if (silent) {
        console.warn('ソーシャルデータ準備に失敗しましたが既存データでテストを続行します:', error);
      } else {
        alert('エラー: ' + (error instanceof Error ? error.message : '不明なエラー'));
      }
      throw error;
    } finally {
      if (!silent) {
        setIsPreparingSocial(false);
      }
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={18} className="text-green-400" />;
      case 'error':
        return <XCircle size={18} className="text-red-400" />;
      case 'running':
        return <Loader2 size={18} className="text-blue-400 animate-spin" />;
      default:
        return <AlertCircle size={18} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'running':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const totalTests = testCategories.reduce((sum, cat) => sum + cat.tests.length, 0);
  const passedTests = testCategories.reduce(
    (sum, cat) => sum + cat.tests.filter(t => t.status === 'success').length,
    0
  );
  const failedTests = testCategories.reduce(
    (sum, cat) => sum + cat.tests.filter(t => t.status === 'error').length,
    0
  );

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                機能テストツール
              </h1>
            </div>
          </header>

          {!isLoggedIn ? (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800/50 max-w-md mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-center">ログイン</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                    placeholder="パスワード"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/50 disabled:opacity-50"
                >
                  {isLoggingIn ? 'ログイン中...' : 'メールアドレスでログイン'}
                </button>
              </form>
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900/50 text-gray-400">または</span>
                  </div>
                </div>
                <button
                  onClick={() => signIn('google', { callbackUrl: window.location.href })}
                  disabled={isLoggingIn}
                  className="w-full mt-4 bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Googleでログイン
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* テスト統計 */}
              <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-800/50">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                  <h2 className="text-xl font-bold">テスト統計</h2>
                  <div className="flex gap-3 flex-wrap justify-end">
                    <button
                      onClick={runAllTests}
                      disabled={isRunning || isAnalyzing || isSettingUp || isCleaning}
                      className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50"
                    >
                      <Play size={18} />
                      {isSettingUp ? 'セットアップ中...' : isRunning ? '実行中...' : 'すべて実行'}
                    </button>
                    <button
                      onClick={resetTests}
                      disabled={isRunning || isAnalyzing || isSettingUp || isCleaning}
                      className="bg-gray-800/50 hover:bg-gray-700/50 text-white font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50 disabled:opacity-50"
                    >
                      リセット
                    </button>
                    <button
                      onClick={() => prepareSocialFixtures()}
                      disabled={isRunning || isAnalyzing || isSettingUp || isCleaning || isPreparingSocial}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                    >
                      <Users size={18} />
                      {isPreparingSocial ? '準備中...' : 'ソーシャル準備'}
                    </button>
                    <button
                      onClick={cleanupTestData}
                      disabled={isRunning || isAnalyzing || isSettingUp || isCleaning}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl transition-all shadow-lg shadow-red-500/30 disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                      {isCleaning ? '削除中...' : 'テストデータ削除'}
                    </button>
                  </div>
                </div>
                {testUserInfo && testCharacterId && (
                  <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-xl">
                    <p className="text-sm text-blue-300">
                      ✅ テスト環境: ユーザーID {testUserInfo.userId}, キャラクターID {testCharacterId}
                    </p>
                  </div>
                )}
                {cleanupResult && (
                  <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-xl">
                    <p className="text-sm text-green-300 font-semibold mb-2">
                      ✅ {cleanupResult.message}
                    </p>
                    <p className="text-xs text-green-400">
                      削除されたデータ: ユーザー {cleanupResult.deleted.users}件, 
                      キャラクター {cleanupResult.deleted.characters}件, 
                      チャット {cleanupResult.deleted.chats}件
                    </p>
                  </div>
                )}
                {socialSeedResult && (
                  <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl">
                    <p className="text-sm text-emerald-300 font-semibold mb-2">
                      ✅ {socialSeedResult.message}
                    </p>
                    <p className="text-xs text-emerald-400">{socialSeedResult.details}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-1">総テスト数</p>
                    <p className="text-2xl font-bold">{totalTests}</p>
                  </div>
                  <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-4">
                    <p className="text-sm text-green-400 mb-1">成功</p>
                    <p className="text-2xl font-bold text-green-400">{passedTests}</p>
                  </div>
                  <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm text-red-400 mb-1">失敗</p>
                    <p className="text-2xl font-bold text-red-400">{failedTests}</p>
                  </div>
                </div>
              </div>

              {/* AI分析結果 */}
              {(aiAnalysis || isAnalyzing) && (
                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-purple-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles size={24} className="text-purple-400" />
                    <h2 className="text-xl font-bold">AI分析結果</h2>
                  </div>
                  {isAnalyzing ? (
                    <div className="flex items-center gap-3 text-gray-300">
                      <Loader2 size={20} className="animate-spin text-purple-400" />
                      <p>AIがテスト結果を分析中...</p>
                    </div>
                  ) : (
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* テストカテゴリー */}
              <div className="space-y-4">
                {testCategories.map((category, categoryIndex) => (
                  <div
                    key={categoryIndex}
                    className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-800/50"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {category.icon}
                      <h3 className="text-lg font-bold">{category.name}</h3>
                    </div>
                    <div className="space-y-2">
                      {category.tests.map((test, testIndex) => {
                        const testKey = `${categoryIndex}-${testIndex}`;
                        const isCurrentTest = currentTest === testKey;
                        return (
                          <div
                            key={testIndex}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                              test.status === 'success'
                                ? 'bg-green-900/20 border-green-500/30'
                                : test.status === 'error'
                                ? 'bg-red-900/20 border-red-500/30'
                                : test.status === 'running'
                                ? 'bg-blue-900/20 border-blue-500/30'
                                : 'bg-gray-800/30 border-gray-700/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(test.status)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium ${getStatusColor(test.status)}`}>
                                    {test.name}
                                  </p>
                                  {testDescriptions[test.name] && (
                                    <button
                                      onClick={() => setShowTestDetails(prev => ({
                                        ...prev,
                                        [`${categoryIndex}-${testIndex}`]: !prev[`${categoryIndex}-${testIndex}`]
                                      }))}
                                      className="p-1 rounded hover:bg-gray-700/50 transition-all"
                                      title="テスト詳細を表示"
                                    >
                                      <Info size={14} className="text-gray-400" />
                                    </button>
                                  )}
                                </div>
                                {showTestDetails[`${categoryIndex}-${testIndex}`] && testDescriptions[test.name] && (
                                  <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                    <p className="text-xs text-gray-300 leading-relaxed">{testDescriptions[test.name]}</p>
                                  </div>
                                )}
                                {test.message && (
                                  <p className="text-xs text-gray-400 mt-1">{test.message}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {test.duration !== undefined && (
                                <span className="text-xs text-gray-400">
                                  {test.duration}ms
                                </span>
                              )}
                              <button
                                onClick={() => runTest(categoryIndex, testIndex)}
                                disabled={isRunning || isCurrentTest}
                                className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-all disabled:opacity-50"
                                title="個別実行"
                              >
                                <Play size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

