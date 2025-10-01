"use client";

/**
 * ✅ 目的: Next.js（React 19）で `params` が Promise 化されたため、
 *    直接 `params.characterId` にアクセスすると警告が出る。
 *    → `React.use(params)` でアンラップしてから使用するように修正。
 *    また、APIエラー時に空ボディでも安全に扱えるよう JSON パースを堅牢化。
 * ✅ 追加機能:
 *   - 入力補助ツールバー（「」/ ** で選択テキストを囲む、トグル機能付き）
 *   - セリフ/地の文の色分け（「…」/ "…" = text-white、それ以外 = text-gray-400）
 *     ※ AIのテキストは DialogueText が担当、画像は ChatMessageParser が担当（重複表示を回避）
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Menu, Send, X, Edit3, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import ChatMessageParser from '@/components/ChatMessageParser';
import ChatSettings, { GenerationSettings, ChatStyleSettings } from '@/components/ChatSettings';

// --- 型定義 ---
type CharacterImageInfo = { imageUrl: string; keyword?: string | null; };
type CharacterInfo = { name: string; firstSituation: string | null; firstMessage: string | null; characterImages: CharacterImageInfo[]; };

// DB から取得するメッセージの型
type DbMessage = {
  id: number;
  role: "user" | "model";
  content: string;
  createdAt: string;
  turnId: number | null;
  version: number;
  isActive: boolean;
};

// 画面表示用のメッセージの型（タイムスタンプを追加）
type Message = DbMessage & { timestamp: string; };

// ユーザーの質問と AI の回答をまとめる「ターン」の型
type Turn = {
  turnId: number;
  userMessage: Message;
  modelMessages: Message[];
  activeModelIndex: number;
};

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

/**
 * JSONパース安全関数:
 * - 空レスポンス(204/205)や非JSON(Content-Type)でも例外を投げずに null/テキスト包みを返す
 * - 通常の JSON は try/catch で安全に処理
 */
