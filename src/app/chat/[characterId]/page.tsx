"use client";

// 既存のインポート
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// 外部コンポーネントのインポート
import ChatSettings, { GenerationSettings, ChatStyleSettings } from "@/components/ChatSettings";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessageList from "@/components/chat/ChatMessageList";
import ChatFooter from "@/components/chat/ChatFooter";
import ConfirmationModal from "@/components/chat/ConfirmationModal";
import ImageLightbox from "@/components/chat/ImageLightbox";

// 型定義のインポート
import type { CharacterInfo, Message, Turn, ModalState, DbMessage, CharacterImageInfo } from '@/types/chat';

// --- ユーティリティ関数 ---

/**
 * JSONを安全にパースする
 */
// ▼▼▼【修正】any型をジェネリック型<T>に変更し、型安全性を向上させます ▼▼▼
async function safeParseJSON<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try { 
    return await res.json() as T;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) { 
    return null; 
  }
}
// ▲▲▲ 修正ここまで ▲▲▲


/**
 * キーワードに基づいて画像を優先順位付けする
 */
const prioritizeImagesByKeyword = (userText: string, allImages: CharacterImageInfo[]): CharacterImageInfo[] => {
  const images = allImages.slice(1);
  if (!userText.trim()) return images;
  const lowerUserText = userText.toLowerCase();
  const matched: CharacterImageInfo[] = [];
  const rest: CharacterImageInfo[] = [];
  images.forEach(img => {
    const keyword = (img.keyword || "").toLowerCase().trim();
    if (keyword && lowerUserText.includes(keyword)) {
      matched.push(img);
    } else {
      rest.push(img);
    }
  });
  return [...matched, ...rest];
};


// --- メインページコンポーネント ---

