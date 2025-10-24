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
// ▼▼▼【Stale State修正】`Turn` タイプは `switchModelMessage` のために保持します。▼▼▼
import type { CharacterInfo, Message, Turn, ModalState, DbMessage, CharacterImageInfo } from "@/types/chat";

// --- ユーティリティ関数 ---

async function safeParseJSON<T>(res: Response): Promise<T | null> {
  if (res.status === 204) return null;
  try {
    return (await res.json()) as T;
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
  images.forEach((img) => {
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
  // ▼▼▼【Stale State修正】 `turns` stateは `switchModelMessage` のみで使用します。▼▼▼
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

  // ▼▼▼【ビルドエラー修正】 setGenerationSettings は不要なので useState の setter を持たない ▼▼▼
  const [generationSettings] = useState<GenerationSettings>({ model: "gemini-2.5-pro" });

  const [chatStyleSettings, setChatStyleSettings] = useState<ChatStyleSettings>({
    fontSize: 14,
    userBubbleColor: "#db2777",
    userBubbleTextColor: "#ffffff",
  });
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingUserContent, setEditingUserContent] = useState("");
  const [editingModelContent, setEditingModelContent] = useState("");
  const [isNewChatSession, setIsNewChatSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ▼▼▼ ストリームと暫定ID管理のための参照 ▼▼▼
  const finalTurnIdRef = useRef<number | null>(null); // サーバー確定 turnId
  const tempModelMessageIdRef = useRef<number | null>(null); // クライアント側の暫定モデルID

  // ▼▼▼【Stale State修正】 rawMessages 変更時に turns を同期作成（switch 用）▼▼▼
  useEffect(() => {
    const userMessages = rawMessages.filter((m) => m.role === "user");
    const modelMessages = rawMessages.filter((m) => m.role === "model");
    const newTurns = userMessages
      .map((userMsg) => {
        const correspondingModels = modelMessages
          .filter((modelMsg) => modelMsg.turnId === userMsg.turnId)
          .sort((a, b) => a.version - b.version);
        const activeModel =
          correspondingModels.find((m) => m.isActive) || correspondingModels[correspondingModels.length - 1];
        return {
          turnId: userMsg.turnId as number,
          userMessage: userMsg,
          modelMessages: correspondingModels,
          activeModelIndex: activeModel ? correspondingModels.indexOf(activeModel) : -1,
        };
      })
      .filter((turn) => turn.userMessage);
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

  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);

  // ▼▼▼ キャラクター/チャット初期ロード（既存）▼▼▼
  useEffect(() => {
    if (!characterId) return;
    const loadCharacterInfo = async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}`);
        if (!res.ok) throw new Error("キャラクター情報取得失敗");
        setCharacterInfo(await res.json());
      } catch (e) {
        console.error(e);
        setModalState({
          isOpen: true,
          title: "エラー",
          message: "キャラクター情報読込失敗",
          onConfirm: () => router.back(),
        });
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
          timestamp: new Date(msg.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
        }));
        setRawMessages(formattedMessages);
        setIsNewChatSession(formattedMessages.length === 0);
      } catch (e) {
        console.error(e);
        setModalState({
          isOpen: true,
          title: "エラー",
          message: "チャット読込失敗",
          onConfirm: () => router.back(),
        });
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadChatSession();
  }, [characterId, searchParams, router]);

  // ▼▼▼ 新規メッセージ追加のたびにスクロール ▼▼▼
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawMessages]);

  // ============================================================
  // SSE パーサ（Netlify でのバッファリング/分割に強い実装）
  // - "event:" と "data:" をペアで解釈
  // - ": ping"（コメント行）は無視
  // - ブロック区切りは "\n\n"
  // ============================================================
  type SsePacket = { event?: string; data?: string };

  /** SSEテキストバッファから "event/data" の配列に分解 */
  const parseSSEBlocks = (buffer: string): SsePacket[] => {
    const packets: SsePacket[] = [];
    const blocks = buffer.split("\n\n"); // ブロック境界
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith(":")) {
        // コメント行（例: ": ping"）は無視
        continue;
      }
      let ev: string | undefined;
      let dt: string | undefined;
      for (const line of trimmed.split("\n")) {
        if (line.startsWith("event:")) {
          ev = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          // data: は複数行の可能性があるが、本実装では1行JSONを想定（サーバ側も1行JSON）
          const piece = line.slice(5).trim();
          dt = dt == null ? piece : dt + "\n" + piece;
        }
      }
      packets.push({ event: ev, data: dt });
    }
    return packets;
  };

  /** クライアント側：最後のモデルメッセージに追記 */
  const appendToLastModel = useCallback((turnId: number, chunk: string, tempModelId: number | null) => {
    setRawMessages((prev) => {
      // 既に暫定モデルIDがある場合はそれに追記、なければ turnId 末尾のモデルに追記
      if (tempModelId != null) {
        return prev.map((m) => (m.id === tempModelId ? { ...m, content: (m.content || "") + chunk } : m));
      }
      const next = [...prev];
      const indices = next
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === "model" && m.turnId === turnId)
        .map(({ i }) => i);
      if (indices.length === 0) return prev;
      const lastIndex = indices[indices.length - 1];
      next[lastIndex] = { ...next[lastIndex], content: (next[lastIndex].content || "") + chunk };
      return next;
    });
  }, []);

  // ============================================================
  // メッセージ送信（SSEストリーミング受信 & 逐次描画）
  // ============================================================
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatId) return;

    setIsLoading(true);
    const messageToSend = input;
    setInput("");
    finalTurnIdRef.current = null;
    tempModelMessageIdRef.current = null;

    // 1) 送信直後：ユーザー発言を即時描画（暫定 turnId は Date.now()）
    const tempUserMessageId = Date.now();
    const tempTurnId = tempUserMessageId;
    const tempUserMessage: Message = {
      id: tempUserMessageId,
      role: "user",
      content: messageToSend,
      createdAt: new Date().toISOString(),
      turnId: tempTurnId,
      version: 1,
      isActive: true,
      timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
    };
    setRawMessages((prev) => [...prev, tempUserMessage]);

    // 2) API 呼び出し（SSE）
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ▼▼▼ Netlify/CDNに SSE を明示（冪等ではないが Accept を示すことで挙動が安定）▼▼▼
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: messageToSend, settings: generationSettings }),
      });

      if (!response.ok) {
        const errorData = await safeParseJSON<{ message?: string }>(response);
        throw new Error(errorData?.message || "APIエラーが発生しました。");
      }
      if (!response.body) {
        throw new Error("レスポンスボディがありません。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = ""; // "\n\n" で区切るためのバッファ

      // 3) ストリーム読み取りループ
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // ブロック区切り（\n\n）で消費可能部分を抜き出す
        const lastSep = sseBuffer.lastIndexOf("\n\n");
        if (lastSep === -1) continue;

        const consumable = sseBuffer.slice(0, lastSep);
        sseBuffer = sseBuffer.slice(lastSep + 2);

        // "event/data" パケット配列を得る
        const packets = parseSSEBlocks(consumable);

        for (const pkt of packets) {
          const ev = pkt.event?.trim();
          const dt = pkt.data?.trim();

          // コメント or 不正ブロックはスキップ
          if (!ev && !dt) continue;

          // data は JSON 1行を想定
          let payload: any = null;
          if (dt) {
            try {
              payload = JSON.parse(dt);
            } catch (err) {
              // JSON でない data は無視（将来の拡張を邪魔しない）
              continue;
            }
          }

          // ------------------------------------------------
          // SSEイベント別ハンドリング（サーバとイベント名を一致）
          // ------------------------------------------------
          if (ev === "user-message-saved" && payload?.userMessage) {
            // サーバ確定 turnId を反映（暫定→確定へ置換）
            const realUser = payload.userMessage;
            finalTurnIdRef.current = realUser.turnId;
            setRawMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempUserMessageId
                  ? {
                      ...realUser,
                      timestamp: new Date(realUser.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    }
                  : msg
              )
            );
          } else if (ev === "regeneration-start" && payload?.turnId) {
            // 再生成時の開始通知（UI変更不要なのでスルー）
          } else if (ev === "ai-update" && payload?.responseChunk) {
            // ▼ 最初のチャンク受信時：モデル用の暫定メッセージを作成（空→追記）
            if (tempModelMessageIdRef.current == null) {
              tempModelMessageIdRef.current = Date.now() + 1;
              const turnIdForModel = finalTurnIdRef.current || tempTurnId;
              const newModelMessage: Message = {
                id: tempModelMessageIdRef.current,
                role: "model",
                content: payload.responseChunk,
                createdAt: new Date().toISOString(),
                turnId: turnIdForModel,
                version: 1,
                isActive: true,
                timestamp: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
              };
              setRawMessages((prev) => [...prev, newModelMessage]);
            } else {
              // ▼ 2個目以降のチャンクは末尾に追記
              const confirmedTurnId = (finalTurnIdRef.current || tempTurnId) as number;
              appendToLastModel(confirmedTurnId, payload.responseChunk, tempModelMessageIdRef.current);
            }
          } else if (ev === "ai-message-saved" && payload?.modelMessage) {
            // ▼ DB保存済みの最終メッセージで置換（タイムスタンプ整形）
            const saved = payload.modelMessage;
            setRawMessages((prev) =>
              prev.map((m) =>
                m.id === tempModelMessageIdRef.current
                  ? {
                      ...saved,
                      timestamp: new Date(saved.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    }
                  : m
              )
            );
          } else if (ev === "error" && payload?.message) {
            // ▼ ストリーム中エラー（UIに通知）
            setModalState({ isOpen: true, title: "送信エラー", message: payload.message, isAlert: true });
          } else if (ev === "stream-end") {
            // ▼ ストリーム終了（後処理は finally 側で isLoading を解除）
          }
        }
      }

      await fetchUserPoints();
    } catch (error) {
      // 失敗時は暫定で追加したメッセージを取り消し
      setRawMessages((prev) =>
        prev.filter((msg) => msg.id !== tempUserMessageId && msg.id !== tempModelMessageIdRef.current)
      );
      setModalState({ isOpen: true, title: "送信エラー", message: (error as Error).message, isAlert: true });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 編集/削除/再生成は既存処理を維持（最小変更） ---

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    if (message.role === "user") setEditingUserContent(message.content);
    else setEditingModelContent(message.content);
  };

  const handleEditSave = async () => {
    if (editingMessageId === null) return;
    const message = rawMessages.find((m) => m.id === editingMessageId);
    if (!message) return;
    const newContent = message.role === "user" ? editingUserContent : editingModelContent;

    const originalContent = message.content;
    setRawMessages(rawMessages.map((m) => (m.id === editingMessageId ? { ...m, content: newContent } : m)));
    setEditingMessageId(null);

    try {
      await fetch("/api/chat/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: editingMessageId, newContent }),
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      setRawMessages(rawMessages.map((m) => (m.id === editingMessageId ? { ...m, content: originalContent } : m)));
      setModalState({ isOpen: true, title: "編集エラー", message: "メッセージの更新に失敗しました。", isAlert: true });
    }
  };

  const handleDelete = (messageId: number) => {
    const message = rawMessages.find((m) => m.id === messageId);
    if (!message) return;

    setModalState({
      isOpen: true,
      title: "削除の確認",
      message: "このメッセージと以降のやり取りを削除しますか？",
      confirmText: "削除",
      onConfirm: async () => {
        const originalMessages = [...rawMessages];
        const turnId = message.turnId;
        setRawMessages((prev) => prev.filter((m) => m.turnId !== turnId));

        try {
          await fetch("/api/chat/messages", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
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

  // ▼▼▼【Stale State修正】 Turn ではなく turnId: number を受け取る ▼▼▼
  const handleRegenerate = async (turnId: number) => {
    if (isLoading || !chatId) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, turnId: turnId, settings: generationSettings }),
      });
      if (!res.ok) throw new Error("再生成に失敗しました");
      const data = await res.json();
      const newMessage = {
        ...data.newMessage,
        timestamp: new Date(data.newMessage.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      };
      setRawMessages((prev) => {
        const updated = prev.map((m) => (m.turnId === turnId && m.role === "model" ? { ...m, isActive: false } : m));
        return [...updated, newMessage];
      });
    } catch (error) {
      setModalState({ isOpen: true, title: "エラー", message: (error as Error).message, isAlert: true });
    } finally {
      setIsLoading(false);
    }
  };
  // ▲▲▲ 修正ここまで ▲▲▲

  const switchModelMessage = (turnId: number, direction: "next" | "prev") => {
    // `turns` state は `switchModelMessage` のために使用
    const turn = turns.find((t) => t.turnId === turnId);
    if (!turn || turn.modelMessages.length <= 1) return;
    const newIndex =
      direction === "next"
        ? (turn.activeModelIndex + 1) % turn.modelMessages.length
        : (turn.activeModelIndex - 1 + turn.modelMessages.length) % turn.modelMessages.length;

    const newActiveId = turn.modelMessages[newIndex].id;
    setRawMessages((prev) =>
      prev.map((m) => {
        if (m.turnId === turnId && m.role === "model") {
          return { ...m, isActive: m.id === newActiveId };
        }
        return m;
      })
    );

    fetch("/api/chat/messages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
          rawMessages={rawMessages} // ▼▼▼【Stale State修正】 rawMessages のみを渡す
          // turns={turns} // ★★★【Stale State修正】この prop は削除
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
          handleRegenerate={handleRegenerate} // ▼▼▼ (turnId: number) シグネチャで渡す ▼▼▼
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
        onNewChat={() => {
          /* ロジックをここに実装 */
        }}
        onSaveConversationAsTxt={() => {
          /* ロジックをここに実装 */
        }}
        userNote={userNote}
        onSaveNote={async (note) => {
          console.log(note);
        }}
        characterId={characterId}
        chatId={chatId}
        // ▼▼▼【修正】ブースト関連の props を削除 ▼▼▼
        chatStyleSettings={chatStyleSettings}
        onChatStyleSettingsChange={setChatStyleSettings}
        userPoints={userPoints}
      />

      {lightboxImage && <ImageLightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}