async function safeParseJSON(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (res.status === 204 || res.status === 205) return null;
  if (!ct.includes('application/json')) {
    try {
      const text = await res.text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** 画像トークン抽出:
 *  ChatMessageParser に渡すコンテンツを {img:n} のみにして
 *  テキストは DialogueText に任せることで、二重表示を回避する
 */
const extractImageTokens = (s: string): string => {
  const tokens = s.match(/\{img:\d+\}/g) || [];
  return tokens.join('\n');
};

// --- 地の文/セリフの色分けコンポーネント ---
// 仕様:
// - 「…」または "…" で囲まれた部分 = セリフ (白: text-white)
// - それ以外 = 地の文 (灰色: text-gray-400)
// - AI応答内の画像トークン {img:n} は表示しない
const DialogueText: React.FC<{ content: string }> = ({ content }) => {
  // 画像トークンは表示しないように取り除く
  const textContent = content.replace(/\{img:\d+\}/g, '');

  const lines = textContent.split(/\r?\n/);

  const renderLine = (line: string, idx: number) => {
    // 表示するテキストがまったくない行はレンダリングしない
    if (line.trim() === '' && lines.length > 1) {
       return <div key={idx} className="h-4" />; // 改行を維持するための空のdiv
    }

    type Part = { text: string; isQuote: boolean };
    const parts: Part[] = [];

    // 正規表現でセリフと地の文を一度に分割
    const regex = /(「[^」]*」|"[^"]*")/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      // 直前の地の文を追加
      if (match.index > lastIndex) {
        parts.push({ text: line.substring(lastIndex, match.index), isQuote: false });
      }
      // マッチしたセリフを追加
      parts.push({ text: match[0], isQuote: true });
      lastIndex = regex.lastIndex;
    }

    // 最後の地の文を追加
    if (lastIndex < line.length) {
      parts.push({ text: line.substring(lastIndex), isQuote: false });
    }

    return (
      <div key={idx} className="whitespace-pre-wrap">
        {parts.map((p, i) => (
          <span key={i} className={p.isQuote ? 'text-white' : 'text-gray-400'}>
            {p.text}
          </span>
        ))}
      </div>
    );
  };

  return <>{lines.map(renderLine)}</>;
};

// 確認モーダル（機能変更なし）
const ConfirmationModal = ({
  modalState,
  setModalState,
}: {
  modalState: ModalState;
  setModalState: (state: ModalState) => void;
}) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => {
    modalState.onCancel?.();
    setModalState({ ...modalState, isOpen: false });
  };
  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4">{modalState.title}</h2>
        <p className="text-gray-300 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
            >
              キャンセル
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 ${
              modalState.confirmText?.includes('開始') ||
              modalState.confirmText?.includes('削除')
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-pink-600 hover:bg-pink-500'
            } rounded-lg`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ChatPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const { characterId } = React.use(params);

  // --- ステート管理 ---
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showChatImage, setShowChatImage] = useState(true);
  const [isMultiImage, setIsMultiImage] = useState(true);
  const [userNote, setUserNote] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [userPoints, setUserPoints] = useState(0);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
    model: 'gemini-2.5-pro',
    responseBoostMultiplier: 1.0,
  });
  const [chatStyleSettings, setChatStyleSettings] = useState<ChatStyleSettings>({
    fontSize: 14,
    userBubbleColor: '#db2777',
    userBubbleTextColor: '#ffffff',
  });

  // --- 新機能関連の State ---
  const [turns, setTurns] = useState<Turn[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingUserContent, setEditingUserContent] = useState('');
  const [editingModelContent, setEditingModelContent] = useState('');

  // 生のメッセージリスト(rawMessages)を「ターン」構造に整形
  useEffect(() => {
    const userMessages = rawMessages.filter((m) => m.role === 'user');
    const modelMessages = rawMessages.filter((m) => m.role === 'model');

    const newTurns: Turn[] = userMessages.map((userMsg) => {
      const correspondingModels = modelMessages
        .filter((modelMsg) => modelMsg.turnId === userMsg.id)
        .sort((a, b) => a.version - b.version);

      const activeModel =
        correspondingModels.find((m) => m.isActive) ||
        correspondingModels[correspondingModels.length - 1];

      const activeIndex = activeModel ? correspondingModels.indexOf(activeModel) : 0;

      return {
        turnId: userMsg.id,
        userMessage: userMsg,
        modelMessages: correspondingModels,
        activeModelIndex: activeIndex,
      };
    });

    setTurns(newTurns);
  }, [rawMessages]);

  // 生成設定の保存（ローカルストレージ + トースト）
  const handleGenerationSettingsChange = (newSettings: GenerationSettings) => {
    setGenerationSettings(newSettings);
    localStorage.setItem('generationSettings', JSON.stringify(newSettings));
    setModalState({
      isOpen: true,
      title: '成功',
      message: 'AI応答設定を保存しました。',
      isAlert: true,
    });
  };

  // 表示設定の保存（ローカルストレージ + トースト）
  const handleChatStyleSettingsChange = (newSettings: ChatStyleSettings) => {
    setChatStyleSettings(newSettings);
    localStorage.setItem('chatStyleSettings', JSON.stringify(newSettings));
    setModalState({
      isOpen: true,
      title: '成功',
      message: '表示設定を保存しました。',
      isAlert: true,
    });
  };

  // 初期ロード（クエリ, ローカル設定のロード）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatIdFromQuery = params.get('chatId');
    if (chatIdFromQuery) {
      setChatId(parseInt(chatIdFromQuery, 10));
    }

    const savedGenSettings = localStorage.getItem('generationSettings');
    if (savedGenSettings) setGenerationSettings(JSON.parse(savedGenSettings));

    const savedStyleSettings = localStorage.getItem('chatStyleSettings');
    if (savedStyleSettings) setChatStyleSettings(JSON.parse(savedStyleSettings));
  }, []);

  // ユーザーポイントの取得（useCallback で再生成を抑制）
  const fetchUserPoints = useCallback(async () => {
    if (!session?.user.id) return;
    try {
      const response = await fetch(`/api/points`);
      if (!response.ok) throw new Error('ポイント情報の取得に失敗しました。');
      const data = await safeParseJSON(response);
      const total =
        ((data && (data.free_points || 0)) || 0) +
        ((data && (data.paid_points || 0)) || 0);
      setUserPoints(total);
    } catch (error) {
      console.error(error);
      setUserPoints(0);
    }
  }, [session]);

  // ユーザーポイントを初期取得
  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);

  // チャット画面の初期化（キャラ情報・セッション・メッセージ）
  useEffect(() => {
    if (!characterId) return;

    const initializeChat = async () => {
      setIsInitialLoading(true);
      try {
        // キャラクター情報
        const charResponse = await fetch(`/api/characters/${characterId}`, { cache: 'no-store' });
        if (!charResponse.ok) throw new Error('キャラクター情報の取得に失敗しました。');
        const charData: CharacterInfo = await charResponse.json();
        setCharacterInfo(charData);

        // チャットセッションの find-or-create
        const chatSessionResponse = await fetch('/api/chats/find-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId, chatId }),
          cache: 'no-store',
        });
        if (!chatSessionResponse.ok) throw new Error('チャットセッションの取得に失敗しました。');
        const chatSessionData = await chatSessionResponse.json();

        setChatId(chatSessionData.id);
        setUserNote(chatSessionData.userNote || '');

        // メッセージのフォーマット
        const formattedMessages: Message[] = chatSessionData.chat_message.map((msg: DbMessage) => ({
          ...msg,
          timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
        setRawMessages(formattedMessages);
      } catch (error) {
        console.error(error);
        setModalState({
          isOpen: true,
          title: 'エラー',
          message: 'チャットの読み込みに失敗しました。',
          isAlert: true,
          onConfirm: () => router.back(),
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeChat();
  }, [characterId, chatId, router]);

  // スクロールを最下部へ
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [turns]);


  // --- 入力補助ツールバーのトグル機能付き関数 ---
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 選択範囲を特定の文字列でラップ、またはアンラップする関数
   * @param left 左側のラッパー文字 (例: "**", "「")
   * @param right 右側のラッパー文字 (例: "**", "」")
   */
  const wrapSelection = (left: string, right: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = input.slice(0, start);
    const selected = input.slice(start, end);
    const after = input.slice(end);

    // チェック: 選択範囲の直前・直後がすでに指定文字で囲まれているか
    if (before.endsWith(left) && after.startsWith(right)) {
      // --- アンラップ処理 ---
      const unwrappedBefore = before.slice(0, before.length - left.length);
      const unwrappedAfter = after.slice(right.length);
      const next = `${unwrappedBefore}${selected}${unwrappedAfter}`;
      setInput(next);

      // カーソル位置を更新（アンラップされたテキストの末尾に移動）
      requestAnimationFrame(() => {
        el.focus();
        const pos = start - left.length + selected.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      // --- ラップ処理 ---
      const next = `${before}${left}${selected}${right}${after}`;
      setInput(next);

      // カーソル位置を更新
      requestAnimationFrame(() => {
        el.focus();
        // 選択がなければカーソルを括弧の間に移動 (例: 「|」)
        // 選択があれば、選択されたテキストの直後にカーソルを移動 (例: 「テキスト|」)
        const pos = start + left.length + selected.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  // 送信処理
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId || !session?.user.id) return;

    // レスポンスブースト課金ロジック（UI 仕様通り）
    const boostCostMap: { [key: number]: number } = { 1.5: 1, 3.0: 2, 5.0: 4 };
    const boostCost = boostCostMap[generationSettings.responseBoostMultiplier] || 0;
    const totalPointsToConsume = 1 + boostCost;

    if (userPoints < totalPointsToConsume) {
      setModalState({
        isOpen: true,
        title: 'ポイント不足',
        message: `メッセージの送信には${totalPointsToConsume}ポイント必要です。`,
        isAlert: true,
      });
      return;
    }

    setIsLoading(true);
    const messageToSend = input;
    setInput('');

    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend, settings: generationSettings }),
      });

      if (!response.ok) {
        const errorData = await safeParseJSON(response);
        await fetchUserPoints();
        const msg =
          (errorData && (errorData.error || errorData.message)) ||
          `APIからの応答エラー（HTTP ${response.status}）`;
        throw new Error(msg);
      }

      // ポイント消費と設定のリセット
      setUserPoints((prev) => prev - totalPointsToConsume);
      const newSettings = { ...generationSettings, responseBoostMultiplier: 1.0 };
      setGenerationSettings(newSettings);
      localStorage.setItem('generationSettings', JSON.stringify(newSettings));

      // 新規メッセージを UI に反映（安全パース）
      const data = await safeParseJSON(response);
      if (!data || !Array.isArray(data.newMessages)) {
        throw new Error('サーバーから有効な応答がありません。');
      }
      const { newMessages } = data;

      setRawMessages((prev) => [
        ...prev,
        ...newMessages.map((msg: DbMessage) => ({
          ...msg,
          timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
      ]);
    } catch (error) {
      console.error('チャットエラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: (error as Error).message,
        isAlert: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 編集系ハンドラ ---

  // メッセージ編集開始
  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    if (message.role === 'user') setEditingUserContent(message.content);
    else setEditingModelContent(message.content);
  };

  // メッセージ編集保存
  const handleEditSave = async () => {
    if (editingMessageId === null) return;
    const messageToUpdate = rawMessages.find((m) => m.id === editingMessageId);
    if (!messageToUpdate) return;

    const newContent =
      messageToUpdate.role === 'user' ? editingUserContent : editingModelContent;

    // 極力 UI を即時反映（楽観的更新）
    setRawMessages(
      rawMessages.map((m) => (m.id === editingMessageId ? { ...m, content: newContent } : m)),
    );
    setEditingMessageId(null);

    try {
      await fetch('/api/chat/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: editingMessageId, newContent }),
      });
    } catch (error) {
      console.error('編集エラー:', error);
      // エラー時は UI を元に戻す
      setRawMessages(
        rawMessages.map((m) => (m.id === editingMessageId ? messageToUpdate : m)),
      );
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'メッセージの更新に失敗しました。',
        isAlert: true,
      });
    }
  };

  // メッセージ削除
  const handleDelete = (messageId: number) => {
    const message = rawMessages.find((m) => m.id === messageId);
    if (!message) return;

    setModalState({
      isOpen: true,
      title: '削除の確認',
      message: `${
        message.role === 'user' ? 'この質問とそれ以降の全ての返信' : 'この返信'
      }を削除しますか？`,
      confirmText: '削除',
      onConfirm: async () => {
        // 極力 UI を即時反映（楽観的更新）
        const turnId = message.role === 'user' ? message.id : message.turnId;
        const filteredMessages = rawMessages.filter((m) => {
          if (message.role === 'user') return m.turnId !== turnId && m.id !== turnId;
          return m.id !== messageId;
        });
        setRawMessages(filteredMessages);

        try {
          await fetch('/api/chat/messages', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId }),
          });
        } catch (error) {
          console.error('削除エラー:', error);
          // 失敗時は戻す
          setRawMessages(rawMessages);
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: '削除に失敗しました。',
            isAlert: true,
          });
        }
      },
    });
  };

  // AI 回答の再生成
  const handleRegenerate = async (turn: Turn) => {
    if (isLoading || !chatId || !session?.user.id) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          turnId: turn.turnId,
          settings: generationSettings,
        }),
      });
      if (!response.ok) {
        const errorData = await safeParseJSON(response);
        const msg =
          (errorData && (errorData.error || errorData.message)) ||
          `再生成に失敗しました。（HTTP ${response.status}）`;
        throw new Error(msg);
      }

      const data = await safeParseJSON(response);
      if (!data || !data.newMessage) {
        throw new Error('サーバー応答の形式が不正です。');
      }
      const { newMessage } = data;

      setRawMessages((prev) => {
        const others = prev.filter(
          (m) => m.turnId !== turn.turnId || m.role !== 'model',
        );
        const existingModels = prev
          .filter((m) => m.turnId === turn.turnId && m.role === 'model')
          .map((m) => ({ ...m, isActive: false }));
        return [
          ...others,
          ...existingModels,
          {
            ...newMessage,
            timestamp: new Date(newMessage.createdAt).toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ];
      });
    } catch (error) {
      console.error('再生成エラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: (error as Error).message,
        isAlert: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 表示する AI 回答のバージョン切り替え
  const switchModelMessage = (turnId: number, direction: 'next' | 'prev') => {
    const turn = turns.find((t) => t.turnId === turnId);
    if (!turn || turn.modelMessages.length <= 1) return;

    let newIndex = turn.activeModelIndex;
    if (direction === 'next') newIndex = (newIndex + 1) % turn.modelMessages.length;
    else newIndex = (newIndex - 1 + turn.modelMessages.length) % turn.modelMessages.length;

    const newActiveMessageId = turn.modelMessages[newIndex].id;

    // UI を即時更新
    setRawMessages(
      rawMessages.map((m) => {
        if (m.turnId === turnId && m.role === 'model') {
          return { ...m, isActive: m.id === newActiveMessageId };
        }
        return m;
      }),
    );

    // DB 更新（失敗しても UI は維持）
    fetch('/api/chat/messages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnId: turnId, activeMessageId: newActiveMessageId }),
    }).catch((err) => console.error('バージョン切り替えのDB更新に失敗:', err));
  };

  // 新規チャット開始（確認モーダル）
  const handleNewChat = () => {
    if (!characterId) return;
    setModalState({
      isOpen: true,
      title: '確認',
      message: '現在のチャットを終了し、新しいチャットを開始しますか？',
      confirmText: '開始する',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/chats/find-or-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId, forceNew: true }),
          });
          if (!response.ok) throw new Error('新しいチャットの作成に失敗しました。');
          const newChat = await response.json();
          router.push(`/chat/${characterId}?chatId=${newChat.id}`);
          // 完全にリセットした状態で読み込み直す
          window.location.reload();
        } catch (error) {
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: (error as Error).message || '新しいチャットの作成に失敗しました。',
            isAlert: true,
          });
        }
      },
    });
  };

  // 会話の .txt 保存
  const handleSaveConversationAsTxt = () => {
    if (!characterInfo || rawMessages.length === 0) {
      setModalState({
        isOpen: true,
        title: '情報',
        message: '保存する会話内容がありません。',
        isAlert: true,
      });
      return;
    }
    const header = `キャラクター: ${characterInfo.name}\n保存日時: ${new Date().toLocaleString('ja-JP')}\n---\n\n`;
    const formattedContent = turns
      .map((turn) => {
        const userLine = `ユーザー: ${turn.userMessage.content}`;
        if (turn.modelMessages.length > 0) {
          const modelLine = `${characterInfo.name}: ${turn.modelMessages[
            turn.activeModelIndex
          ].content
            .replace(/\{img:\d+\}/g, '')
            .trim()}`;
          return `${userLine}\n\n${modelLine}`;
        }
        return userLine;
      })
      .join('\n\n');
    const blob = new Blob([header + formattedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_with_${characterInfo.name}_${new Date()
      .toISOString()
      .slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    setIsSettingsOpen(false);
  };

  // ノート保存
  const handleSaveNote = async (note: string) => {
    if (chatId === null) return;
    try {
      const response = await fetch(`/api/chat/${chatId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNote: note }),
      });
      if (!response.ok) throw new Error('ノートの保存に失敗しました。');
      await response.json();
      setUserNote(note);
      setModalState({ isOpen: true, title: '成功', message: 'ノートを保存しました。', isAlert: true });
    } catch (error) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: (error as Error).message,
        isAlert: true,
      });
    }
  };

  // --- レンダリング ---
  if (isInitialLoading || !characterInfo) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        チャットを準備中...
      </div>
    );
  }

  const dynamicStyles = {
    '--user-bubble-color': chatStyleSettings.userBubbleColor,
    '--user-bubble-text-color': chatStyleSettings.userBubbleTextColor,
    fontSize: `${chatStyleSettings.fontSize}px`,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col h-screen bg-black text-white" style={dynamicStyles}>
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />

      {/* ヘッダー */}
      <header className="flex items-center justify-between p-3 border-b border-gray-700 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-700 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <Link href={`/characters/${characterId}`} className="flex flex-col items-center">
          <div className="relative w-10 h-10 rounded-full overflow-hidden">
            <Image
              src={characterInfo.characterImages[0]?.imageUrl || '/default-avatar.png'}
              alt={characterInfo.name}
              fill
              className="object-cover"
            />
          </div>
          <span className="text-sm font-semibold mt-1">{characterInfo.name}</span>
        </Link>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-700 rounded-full">
          <Menu size={24} />
        </button>
      </header>

      {/* メイン（チャット本体） */}
      <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {turns.map((turn, turnIndex) => {
          const userMsg = turn.userMessage;
          const isEditingUser = editingMessageId === userMsg.id;

          return (
            <div key={turn.turnId} className="space-y-4">
              {/* ユーザーメッセージ */}
              <div className="flex flex-col items-end group">
                <div className="flex items-end gap-2">
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(userMsg.id)} className="p-1 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                    <button onClick={() => handleEditStart(userMsg)} className="p-1 hover:text-pink-400">
                      <Edit3 size={16} />
                    </button>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--user-bubble-color)',
                      color: 'var(--user-bubble-text-color)',
                    }}
                    className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-xl"
                  >
                    {isEditingUser ? (
                      <textarea
                        value={editingUserContent}
                        onChange={(e) => setEditingUserContent(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 resize-none p-0"
                        rows={Math.min(10, editingUserContent.split('\n').length)}
                      />
                    ) : (
                      // ユーザーメッセージも色分け表示を適用
                      <DialogueText content={userMsg.content} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  {isEditingUser && (
                    <button onClick={handleEditSave} className="text-xs text-pink-400 hover:underline">
                      保存
                    </button>
                  )}
                  <span className="text-xs text-gray-400">{userMsg.timestamp}</span>
                </div>
              </div>

              {/* AI メッセージ */}
              {turn.modelMessages.length > 0 &&
                (() => {
                  const activeModelMessage = turn.modelMessages[turn.activeModelIndex];
                  const isEditing = editingMessageId === activeModelMessage.id;

                  // 画像は Parser に任せ、テキストは DialogueText が担当（重複回避）
                  const imageOnlyContent = extractImageTokens(activeModelMessage.content);

                  return (
                    <div className="flex flex-col items-start group">
                      {/* メッセージバブル */}
                      <div className="bg-gray-800 px-4 py-2 rounded-xl max-w-xs md:max-w-md lg:max-w-2xl space-y-2">
                        {isEditing ? (
                          <textarea
                            value={editingModelContent}
                            onChange={(e) => setEditingModelContent(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 resize-none p-0"
                            rows={Math.min(15, editingModelContent.split('\n').length)}
                          />
                        ) : (
                          <>
                            {/* 画像レンダリング（テキストは含めない） */}
                            {imageOnlyContent && (
                              <ChatMessageParser
                                content={imageOnlyContent}
                                characterImages={characterInfo.characterImages.slice(1)}
                                showImage={showChatImage}
                                isMultiImage={isMultiImage}
                                onImageClick={setLightboxImage}
                              />
                            )}
                            {/* セリフ色分けテキスト */}
                            <DialogueText content={activeModelMessage.content} />
                          </>
                        )}
                      </div>

                      {isEditing && (
                        <div className="flex justify-end mt-1 w-full max-w-xs md:max-w-md lg:max-w-2xl pr-2">
                          <button onClick={handleEditSave} className="text-xs text-pink-400 hover:underline">
                            保存
                          </button>
                        </div>
                      )}

                      {/* 操作バー */}
                      <div className="flex items-center justify-between w-full max-w-xs md:max-w-md lg:max-w-2xl mt-1 h-6 text-gray-400">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditStart(activeModelMessage)} className="p-1 hover:text-pink-400">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(activeModelMessage.id)} className="p-1 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                          {turnIndex === turns.length - 1 && (
                            <button onClick={() => handleRegenerate(turn)} className="p-1 hover:text-green-400">
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>

                        {/* バージョン切替 */}
                        {turn.modelMessages.length > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => switchModelMessage(turn.turnId, 'prev')}
                              className="p-1 rounded-full hover:bg-gray-700"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-mono">
                              {turn.activeModelIndex + 1} / {turn.modelMessages.length}
                            </span>
                            <button
                              onClick={() => switchModelMessage(turn.turnId, 'next')}
                              className="p-1 rounded-full hover:bg-gray-700"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}

        {/* ローディングドット */}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-gray-800 px-4 py-3 rounded-xl">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* フッター（入力欄） */}
      <footer className="p-3 border-t border-gray-700 bg-black/50 backdrop-blur-sm sticky bottom-0">

        {/* --- 入力補助ツールバー --- */}
        <div className="mb-2 flex items-center gap-2 text-sm">
          {/* ▼▼▼【変更点】ここです！ 버튼 아이콘을 'B'에서 '**'로 수정했습니다. ▼▼▼ */}
          <button
            type="button"
            onClick={() => wrapSelection('**', '**')}
            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
            title="太字"
          >
            **
          </button>
          <button
            type="button"
            onClick={() => wrapSelection('「', '」')}
            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700"
            title="セリフ（日本語カギ括弧）"
          >
            「」
          </button>
        </div>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力"
            disabled={isLoading}
            className="flex-1 bg-gray-800 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-pink-500 disabled:opacity-50 resize-none"
            rows={1}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-pink-600 hover:bg-pink-700 rounded-full p-2 disabled:opacity-50"
          >
            <Send size={24} className="text-white" />
          </button>
        </form>
      </footer>

      {/* 設定ダイアログ */}
      <ChatSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showChatImage={showChatImage}
        onShowChatImageChange={setShowChatImage}
        isMultiImage={isMultiImage}
        onIsMultiImageChange={setIsMultiImage}
        onNewChat={handleNewChat}
        onSaveConversationAsTxt={handleSaveConversationAsTxt}
        userNote={userNote}
        onSaveNote={handleSaveNote}
        characterId={characterId}
        chatId={chatId}
        generationSettings={generationSettings}
        onGenerationSettingsChange={handleGenerationSettingsChange}
        chatStyleSettings={chatStyleSettings}
        onChatStyleSettingsChange={handleChatStyleSettingsChange}
        userPoints={userPoints}
      />

      {/* 画像ライトボックス */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative w-full h-full max-w-4xl max-h-[90vh]">
            <Image src={lightboxImage} alt="lightbox" fill className="object-contain" />
          </div>
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 p-2">
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}