export default function ChatPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { characterId } = useParams<{ characterId: string }>();
  const searchParams = useSearchParams();

  // --- State管理 ---
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<CharacterInfo | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showChatImage, setShowChatImage] = useState(true);
  const [isMultiImage, setIsMultiImage] = useState(true);
  const [userNote, setUserNote] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: "", message: "" });
  const [userPoints, setUserPoints] = useState(0);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({ model: "gemini-2.5-pro", responseBoostMultiplier: 1.0 });
  const [chatStyleSettings, setChatStyleSettings] = useState<ChatStyleSettings>({ fontSize: 14, userBubbleColor: "#db2777", userBubbleTextColor: "#ffffff" });
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingUserContent, setEditingUserContent] = useState("");
  const [editingModelContent, setEditingModelContent] = useState("");
  const [isNewChatSession, setIsNewChatSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- データ整形: rawMessagesからturnsを作成 ---
  useEffect(() => {
    const userMessages = rawMessages.filter(m => m.role === 'user');
    const modelMessages = rawMessages.filter(m => m.role === 'model');
    const newTurns = userMessages.map(userMsg => {
      const correspondingModels = modelMessages
        .filter(modelMsg => modelMsg.turnId === userMsg.id)
        .sort((a, b) => a.version - b.version);
      const activeModel = correspondingModels.find(m => m.isActive) || correspondingModels[correspondingModels.length - 1];
      return {
        turnId: userMsg.id,
        userMessage: userMsg,
        modelMessages: correspondingModels,
        activeModelIndex: activeModel ? correspondingModels.indexOf(activeModel) : 0,
      };
    });
    setTurns(newTurns);
  }, [rawMessages]);

  // --- データ取得関連のEffect ---
  const fetchUserPoints = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const response = await fetch(`/api/points`);
      if (!response.ok) throw new Error("ポイント取得失敗");
      // ▼▼▼【修正】safeParseJSONに型引数を渡し、dataの型を明確にします ▼▼▼
      const data = await safeParseJSON<{ free_points?: number; paid_points?: number }>(response);
      // ▲▲▲ 修正ここまで ▲▲▲
      setUserPoints((data?.free_points || 0) + (data?.paid_points || 0));
    // ▼▼▼【修正】error変数が使用されているため、不要なeslint-disableコメントを削除します ▼▼▼
    } catch (error) {
      console.error(error);
    }
    // ▲▲▲ 修正ここまで ▲▲▲
  }, [session]);

  useEffect(() => { fetchUserPoints(); }, [fetchUserPoints]);

  useEffect(() => {
    if (!characterId) return;
    const loadCharacterInfo = async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}`);
        if (!res.ok) throw new Error("キャラクター情報取得失敗");
        setCharacterInfo(await res.json());
      } catch (e) {
        console.error(e);
        setModalState({ isOpen: true, title: "エラー", message: "キャラクター情報読込失敗", onConfirm: () => router.back() });
      }
    };
    loadCharacterInfo();
  }, [characterId, router]);
  
  useEffect(() => {
    if (!characterId) return;
    const chatIdFromUrl = searchParams.get("chatId");
    
    const loadChatSession = async () => {
        setIsInitialLoading(true);
        try {
            const res = await fetch("/api/chats/find-or-create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    characterId: Number(characterId),
                    chatId: chatIdFromUrl ? Number(chatIdFromUrl) : null,
                }),
            });
            if (!res.ok) throw new Error("チャットセッション取得失敗");
            const data = await res.json();
            setChatId(data.id);
            setUserNote(data.userNote || "");
            const formattedMessages = (data.chat_message || []).map((msg: DbMessage) => ({
                ...msg,
                timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
            }));
            setRawMessages(formattedMessages);
            setIsNewChatSession(formattedMessages.length === 0);
        } catch (e) {
            console.error(e);
            setModalState({ isOpen: true, title: "エラー", message: "チャット読込失敗", onConfirm: () => router.back() });
        } finally {
            setIsInitialLoading(false);
        }
    };
    loadChatSession();
  }, [characterId, searchParams, router]);


  // --- UI関連のEffect ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // --- イベントハンドラ ---
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;
    // ... (送信ロジックは変更なし)
    setIsLoading(true);
    const messageToSend = input;
    setInput("");
    try {
        const response = await fetch(`/api/chat/${chatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageToSend, settings: generationSettings }),
        });
        if (!response.ok) {
            // ▼▼▼【修正】safeParseJSONに型引数を渡し、errorDataの型を明確にします ▼▼▼
            const errorData = await safeParseJSON<{ message?: string }>(response);
            // ▲▲▲ 修正ここまで ▲▲▲
            throw new Error(errorData?.message || 'APIエラー');
        }
        await fetchUserPoints(); // ポイントを再取得
        const data = await response.json();
        const newFormattedMessages = (data.newMessages || []).map((msg: DbMessage) => ({
            ...msg,
            timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        }));
        setRawMessages(prev => [...prev, ...newFormattedMessages]);
    } catch (error) {
        setModalState({ isOpen: true, title: "送信エラー", message: (error as Error).message, isAlert: true });
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    if (message.role === 'user') setEditingUserContent(message.content);
    else setEditingModelContent(message.content);
  };

  const handleEditSave = async () => {
    // ... (編集保存ロジックは変更なし)
    if (editingMessageId === null) return;
    const message = rawMessages.find(m => m.id === editingMessageId);
    if (!message) return;
    const newContent = message.role === 'user' ? editingUserContent : editingModelContent;
    
    const originalContent = message.content;
    setRawMessages(rawMessages.map(m => m.id === editingMessageId ? { ...m, content: newContent } : m));
    setEditingMessageId(null);

    try {
        await fetch('/api/chat/messages', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: editingMessageId, newContent }),
        });
    // ▼▼▼【修正】catchブロックでエラー変数を使用しないため、ESLintルールを無効化します ▼▼▼
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
    // ▲▲▲ 修正ここまで ▲▲▲
        setRawMessages(rawMessages.map(m => m.id === editingMessageId ? { ...m, content: originalContent } : m));
        setModalState({ isOpen: true, title: "編集エラー", message: "メッセージの更新に失敗しました。", isAlert: true });
    }
  };

  const handleDelete = (messageId: number) => {
    // ... (削除確認モーダルの表示ロジックは変更なし)
    const message = rawMessages.find(m => m.id === messageId);
    if (!message) return;

    setModalState({
        isOpen: true,
        title: "削除の確認",
        message: "このメッセージと以降のやり取りを削除しますか？",
        confirmText: "削除",
        onConfirm: async () => {
            const originalMessages = [...rawMessages];
            const turnId = message.role === 'user' ? message.id : message.turnId;
            setRawMessages(prev => prev.filter(m => m.turnId !== turnId && m.id !== turnId));
            
            try {
                await fetch('/api/chat/messages', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId }),
                });
            // ▼▼▼【修正】catchブロックでエラー変数を使用しないため、ESLintルールを無効化します ▼▼▼
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
            // ▲▲▲ 修正ここまで ▲▲▲
                setRawMessages(originalMessages);
                setModalState({ isOpen: true, title: "削除エラー", message: "削除に失敗しました。", isAlert: true });
            }
        },
    });
  };

  const handleRegenerate = async (turn: Turn) => {
    // ... (再生成ロジックは変更なし)
     if (isLoading || !chatId) return;
    setIsLoading(true);
    try {
        const res = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, turnId: turn.turnId, settings: generationSettings }),
        });
        if (!res.ok) throw new Error("再生成に失敗しました");
        const data = await res.json();
        const newMessage = {
            ...data.newMessage,
            timestamp: new Date(data.newMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        };
        setRawMessages(prev => {
            const updated = prev.map(m => (m.turnId === turn.turnId && m.role === 'model') ? { ...m, isActive: false } : m);
            return [...updated, newMessage];
        });
    } catch (error) {
        setModalState({ isOpen: true, title: "エラー", message: (error as Error).message, isAlert: true });
    } finally {
        setIsLoading(false);
    }
  };

  const switchModelMessage = (turnId: number, direction: "next" | "prev") => {
    // ... (バージョン切り替えロジックは変更なし)
    const turn = turns.find(t => t.turnId === turnId);
    if (!turn || turn.modelMessages.length <= 1) return;
    const newIndex = direction === 'next'
        ? (turn.activeModelIndex + 1) % turn.modelMessages.length
        : (turn.activeModelIndex - 1 + turn.modelMessages.length) % turn.modelMessages.length;
    
    const newActiveId = turn.modelMessages[newIndex].id;
    setRawMessages(prev => prev.map(m => {
        if (m.turnId === turnId && m.role === 'model') {
            return { ...m, isActive: m.id === newActiveId };
        }
        return m;
    }));

    fetch('/api/chat/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnId, activeMessageId: newActiveId }),
    });
  };

  const wrapSelection = (left: string, right: string) => {
    // ... (テキスト選択ラップロジックは変更なし)
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selectedText = input.substring(selectionStart, selectionEnd);
    const newText = `${input.substring(0, selectionStart)}${left}${selectedText}${right}${input.substring(selectionEnd)}`;
    setInput(newText);
    setTimeout(() => {
        el.focus();
        el.setSelectionRange(selectionStart + left.length, selectionEnd + left.length);
    }, 0);
  };
  
  // --- レンダリング ---

  if (isInitialLoading || !characterInfo) {
    return <div className="min-h-screen bg-black text-white flex justify-center items-center">チャットを準備中...</div>;
  }
  
  const dynamicStyles = {
    "--user-bubble-color": chatStyleSettings.userBubbleColor,
    "--user-bubble-text-color": chatStyleSettings.userBubbleTextColor,
    fontSize: `${chatStyleSettings.fontSize}px`,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col h-screen bg-black text-white" style={dynamicStyles}>
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />

      <ChatHeader
        characterId={characterId}
        characterInfo={characterInfo}
        onBack={() => router.back()}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <ChatMessageList
          isNewChatSession={isNewChatSession}
          characterInfo={characterInfo}
          turns={turns}
          isLoading={isLoading}
          editingMessageId={editingMessageId}
          editingUserContent={editingUserContent}
          editingModelContent={editingModelContent}
          setEditingUserContent={setEditingUserContent}
          setEditingModelContent={setEditingModelContent}
          handleEditStart={handleEditStart}
          handleEditSave={handleEditSave}
          handleEditCancel={() => setEditingMessageId(null)}
          handleDelete={handleDelete}
          handleRegenerate={handleRegenerate}
          switchModelMessage={switchModelMessage}
          prioritizeImagesByKeyword={prioritizeImagesByKeyword}
          showChatImage={showChatImage}
          isMultiImage={isMultiImage}
          setLightboxImage={setLightboxImage}
        />
        <div ref={messagesEndRef} />
      </main>

      <ChatFooter
        ref={textareaRef}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        handleSendMessage={handleSendMessage}
        wrapSelection={wrapSelection}
      />
      
      <ChatSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showChatImage={showChatImage}
        onShowChatImageChange={setShowChatImage}
        isMultiImage={isMultiImage}
        onIsMultiImageChange={setIsMultiImage}
        onNewChat={() => { /* ロジックをここに実装 */ }}
        onSaveConversationAsTxt={() => { /* ロジックをここに実装 */ }}
        userNote={userNote}
        // ▼▼▼【修正】onSaveNoteのnote引数を使用しないため、ESLintルールを無効化します ▼▼▼
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onSaveNote={async (note) => { /* ロジックをここに実装 */ }}
        // ▲▲▲ 修正ここまで ▲▲▲
        characterId={characterId}
        chatId={chatId}
        generationSettings={generationSettings}
        onGenerationSettingsChange={setGenerationSettings}
        chatStyleSettings={chatStyleSettings}
        onChatStyleSettingsChange={setChatStyleSettings}
        userPoints={userPoints}
      />

      {lightboxImage && (
        <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}

