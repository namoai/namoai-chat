// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, User, Trophy, Users, Sparkles, TrendingUp, Star, ArrowRight, Bell, MessageSquare } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";

// キャラクターのデータ型
type Character = {
  id: number;
  name: string;
  description: string | null;
  characterImages: { imageUrl: string }[];
};

// メインページのデータ型
type MainPageData = {
  officialCharacters: Character[];
  trendingCharacters: Character[];
  newTopCharacters: Character[];
  specialCharacters: Character[];
  generalCharacters: Character[];
};

// ヒーローセクション用のフィーチャードキャラクターカード
const FeaturedCharacterCard = ({ character }: { character: Character }) => {
  const [imageError, setImageError] = useState(false);
  const originalSrc = character.characterImages[0]?.imageUrl;
  const placeholderSrc = "https://placehold.co/600x800/1a1a1a/ffffff?text=?";
  const src = imageError || !originalSrc ? placeholderSrc : originalSrc;
  
  return (
    <a
      href={`/characters/${character.id}`}
      className="group relative block w-full rounded-2xl overflow-hidden cursor-pointer"
      style={{ aspectRatio: '16/9', minHeight: '400px', maxHeight: '600px' }}
    >
      {/* 背景画像 */}
      <div className="absolute inset-0">
        <Image
          src={src}
          alt={character.name}
          fill
          className="object-contain group-hover:scale-105 transition-transform duration-700"
          sizes="100vw"
          priority
          onError={() => setImageError(true)}
        />
        {/* グラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      
      {/* コンテンツ */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          <span className="text-sm font-semibold text-pink-400 uppercase tracking-wider">Featured</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-2 group-hover:text-pink-400 transition-colors">
          {character.name}
        </h2>
        <p className="text-gray-300 text-sm md:text-base line-clamp-2 mb-4">
          {character.description || "新しい冒険が始まります"}
        </p>
        <div className="flex items-center gap-2 text-pink-400 group-hover:translate-x-2 transition-transform">
          <span className="text-sm font-semibold">チャットを始める</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </a>
  );
};

// 改善されたキャラクターカード
const CharacterCard = ({ character }: { character: Character }) => {
  const [imageError, setImageError] = useState(false);
  const originalSrc = character.characterImages[0]?.imageUrl;
  const placeholderSrc = "https://placehold.co/300x300/1a1a1a/ffffff?text=?";
  const src = imageError || !originalSrc ? placeholderSrc : originalSrc;

  return (
    <a
      href={`/characters/${character.id}`}
      className="group relative cursor-pointer"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-gray-900 to-gray-800">
        <Image
          src={src}
          alt={character.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          onError={() => setImageError(true)}
        />
        {/* ホバー時のグラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-pink-500/20 group-hover:via-purple-500/10 group-hover:to-pink-500/20 transition-all duration-500" />
        
        {/* シャインエフェクト */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
      <h3 className="font-semibold text-white mb-1 truncate group-hover:text-pink-400 transition-colors">
        {character.name}
      </h3>
      <p className="text-sm text-gray-400 truncate line-clamp-2">
        {character.description || " "}
      </p>
    </a>
  );
};

// 改善されたキャラクター行セクション
const CharacterRow = ({
  title,
  characters,
  moreLink,
  icon: Icon,
  gradient,
}: {
  title: string;
  characters: Character[];
  moreLink?: string;
  icon?: React.ElementType;
  gradient?: string;
}) => {
  if (!characters || characters.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`p-2 rounded-lg ${gradient || 'bg-gradient-to-br from-pink-500/20 to-purple-500/20'}`}>
              <Icon className="w-5 h-5 text-pink-400" />
            </div>
          )}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {title}
          </h2>
        </div>
        {moreLink && (
          <a
            href={moreLink}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-pink-400 transition-colors group"
            title="もっと見る"
          >
            <span>もっと見る</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {characters.map((char) => (
          <CharacterCard key={char.id} character={char} />
        ))}
      </div>
    </section>
  );
};

export default function HomePage() {
  const [pageData, setPageData] = useState<MainPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/main-page", { cache: 'no-store' });
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        setPageData(data);
      } catch (error) {
        console.error("データの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 未読通知数を取得（リアルタイム対応）
  useEffect(() => {
    if (!session?.user) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count");
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.error("未読通知数取得エラー:", error);
      }
    };

    fetchUnreadCount();
    
    // 5秒ごとにポーリング（リアルタイムに近い更新）
    const interval = setInterval(fetchUnreadCount, 5000);

    // ページがアクティブになったときに即座に更新
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ページにフォーカスが戻ったときに即座に更新
    const handleFocus = () => {
      fetchUnreadCount();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">データの読み込みに失敗しました。</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const featuredCharacter = pageData.trendingCharacters[0] || pageData.newTopCharacters[0];

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* ヘッダー */}
        <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                  ナモアイ
                </h1>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                {/* 通知アイコン - 最初の位置に配置 */}
                {session?.user && (
                  <a
                    href="/notifications"
                    title="通知"
                    className="relative p-2 md:p-3 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all duration-200"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-black shadow-lg shadow-red-500/50 z-10 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </div>
                    )}
                  </a>
                )}
                <a
                  href="/charlist"
                  title="キャラクター一覧"
                  className="p-2 md:p-3 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all duration-200"
                >
                  <Users className="w-5 h-5" />
                </a>
                <a
                  href="/search"
                  title="検索"
                  className="p-2 md:p-3 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all duration-200"
                >
                  <Search className="w-5 h-5" />
                </a>
                <a
                  href="/ranking"
                  title="ランキング"
                  className="p-2 md:p-3 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all duration-200"
                >
                  <Trophy className="w-5 h-5" />
                </a>
                <a
                  href="/MyPage"
                  title="マイページ"
                  className="p-2 md:p-3 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all duration-200"
                >
                  <User className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          {/* プロモーションバナー */}
          <div className="relative mb-8 md:mb-12 rounded-2xl overflow-hidden bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 p-[2px]">
            <div className="bg-black rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                      毎日出席して最大10倍の報酬をゲット！
                    </h2>
                    <p className="text-sm text-gray-400">ログインして特典を受け取ろう</p>
                  </div>
                </div>
                <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold transition-all duration-200 shadow-lg shadow-pink-500/30">
                  詳細を見る
                </button>
              </div>
            </div>
          </div>

          {/* ヒーローセクション（フィーチャードキャラクター） */}
          {featuredCharacter && (
            <div className="mb-12 md:mb-16">
              <FeaturedCharacterCard character={featuredCharacter} />
            </div>
          )}

          {/* ナモアイフレンズセクション */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 via-pink-500/20 to-purple-500/20">
                <Star className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                ナモアイフレンズ
              </h2>
            </div>

            {pageData.officialCharacters && pageData.officialCharacters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {pageData.officialCharacters.map((char) => (
                  <CharacterCard key={char.id} character={char} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-gradient-to-br from-gray-900/50 to-gray-800/50 backdrop-blur-sm border border-gray-800/50">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <Star className="w-10 h-10 text-pink-400/50" />
                </div>
                <h3 className="text-xl font-bold text-gray-300 mb-2">ナモアイフレンズがまだ登録されていません</h3>
                <p className="text-gray-500 text-center max-w-md">
                  管理者が公式キャラクターを登録すると、ここに表示されます。
                </p>
              </div>
            )}
          </section>

          {/* キャラクターセクション */}
          <CharacterRow
            title="対話中のキャラクター"
            characters={pageData.trendingCharacters}
            moreLink="/chatlist"
            icon={MessageSquare}
            gradient="bg-gradient-to-br from-blue-500/20 to-purple-500/20"
          />
          <CharacterRow
            title="ホットな新作TOP10"
            characters={pageData.newTopCharacters}
            icon={Star}
            gradient="bg-gradient-to-br from-yellow-500/20 to-orange-500/20"
          />
          <CharacterRow
            title="見逃せない特集キャラクター"
            characters={pageData.specialCharacters}
            icon={Sparkles}
            gradient="bg-gradient-to-br from-purple-500/20 to-pink-500/20"
          />
          <CharacterRow
            title="新規キャラクター紹介"
            characters={pageData.generalCharacters}
            moreLink="/charlist"
            icon={Users}
          />
        </main>
      </div>
    </div>
  );
}