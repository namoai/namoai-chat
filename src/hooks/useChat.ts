import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CharacterInfo, Message, Turn, ModalState, DbMessage, GenerationSettings, ChatStyleSettings, CharacterImageInfo } from '@/types/chat';

// ==================================
// ユーティリティ関数
// ==================================

async function safeParseJSON<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    return await res.json() as T;
  } catch (_error) {
    return null;
  }
}

const prioritizeImagesByKeyword = (userText: string, allImages: CharacterImageInfo[]): CharacterImageInfo[] => {
  if (!allImages || allImages.length <= 1) return [];
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

type ThinkingParserState = {
  inThinking: boolean;
  buffer: string;
};

const OPEN_TAGS = ["<thinking>", "<reasoning>", "<ctrl3347>", "<scratchpad>"];
const CLOSE_TAGS = ["</thinking>", "</reasoning>", "<ctrl3348>", "</scratchpad>"];

function splitThinkingFromChunk(chunk: string, st: ThinkingParserState): { thinkingDelta: string; visibleDelta: string } {
  st.buffer += chunk;
  let outThinking = "";
  let outVisible = "";

  while (true) {
    if (!st.inThinking) {
      let firstOpenIdx = -1;
      let openLen = 0;
      for (const tag of OPEN_TAGS) {
        const idx = st.buffer.indexOf(tag);
        if (idx !== -1 && (firstOpenIdx === -1 || idx < firstOpenIdx)) {
          firstOpenIdx = idx;
          openLen = tag.length;
        }
      }
      if (firstOpenIdx === -1) {
        outVisible += st.buffer;
        st.buffer = "";
        break;
      } else {
        outVisible += st.buffer.slice(0, firstOpenIdx);
        st.buffer = st.buffer.slice(firstOpenIdx + openLen);
        st.inThinking = true;
      }
    } else {
      let firstCloseIdx = -1;
      let closeLen = 0;
      for (const tag of CLOSE_TAGS) {
        const idx = st.buffer.indexOf(tag);
        if (idx !== -1 && (firstCloseIdx === -1 || idx < firstCloseIdx)) {
          firstCloseIdx = idx;
          closeLen = tag.length;
        }
      }
      if (firstCloseIdx === -1) {
        outThinking += st.buffer;
        st.buffer = "";
        break;
      } else {
        outThinking += st.buffer.slice(0, firstCloseIdx);
        st.buffer = st.buffer.slice(firstCloseIdx + closeLen);
        st.inThinking = false;
      }
    }
  }
  return { thinkingDelta: outThinking, visibleDelta: outVisible };
}


// ==================================
// チャットロジックのカスタムフック
// ==================================

export const useChat = () => {
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
  const tempModelMessageIdRef = useRef<number | null>(null);
  const thinkingStateRef = useRef<ThinkingParserState>({ inThinking: false, buffer: "" });

  // --- データ処理 Effect ---
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

  // --- 初期化 Effect ---
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
  }, [turns]);

  // --- ストリーム処理 ---
  const processStreamRequest = async ({ message, isRegeneration, turn }: { message: string, isRegeneration: boolean, turn?: Turn }) => {
      setIsLoading(true);
      thinkingStateRef.current = { inThinking: false, buffer: "" };
      const tempId = Date.now();
      tempModelMessageIdRef.current = tempId;

      const tempModelMessage: Message = {
          id: tempId,
          role: 'model',
          content: '',
          createdAt: new Date().toISOString(),
          turnId: turn?.turnId!,
          version: turn ? (turn.modelMessages.length || 0) + 1 : 1,
          isActive: true,
          timestamp: '...',
          thinkingText: '',
      };

      if (isRegeneration && turn) {
          setRawMessages(prev => [
              ...prev.map(msg => msg.turnId === turn.turnId && msg.role === 'model' ? { ...msg, isActive: false } : msg),
              tempModelMessage,
          ]);
      }
  
      try {
          const response = await fetch(`/api/chat/${chatId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  message, 
                  settings: generationSettings,
                  isRegeneration,
                  turnId: isRegeneration ? turn?.turnId : undefined,
              }),
          });
  
          if (!response.ok || !response.body) {
              const errorData = await safeParseJSON<{ message?: string }>(response);
              throw new Error(errorData?.message || 'APIエラーが発生しました。');
          }
  
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
  
          const processEvent = (eventString: string) => {
              if (!eventString.trim()) return;
              const eventLine = eventString.split('\n').find(line => line.startsWith('event: '));
              const dataLine = eventString.split('\n').find(line => line.startsWith('data: '));
              if (!eventLine || !dataLine) return;
  
              const eventType = eventLine.substring(7);
              const data = JSON.parse(dataLine.substring(6));
  
              if (eventType === 'user-message-saved') {
                  const savedUserMessage = { ...data.userMessage, timestamp: new Date(data.userMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) };
                  setRawMessages(prev => [...prev, savedUserMessage, { ...tempModelMessage, turnId: savedUserMessage.id }]);
              } else if (eventType === 'ai-update') {
                  const { thinkingDelta, visibleDelta } = splitThinkingFromChunk(data.chunk || '', thinkingStateRef.current);
                  if (thinkingDelta || visibleDelta) {
                      setRawMessages(prev => prev.map(msg => {
                          if (msg.id === tempId) {
                              return {
                                  ...msg,
                                  thinkingText: (msg.thinkingText || '') + thinkingDelta,
                                  content: msg.content + visibleDelta,
                              };
                          }
                          return msg;
                      }));
                  }
              } else if (eventType === 'ai-message-saved') {
                  const saved = { ...data.modelMessage, timestamp: new Date(data.modelMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) };
                  setRawMessages(prev => prev.map(msg => msg.id === tempId ? { ...saved, thinkingText: msg.thinkingText } : msg));
                  tempModelMessageIdRef.current = saved.id;
              } else if (eventType === 'stream-end') {
                  if (tempModelMessageIdRef.current) {
                      setRawMessages(prev => prev.map(msg => msg.id === tempModelMessageIdRef.current ? { ...msg, thinkingText: '' } : msg));
                  }
                  fetchUserPoints();
                  setIsLoading(false);
              } else if (eventType === 'error') {
                  throw new Error(data.message);
              }
          };
          
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              let boundary = buffer.indexOf('\n\n');
              while (boundary > -1) {
                  const eventText = buffer.substring(0, boundary);
                  buffer = buffer.substring(boundary + 2);
                  processEvent(eventText);
                  boundary = buffer.indexOf('\n\n');
              }
          }
      } catch (error) {
          console.error("ストリーム処理エラー:", error);
          setModalState({ isOpen: true, title: "エラー", message: (error as Error).message, isAlert: true });
          setRawMessages(prev => prev.filter(msg => msg.id !== tempModelMessageIdRef.current && msg.id !== tempId));
          setIsLoading(false);
      }
  };

  // --- イベントハンドラ ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;
    const messageToSend = input;
    setInput("");
    await processStreamRequest({ message: messageToSend, isRegeneration: false });
  };
  
  const handleRegenerate = async (turn: Turn) => {
    if (isLoading || !chatId) return;
    await processStreamRequest({
        message: turn.userMessage.content,
        isRegeneration: true,
        turn,
    });
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
    } catch (_error) {
        setRawMessages(rawMessages.map(m => m.id === editingMessageId ? { ...m, content: originalContent } : m));
        setModalState({ isOpen: true, title: "編集エラー", message: "メッセージの更新に失敗しました。", isAlert: true });
    }
  };

  const handleDelete = (messageId: number) => {
    const message = rawMessages.find(m => m.id === messageId);
    if (!message) return;
    setModalState({
        isOpen: true,
        title: "削除の確認",
        message: "このメッセージと以降のやり取りを削除しますか？",
        confirmText: "削除",
        onConfirm: async () => {
            const originalMessages = [...rawMessages];
            const turnIdToDelete = message.role === 'user' ? message.id : message.turnId;
            setRawMessages(prev => prev.filter(m => m.turnId !== turnIdToDelete && m.id !== turnIdToDelete));
            try {
                await fetch('/api/chat/messages', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId }),
                });
            } catch (_error) {
                setRawMessages(originalMessages);
                setModalState({ isOpen: true, title: "削除エラー", message: "削除に失敗しました。", isAlert: true });
            }
        },
    });
  };

  const switchModelMessage = (turnId: number, direction: "next" | "prev") => {
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

  // --- UIコンポーネントに渡す値 ---
  return {
    // State
    router, characterId, chatId,
    rawMessages, turns, input, isLoading, characterInfo, isInitialLoading,
    isSettingsOpen, showChatImage, isMultiImage, userNote, lightboxImage,
    modalState, userPoints, generationSettings, chatStyleSettings,
    editingMessageId, editingUserContent, editingModelContent, isNewChatSession,
    // Refs
    messagesEndRef, textareaRef,
    // State Setters
    setInput, setRawMessages, setTurns, setIsLoading, setCharacterInfo,
    setChatId, setIsInitialLoading, setIsSettingsOpen, setShowChatImage,
    setIsMultiImage, setUserNote, setLightboxImage, setModalState,
    setUserPoints, setGenerationSettings, setChatStyleSettings,
    setEditingMessageId, setEditingUserContent, setEditingModelContent,
    setIsNewChatSession,
    // Handlers
    handleSendMessage, handleRegenerate, handleEditStart, handleEditSave,
    handleDelete, switchModelMessage, wrapSelection,
    // Utilities
    prioritizeImagesByKeyword
  };
};

