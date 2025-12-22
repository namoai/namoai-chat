"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

interface ChatItem {
  id: number;
  characterId: number;
  updatedAt: string;
  characters: {
    name: string;
    characterImages: { imageUrl: string }[];
  };
  chat_message: { content: string }[];
}

interface RecommendedCharacter {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
}

export default function PCRightSidebar() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [recommended, setRecommended] = useState<RecommendedCharacter[]>([]);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // チャット履歴取得
        const chatRes = await fetch("/api/chatlist");
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setChats(chatData.slice(0, 5)); // 最新5件のみ
        }

        // おすすめキャラクター取得（メインページAPIから取得）
        const mainRes = await fetch("/api/main-page");
        if (mainRes.ok) {
          const mainData = await mainRes.json();
          // trendingCharactersから5件取得し、重複を除去
          const allRecommended = mainData.trendingCharacters || [];
          // IDで重複を除去
          const uniqueRecommended = Array.from(
            new Map(allRecommended.map((char: RecommendedCharacter) => [char.id, char])).values()
          ).slice(0, 5) as RecommendedCharacter[];
          setRecommended(uniqueRecommended);
        }
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${diffDays}日前`;
  };

  if (loading) {
    return (
      <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
        <div className="flex justify-center items-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      {/* 現在のチャット */}
      <div className="mb-6">
        <button
          onClick={() => setIsChatCollapsed(!isChatCollapsed)}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <span className="font-semibold text-white">現在のチャット</span>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isChatCollapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* チャット履歴 */}
      {!isChatCollapsed && (
        <div className="space-y-3 mb-8">
          {chats.length > 0 ? (
            chats.map((chat) => {
              const imageUrl =
                chat.characters.characterImages[0]?.imageUrl ||
                "https://placehold.co/100x100/1a1a1a/ffffff?text=?";
              const lastMessage = chat.chat_message[0]?.content || "まだメッセージがありません。";

              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.characterId}?chatId=${chat.id}`}
                  className="block p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0">
                      <Image
                        src={imageUrl}
                        alt={chat.characters.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                        {chat.characters.name}
                      </h4>
                      <p className="text-xs text-gray-400">{formatTimeAgo(chat.updatedAt)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{lastMessage}</p>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              チャット履歴がありません
            </div>
          )}
        </div>
      )}

      {/* おすすめキャラクター */}
      <div className="mt-8">
        <h3 className="font-semibold mb-4 text-gray-300">おすすめ</h3>
        <div className="space-y-3">
          {recommended.length > 0 ? (
            recommended.map((char) => {
              const imageUrl =
                char.characterImages[0]?.imageUrl ||
                "https://placehold.co/100x100/1a1a1a/ffffff?text=?";

              return (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0">
                      <Image
                        src={imageUrl}
                        alt={char.name}
                        fill
                        sizes="48px"
                        className="object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                        {char.name}
                      </h4>
                      <p className="text-xs text-gray-400 truncate">
                        {char.description || "説明なし"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-center py-4 text-gray-500 text-xs">
              おすすめキャラクターがありません
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

