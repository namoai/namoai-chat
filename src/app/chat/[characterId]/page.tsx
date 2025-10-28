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
// ▼▼▼【Stale State修正】`Turn` 타입은 `switchModelMessage`를 위해 여전히 필요합니다. ▼▼▼
import type { CharacterInfo, Message, Turn, ModalState, DbMessage, CharacterImageInfo } from '@/types/chat';

// --- ユーティリティ関数 ---

async function safeParseJSON<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    return await res.json() as T;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return null;
  }
}

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
  // ▼▼▼【Stale State修正】 `turns` state는 `switchModelMessage` 를 위해 유지합니다.
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingTurnId, setRegeneratingTurnId] = useState<number | null>(null); // 再生成中のターンIDを管理
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
  
  // ▼▼▼【ビルドエラー修正】setGenerationSettings を useState 宣言から完全に削除 ▼▼▼
  const [generationSettings] = useState<GenerationSettings>({ model: "gemini-2.5-flash" });
  
  const [chatStyleSettings, setChatStyleSettings] = useState<ChatStyleSettings>({ fontSize: 14, userBubbleColor: "#db2777", userBubbleTextColor: "#ffffff" });
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingUserContent, setEditingUserContent] = useState("");
  const [editingModelContent, setEditingModelContent] = useState("");
  const [isNewChatSession, setIsNewChatSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const finalTurnIdRef = useRef<number | null>(null);

  // ▼▼▼【Stale State修正】`turns` state는 `rawMessages` 가 변경될 때마다 갱신됩니다.
  // 이 `turns` state는 `switchModelMessage` (답변 넘겨보기) 기능에만 사용됩니다.
  useEffect(() => {
    const userMessages = rawMessages.filter(m => m.role === 'user');
    const modelMessages = rawMessages.filter(m => m.role === 'model');
    const newTurns = userMessages.map(userMsg => {
      const correspondingModels = modelMessages
        .filter(modelMsg => modelMsg.turnId === userMsg.turnId)
        .sort((a, b) => a.version - b.version);
      const activeModel = correspondingModels.find(m => m.isActive) || correspondingModels[correspondingModels.length - 1];
      return {
        turnId: userMsg.turnId as number,
        userMessage: userMsg,
        modelMessages: correspondingModels,
        activeModelIndex: activeModel ? correspondingModels.indexOf(activeModel) : -1,
      };
    }).filter(turn => turn.userMessage);
    setTurns(newTurns);
  }, [rawMessages]);
  // ▲▲▲ 修正ここまで ▲▲▲

  const fetchUserPoints = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const response = await fetch(`/api/points`);
      if (!response.ok) throw new Error("ポイント取得失敗");
      const data = await safeParseJSON<{ free_points?: number; paid_points?: number }>(response);
      setUserPoints((data?.free_points || 0) + (data?.paid_points || 0));
    } catch (error) {
      console.error(error);
    }
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


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;

    setIsLoading(true);
    const messageToSend = input;
    setInput("");
    finalTurnIdRef.current = null;

    // ▼▼▼【追加】ユーザーが現在閲覧している各ターンのバージョンを収集 ▼▼▼
    const activeVersions: { [turnId: number]: number } = {};
    turns.forEach(turn => {
        if (turn.modelMessages.length > 0) {
            const activeMsg = turn.modelMessages[turn.activeModelIndex];
            if (activeMsg) {
                activeVersions[turn.turnId] = activeMsg.id;
            }
        }
    });
    // ▲▲▲【追加完了】▲▲▲

    const tempUserMessageId = Date.now();
    const tempUserMessage: Message = {
      id: tempUserMessageId,
      role: 'user',
      content: messageToSend,
      createdAt: new Date().toISOString(),
      turnId: tempUserMessageId,
      version: 1,
      isActive: true,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };
    setRawMessages(prev => [...prev, tempUserMessage]);

    let tempModelMessageId: number | null = null;

    try {
        const response = await fetch(`/api/chat/${chatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: messageToSend, 
                settings: generationSettings,
                activeVersions: activeVersions  // ←現在閲覧中のバージョン情報を追加
            }),
        });

        if (!response.ok) {
            const errorData = await safeParseJSON<{ message?: string }>(response);
            throw new Error(errorData?.message || 'APIエラーが発生しました。');
        }

        if (!response.body) {
            throw new Error("レスポンスボディがありません。");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                
                const dataStr = line.substring(6);
                if (!dataStr.trim()) continue;

                try {
                    const eventData = JSON.parse(dataStr);

                    if (eventData.userMessage) {
                        const realUserMessage = {
                            ...eventData.userMessage,
                            timestamp: new Date(eventData.userMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                        };
                        finalTurnIdRef.current = realUserMessage.turnId;
                        setRawMessages(prev => prev.map(msg => msg.id === tempUserMessageId ? realUserMessage : msg));
                    } else if (eventData.responseChunk) {
                        if (!tempModelMessageId) {
                            tempModelMessageId = Date.now() + 1;
                            const turnIdForModel = finalTurnIdRef.current || tempUserMessageId;
                            const newModelMessage: Message = {
                                id: tempModelMessageId,
                                role: 'model',
                                content: eventData.responseChunk,
                                createdAt: new Date().toISOString(),
                                turnId: turnIdForModel,
                                version: 1,
                                isActive: true,
                                timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                            };
                            setRawMessages(prev => [...prev, newModelMessage]);
                        } else {
                            setRawMessages(prev => prev.map(msg =>
                                msg.id === tempModelMessageId
                                    ? { ...msg, content: msg.content + eventData.responseChunk }
                                    : msg
                            ));
                        }
                    } else if (eventData.modelMessage) {
                        setRawMessages(prev => prev.map(msg =>
                            msg.id === tempModelMessageId
                                ? { ...eventData.modelMessage, timestamp: new Date(eventData.modelMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) }
                                : msg
                        ));
                    }
                } catch (e) {
                    console.error("JSON解析エラー:", dataStr, e);
                }
            }
        }
        await fetchUserPoints();
    } catch (error) {
        setRawMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId && msg.id !== tempModelMessageId));
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
        setRawMessages(rawMessages.map(m => m.id === editingMessageId ? { ...m, content: originalContent } : m));
        setModalState({ isOpen: true, title: "編集エラー", message: "メッセージの更新に失敗しました。", isAlert: true });
    }
  };

  const handleDelete = (messageId: number) => {
    const message = rawMessages.find(m => m.id === messageId);
    if (!message) return;

    // ユーザーメッセージの場合は、そのターン全体を削除
    // AIメッセージの場合は、そのバージョンのみを削除
    const isUserMessage = message.role === 'user';
    const turnId = message.turnId;
    
    setModalState({
        isOpen: true,
        title: "削除の確認",
        message: isUserMessage 
            ? "このメッセージと関連する全ての応答を削除しますか？" 
            : "この応答バージョンを削除しますか？",
        confirmText: "削除",
        onConfirm: async () => {
            const originalMessages = [...rawMessages];
            
            // 楽観的UI更新：ユーザーメッセージならターン全体、AIメッセージなら該当メッセージのみ
            if (isUserMessage) {
                setRawMessages(prev => prev.filter(m => m.turnId !== turnId));
            } else {
                setRawMessages(prev => prev.filter(m => m.id !== messageId));
            }

            try {
                await fetch('/api/chat/messages', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId }),
                });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_error) {
                setRawMessages(originalMessages);
                setModalState({ isOpen: true, title: "削除エラー", message: "削除に失敗しました。", isAlert: true });
            }
        },
    });
  };

  // ▼▼▼【修正】新しい再生成ロジック：全てのバージョンを保持 ▼▼▼
  const handleRegenerate = async (turnId: number) => {
     if (isLoading || !chatId) return;
    setIsLoading(true);
    setRegeneratingTurnId(turnId); // ローディング表示のために再生成中のターンIDを設定
    try {
        const res = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, turnId: turnId, settings: generationSettings }),
        });
        if (!res.ok) throw new Error("再生成に失敗しました");
        const data = await res.json();
        const newMessage = {
            ...data.newMessage,
            timestamp: new Date(data.newMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        };
        // 新しいバージョンを追加（isActive状態は変更しない - 全てのバージョンを保持）
        setRawMessages(prev => [...prev, newMessage]);
        
        // 最新バージョンを自動的に表示するためにisActiveを設定
        setRawMessages(prev => prev.map(m => {
            if (m.turnId === turnId && m.role === 'model') {
                return { ...m, isActive: m.id === newMessage.id };
            }
            return m;
        }));
    } catch (error) {
        setModalState({ isOpen: true, title: "エラー", message: (error as Error).message, isAlert: true });
    } finally {
        setIsLoading(false);
        setRegeneratingTurnId(null);
    }
  };
  // ▲▲▲ 修正ここまで ▲▲▲

  const switchModelMessage = (turnId: number, direction: "next" | "prev") => {
    // `turns` state는 `switchModelMessage` 를 위해 여기서 사용됩니다.
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
          rawMessages={rawMessages} // ▼▼▼【Stale State修正】 `rawMessages` 만을 전달합니다.
          // turns={turns} // ★★★【Stale State修正】이 prop을 제거합니다. 
          isLoading={isLoading}
          regeneratingTurnId={regeneratingTurnId}
          editingMessageId={editingMessageId}
          editingUserContent={editingUserContent}
          editingModelContent={editingModelContent}
          setEditingUserContent={setEditingUserContent}
          setEditingModelContent={setEditingModelContent}

          handleEditStart={handleEditStart}
          handleEditSave={handleEditSave}
          handleEditCancel={() => setEditingMessageId(null)}
          handleDelete={handleDelete}
          handleRegenerate={handleRegenerate} // ▼▼▼【Stale State修正】(turnId: number) 시그니처의 함수를 전달합니다 ▼▼▼
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
        onSaveNote={async (note) => { console.log(note) }}
        characterId={characterId}
        chatId={chatId}
        // ▼▼▼【修正】ブースト関連のpropsを削除します ▼▼▼
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

