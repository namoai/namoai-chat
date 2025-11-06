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
// ▼▼▼【Stale State修正】`Turn`型は`switchModelMessage`のために引き続き必要です。▼▼▼
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

// ▼▼▼【画像タグパース】{img:N}タグと![](URL)を検出してimageUrlsに変換 ▼▼▼
function parseImageTags(text: string, characterImages: CharacterImageInfo[]): { 
  cleanText: string; 
  imageUrls: string[];
} {
  const imageUrls: string[] = [];
  
  // 1. {img:N} 形式をパース
  const imgTagRegex = /\{img:(\d+)\}/g;
  let cleanText = text.replace(imgTagRegex, (match, indexStr) => {
    const index = parseInt(indexStr, 10) - 1; // 1-indexed to 0-indexed
    const nonMainImages = characterImages.filter(img => !img.isMain);
    
    if (index >= 0 && index < nonMainImages.length) {
      imageUrls.push(nonMainImages[index].imageUrl);
      console.log(`📸 画像タグ検出: {img:${indexStr}} -> ${nonMainImages[index].imageUrl}`);
    } else {
      console.warn(`⚠️ 無効な画像インデックス: {img:${indexStr}}`);
    }
    
    return ''; // タグを削除
  });
  
  // 2. ![](URL) 形式（Markdown）をパース
  const markdownImgRegex = /!\[\]\((https?:\/\/[^\s)]+)\)/g;
  cleanText = cleanText.replace(markdownImgRegex, (match, url) => {
    imageUrls.push(url);
    console.log(`📸 Markdown画像検出: ![](${url})`);
    return ''; // タグを削除
  });
  
  // 3. ![alt](URL) 形式もサポート
  const markdownImgWithAltRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  cleanText = cleanText.replace(markdownImgWithAltRegex, (match, alt, url) => {
    imageUrls.push(url);
    console.log(`📸 Markdown画像検出: ![${alt}](${url})`);
    return ''; // タグを削除
  });
  
  return { cleanText, imageUrls };
}
// ▲▲▲

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
  // ▼▼▼【Stale State修正】 `turns` stateは`switchModelMessage`のために維持します。
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const hasReceivedResponseRef = useRef(false);
  const tempUserMessageIdRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const finalTurnIdRef = useRef<number | null>(null);

  // ▼▼▼【Stale State修正】`turns` stateは`rawMessages`が変更されるたびに更新されます。
  // この`turns` stateは`switchModelMessage` (回答の切り替え) 機能でのみ使用されます。
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

  // 最下部へスクロールする関数（より強力な方法）
  const scrollToBottom = useCallback(() => {
    // 複数の方法を試行して確実にスクロール
    const attemptScroll = () => {
      // 方法1: main要素のscrollTopを直接設定（最優先）
      if (mainScrollRef.current) {
        const scrollContainer = mainScrollRef.current;
        // 매우 큰 값으로 설정하여 확실히 최하단으로 이동
        scrollContainer.scrollTop = 999999999;
        // scrollHeight가 변경될 수 있으므로 최신 값으로 계산
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        scrollContainer.scrollTop = maxScroll;
        // 추가로 scrollTop을 직접 설정
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        // 한 번 더
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }, 0);
      }
      
      // 方法2: window.scrollTo도 사용
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      
      // 方法3: messagesEndRefを使用
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
        // 여러 번 시도
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
        }, 0);
      }
    };
    
    // 즉시 시도
    attemptScroll();
    
    // 여러 번 시도 (DOM 렌더링 완료 대기)
    requestAnimationFrame(() => {
      attemptScroll();
      requestAnimationFrame(() => {
        attemptScroll();
        setTimeout(() => {
          attemptScroll();
          setTimeout(() => {
            attemptScroll();
            setTimeout(() => {
              attemptScroll();
              // 최종 시도
              setTimeout(() => {
                attemptScroll();
              }, 1000);
            }, 500);
          }, 300);
        }, 100);
      });
    });
  }, []);

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
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || `HTTP ${res.status}: チャットセッション取得失敗`);
            }
            
            const data = await res.json();
            
            if (!data || typeof data.id !== 'number') {
                throw new Error("無効なレスポンスデータ");
            }
            
            setChatId(data.id);
            setUserNote(data.userNote || "");
            // メッセージをロード時に画像を再パース（新規作成時と同じ順序を保証）
            const characterImages = characterInfo?.characterImages || [];
            const formattedMessages = (data.chat_message || []).map((msg: DbMessage) => {
              // モデルメッセージの場合、画像タグを検出してimageUrlsを設定（contentはそのまま保持）
              if (msg.role === 'model' && msg.content) {
                // DB에 저장된 content에는 이미지 태그가 남아있으므로, ChatMessageParser가 직접 파싱할 수 있음
                // imageUrls는 참고용으로만 추출 (실제 표시는 ChatMessageParser가 content에서 직접 처리)
                const { imageUrls } = parseImageTags(msg.content, characterImages);
                return {
                  ...msg,
                  timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                  imageUrls: imageUrls || [], // 画像URLを設定（参考用、実際の表示はChatMessageParserがcontentから直接処理）
                };
              }
              return {
                ...msg,
                timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                imageUrls: [], // ユーザーメッセージは画像なし
              };
            });
            // 브라우저 새로고침 시 완성된 메시지를 바로 표시 (스트리밍 효과 없음)
            setRawMessages(formattedMessages);
            
            // ▼▼▼【新規追加】새로고침 시 자동 요약 트리거 (autoSummarize가 true인 경우) ▼▼▼
            if (data.autoSummarize !== false && formattedMessages.length >= 2) {
              // 비동기로 요약 실행 (블로킹하지 않음)
              (async () => {
                try {
                  // 백메모리 자동 요약
                  await fetch(`/api/chat/${data.id}/back-memory`, {
                    method: 'POST',
                  }).catch(err => console.error('백메모리 자동 요약 에러:', err));
                  
                  // 상세기억 자동 요약 (재요약)
                  await fetch(`/api/chat/${data.id}/detailed-memories`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ autoSummarize: true }),
                  }).catch(err => console.error('상세기억 자동 요약 에러:', err));
                  
                  console.log('새로고침 시 자동 요약 트리거 완료');
                } catch (error) {
                  console.error('자동 요약 트리거 에러:', error);
                }
              })();
            }
            // ▲▲▲
            
            // ▼▼▼【강제 스크롤】로드 완료 후 즉시 최하단으로 스크롤 ▼▼▼
            setTimeout(() => {
              scrollToBottom();
              setTimeout(() => {
                scrollToBottom();
                setTimeout(() => {
                  scrollToBottom();
                }, 500);
              }, 300);
            }, 100);
            // ▲▲▲
        } catch (e) {
            console.error("チャット読込エラー:", e);
            const errorMessage = e instanceof Error ? e.message : "チャット読込失敗";
            setModalState({ 
                isOpen: true, 
                title: "エラー", 
                message: errorMessage, 
                onConfirm: () => router.back() 
            });
        } finally {
            setIsInitialLoading(false);
            // ▼▼▼【강제 스크롤】로딩 완료 후에도 스크롤 ▼▼▼
            setTimeout(() => {
              scrollToBottom();
              setTimeout(() => {
                scrollToBottom();
              }, 500);
            }, 200);
            // ▲▲▲
        }
    };
    loadChatSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, searchParams, router, scrollToBottom]);

  // チャットルームに入った時、メッセージ追加時、新規ロード時に確実に最下部へスクロール
  useEffect(() => {
    if (isInitialLoading || rawMessages.length === 0) return;
    
    const scrollAfterRender = () => {
      // 매우 강력한 스크롤 시도
      if (mainScrollRef.current) {
        const container = mainScrollRef.current;
        container.scrollTop = 999999999;
        container.scrollTop = container.scrollHeight;
      }
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
      }
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      scrollToBottom();
    };
    
    // 즉시 시도
    scrollAfterRender();
    
    // 추가 지연으로 재시도 (더 많은 시도)
    const timer1 = setTimeout(scrollAfterRender, 50);
    const timer2 = setTimeout(scrollAfterRender, 100);
    const timer3 = setTimeout(scrollAfterRender, 200);
    const timer4 = setTimeout(scrollAfterRender, 300);
    const timer5 = setTimeout(scrollAfterRender, 500);
    const timer6 = setTimeout(scrollAfterRender, 1000);
    const timer7 = setTimeout(scrollAfterRender, 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
      clearTimeout(timer7);
    };
  }, [rawMessages.length, isInitialLoading, scrollToBottom, regeneratingTurnId]);

  // ▼▼▼【タイムアウト対策】タイムアウト時の復旧処理：DBからメッセージを再読み込み ▼▼▼
  const handleTimeoutRecovery = async () => {
    if (!chatId) return;
    try {
      console.log("タイムアウト復旧: DBからメッセージを再読み込み中...");
      const response = await fetch(`/api/chat/messages?chatId=${chatId}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        const messages = data.messages.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        }));
        setRawMessages(messages);
        setModalState({ 
          isOpen: true, 
          title: "接続タイムアウト", 
          message: "接続がタイムアウトしましたが、保存されたメッセージを表示しました。", 
          isAlert: true 
        });
      }
    } catch (e) {
      console.error("タイムアウト復旧エラー:", e);
      setModalState({ 
        isOpen: true, 
        title: "エラー", 
        message: "タイムアウト後にメッセージの復旧に失敗しました。ページをリロードしてください。", 
        isAlert: true 
      });
    }
  };
  // ▲▲▲

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;

    setIsLoading(true);
    const messageToSend = input;
    setInput("");
    finalTurnIdRef.current = null;
    hasReceivedResponseRef.current = false;

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
    tempUserMessageIdRef.current = tempUserMessageId;
    hasReceivedResponseRef.current = false;
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
    
    // ▼▼▼【タイムアウト対策】タイムアウト監視用の変数を先に宣言 ▼▼▼
    let timeoutCheckInterval: NodeJS.Timeout | null = null;
    // ▲▲▲

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
        
        // ▼▼▼【タイムアウト対策】タイムアウト監視とハートビート処理 ▼▼▼
        let lastHeartbeatTime = Date.now();
        let hasReceivedData = false;
        const timeoutDuration = 30000; // 30秒タイムアウト
        
        timeoutCheckInterval = setInterval(() => {
          const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;
          if (timeSinceLastHeartbeat > timeoutDuration && !hasReceivedData) {
            console.warn("タイムアウト: 30秒以内にデータを受信できませんでした");
            if (timeoutCheckInterval) {
              clearInterval(timeoutCheckInterval);
            }
            reader.cancel(); // リーダーをキャンセル
            // タイムアウト時はDBからメッセージを再読み込み
            handleTimeoutRecovery();
          }
        }, 5000); // 5秒ごとにチェック
        // ▲▲▲

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
              if (timeoutCheckInterval) {
                clearInterval(timeoutCheckInterval);
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                // ▼▼▼【タイムアウト対策】event: 行を処理 ▼▼▼
                if (line.startsWith("event: ")) {
                  const eventType = line.substring(7).trim();
                  if (eventType === "heartbeat") {
                    lastHeartbeatTime = Date.now();
                    continue;
                  }
                }
                // ▲▲▲
                
                if (!line.startsWith("data: ")) continue;
                
                const dataStr = line.substring(6);
                if (!dataStr.trim()) continue;

                try {
                    const eventData = JSON.parse(dataStr);
                    
                    // ▼▼▼【タイムアウト対策】ハートビートイベント処理 ▼▼▼
                    if (eventData.timestamp && Object.keys(eventData).length === 1) {
                      // heartbeatイベント（timestampのみ）
                      lastHeartbeatTime = Date.now();
                      continue;
                    }
                    // ▲▲▲

                    if (eventData.userMessage) {
                        hasReceivedData = true;
                        lastHeartbeatTime = Date.now();
                        const realUserMessage = {
                            ...eventData.userMessage,
                            timestamp: new Date(eventData.userMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                        };
                        finalTurnIdRef.current = realUserMessage.turnId;
                        setRawMessages(prev => prev.map(msg => msg.id === tempUserMessageId ? realUserMessage : msg));
                    } else if (eventData.responseChunk) {
                        hasReceivedData = true;
                        hasReceivedResponseRef.current = true; // 応答が開始された
                        lastHeartbeatTime = Date.now();
                        // ▼▼▼【画像タグパース】{img:N}をimageUrlsに変換 ▼▼▼
                        const characterImages = characterInfo?.characterImages || [];
                        console.log(`📸 画像パース: characterImages.length=${characterImages.length}, responseChunk length=${eventData.responseChunk?.length || 0}`);
                        const { cleanText, imageUrls: newImageUrls } = parseImageTags(eventData.responseChunk, characterImages);
                        if (newImageUrls.length > 0) {
                          console.log(`📸 画像検出: ${newImageUrls.length}件の画像が見つかりました`, newImageUrls);
                        }
                        // ▲▲▲
                        
                        if (!tempModelMessageId) {
                            tempModelMessageId = Date.now() + 1;
                            const turnIdForModel = finalTurnIdRef.current || tempUserMessageId;
                            const newModelMessage: Message = {
                                id: tempModelMessageId,
                                role: 'model',
                                content: cleanText,
                                createdAt: new Date().toISOString(),
                                turnId: turnIdForModel,
                                version: 1,
                                isActive: true,
                                timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                                imageUrls: newImageUrls, // タグから抽出した画像
                            };
                            setRawMessages(prev => [...prev, newModelMessage]);
                        } else {
                            setRawMessages(prev => prev.map(msg =>
                                msg.id === tempModelMessageId
                                    ? { 
                                        ...msg, 
                                        content: msg.content + cleanText,
                                        imageUrls: [...(msg.imageUrls || []), ...newImageUrls]
                                      }
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
        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
        }
        await fetchUserPoints();
        hasReceivedResponseRef.current = true; // 正常完了
    } catch (error) {
        if (timeoutCheckInterval) {
          clearInterval(timeoutCheckInterval);
        }
        // ▼▼▼【タイムアウト対策】エラー時もDBからメッセージを再読み込みを試みる ▼▼▼
        if ((error as Error).name === 'AbortError' || (error as Error).message.includes('timeout')) {
          handleTimeoutRecovery();
        } else {
          // 応答が開始されていない場合はメッセージ削除とポイント返金
          if (!hasReceivedResponseRef.current && tempUserMessageIdRef.current) {
            try {
              await fetch(`/api/chat/${chatId}/cancel?turnId=${tempUserMessageIdRef.current}&refund=true`, {
                method: 'POST',
              });
            } catch (cancelError) {
              console.error('キャンセル処理エラー:', cancelError);
            }
          }
          setRawMessages(prev => prev.filter(msg => msg.id !== tempUserMessageId && msg.id !== tempModelMessageId));
          setModalState({ isOpen: true, title: "送信エラー", message: (error as Error).message, isAlert: true });
        }
        // ▲▲▲
    } finally {
        setIsLoading(false);
        hasReceivedResponseRef.current = false;
        tempUserMessageIdRef.current = null;
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

  // ▼▼▼【修正】新しい再生成ロジック：ストリーミング対応 ▼▼▼
  const handleRegenerate = async (turnId: number) => {
     if (isLoading || !chatId) return;
    setIsLoading(true);
    setRegeneratingTurnId(turnId); // ローディング表示のために再生成中のターンIDを設定
    
    let tempModelMessageId: number | null = null;
    
    try {
        // ▼▼▼【修正】現在閲覧中のバージョン情報を収集（一般チャットと同じ） ▼▼▼
        const activeVersions: { [turnId: number]: number } = {};
        turns.forEach(turn => {
            if (turn.modelMessages.length > 0) {
                const activeMsg = turn.modelMessages[turn.activeModelIndex];
                if (activeMsg) {
                    activeVersions[turn.turnId] = activeMsg.id;
                }
            }
        });
        // ▲▲▲
        
        const res = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, turnId: turnId, settings: generationSettings, activeVersions }),
        });
        if (!res.ok) {
          const errorData = await safeParseJSON<{ error?: string; message?: string }>(res);
          throw new Error(errorData?.error || errorData?.message || `HTTP ${res.status}: 再生成に失敗しました`);
        }

        if (!res.body) {
            throw new Error("レスポンスボディがありません。");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                // イベントタイプを確認（一般チャットと同じ形式）
                if (line.startsWith("event: ")) {
                    // ai-updateイベントは次のdata行で処理
                    continue;
                }
                
                if (!line.startsWith("data: ")) continue;
                
                const dataStr = line.substring(6);
                if (!dataStr.trim()) continue;

                try {
                    const eventData = JSON.parse(dataStr);
                    
                    if (eventData.responseChunk) {
                        // ▼▼▼【画像タグパース】{img:N}をimageUrlsに変換 ▼▼▼
                        const characterImages = characterInfo?.characterImages || [];
                        const { cleanText, imageUrls: newImageUrls } = parseImageTags(eventData.responseChunk, characterImages);
                        // ▲▲▲
                        
                        if (!tempModelMessageId) {
                            tempModelMessageId = Date.now() + 1;
                            const newModelMessage: Message = {
                                id: tempModelMessageId,
                                role: 'model',
                                content: cleanText,
                                createdAt: new Date().toISOString(),
                                turnId: turnId,
                                version: 1,
                                isActive: true,
                                timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                                imageUrls: newImageUrls,
                            };
                            setRawMessages(prev => {
                                // 既存のモデルメッセージを非アクティブ化
                                const updated = prev.map(m => {
                                    if (m.turnId === turnId && m.role === 'model') {
                                        return { ...m, isActive: false };
                                    }
                                    return m;
                                });
                                return [...updated, newModelMessage];
                            });
                        } else {
                            setRawMessages(prev => prev.map(msg =>
                                msg.id === tempModelMessageId
                                    ? { 
                                        ...msg, 
                                        content: msg.content + cleanText,
                                        imageUrls: [...new Set([...(msg.imageUrls || []), ...newImageUrls])] // 重複を除去
                                      }
                                    : msg
                            ));
                        }
                    } else if (eventData.modelMessage) {
                        // 最終メッセージで更新（ストリーミング中に収集した画像URLを保持）
                        setRawMessages(prev => prev.map(m => {
                            if (m.id === tempModelMessageId) {
                                // ストリーミング中に収集した画像URLを保持（重複除去）
                                const existingImageUrls = m.imageUrls || [];
                                const serverImageUrls = eventData.modelMessage.imageUrls || [];
                                const allImageUrls = [...new Set([...existingImageUrls, ...serverImageUrls])];
                                
                                return {
                                    ...eventData.modelMessage,
                                    timestamp: new Date(eventData.modelMessage.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                                    imageUrls: allImageUrls,
                                };
                            }
                            return m;
                        }));
                    } else if (eventData.error) {
                        throw new Error(eventData.error);
                    }
                } catch (e) {
                    console.error("JSON解析エラー:", dataStr, e);
                }
            }
        }
    } catch (error) {
        setModalState({ isOpen: true, title: "エラー", message: (error as Error).message, isAlert: true });
    } finally {
        setIsLoading(false);
        setRegeneratingTurnId(null);
    }
  };
  // ▲▲▲ 修正ここまで ▲▲▲

  const switchModelMessage = (turnId: number, direction: "next" | "prev") => {
    // `turns` stateは`switchModelMessage`のためにここで使用されます。
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

      <main 
        ref={(el) => {
          if (el) {
            mainScrollRef.current = el as HTMLDivElement;
            // ref가 설정되면 즉시 최하단으로 스크롤
            setTimeout(() => {
              el.scrollTop = el.scrollHeight;
              el.scrollTop = 999999999;
            }, 0);
            setTimeout(() => {
              el.scrollTop = el.scrollHeight;
            }, 100);
            setTimeout(() => {
              el.scrollTop = el.scrollHeight;
            }, 500);
          } else {
            mainScrollRef.current = null;
          }
        }}
        className="flex-1 overflow-y-auto p-4 space-y-6 pb-24"
        style={{ scrollBehavior: 'auto' }}
      >
        <ChatMessageList
          characterInfo={characterInfo}
          rawMessages={rawMessages} // ▼▼▼【Stale State修正】 `rawMessages`のみを渡します。
          // turns={turns} // ★★★【Stale State修正】このpropを削除します。 
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
          handleRegenerate={handleRegenerate} // ▼▼▼【Stale State修正】(turnId: number) シグネチャの関数を渡します ▼▼▼
          switchModelMessage={switchModelMessage}
          prioritizeImagesByKeyword={prioritizeImagesByKeyword}
          showChatImage={showChatImage}
          isMultiImage={isMultiImage}
          setLightboxImage={setLightboxImage}
        />
        <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} />
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

