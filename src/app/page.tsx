// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Sparkles, Star, ArrowRight, MessageSquare, Bell } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BannerCarousel from "@/components/BannerCarousel";
import PCRightSidebar from "@/components/PCRightSidebar";
import SearchBar from "@/components/SearchBar";

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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-cyan-500/0 to-blue-500/0 group-hover:from-blue-500/20 group-hover:via-cyan-500/10 group-hover:to-blue-500/20 transition-all duration-500" />
        
        {/* シャインエフェクト */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
      <h3 className="font-semibold text-white mb-1 truncate group-hover:text-blue-400 transition-colors">
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
            <div className={`p-2 rounded-lg ${gradient || 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'}`}>
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
          )}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {title}
          </h2>
        </div>
        {moreLink && (
          <a
            href={moreLink}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-400 transition-colors group"
            title="もっと見る"
          >
            <span>もっと見る</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {characters.map((char, idx) => (
          // key衝突防止: 同一idが重複する場合、indexを追加して一意キーを保証
          <CharacterCard key={`${char.id}-${idx}`} character={char} />
        ))}
      </div>
    </section>
  );
};

export default function HomePage() {
  const [pageData, setPageData] = useState<MainPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: session } = useSession();
  const router = useRouter();

  // モバイル/PC判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 未読通知数取得
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
    const interval = setInterval(fetchUnreadCount, 5000);

    return () => clearInterval(interval);
  }, [session]);

  // ✅ プロフィール未完了チェック - JWT発行後にリダイレクト
  useEffect(() => {
    const needsProfileCompletion =
      typeof session?.user === 'object' &&
      session?.user &&
      'needsProfileCompletion' in session.user &&
      (session.user as { needsProfileCompletion?: boolean }).needsProfileCompletion === true;

    if (needsProfileCompletion) {
      console.log('[HomePage] needsProfileCompletion detected, redirecting to /complete-profile');
      router.push('/complete-profile');
    }
  }, [session, router]);

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


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <p className="text-gray-400 mb-4">データの読み込みに失敗しました。</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 min-h-screen text-white">
      {/* モバイル版ヘッダー (ロゴ + 検索バー + 通知) */}
      {isMobile && (
        <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <span className="text-base font-bold text-white">ナモアイ</span>
            </Link>
            {/* Search Bar */}
            <div className="flex-1 min-w-0">
              <SearchBar mobile={true} />
            </div>
            {/* 通知アイコン */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-lg hover:bg-blue-500/10 hover:text-blue-400 transition-colors flex-shrink-0"
            >
              <Bell className="w-5 h-5 text-gray-300" />
              {unreadCount > 0 && (
                <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-black" />
              )}
            </Link>
          </div>
        </header>
      )}
      
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* PC: 3-column layout, Mobile: full width */}
        {!isMobile ? (
          <div className="flex max-w-[1920px] mx-auto">
            {/* メインコンテンツ */}
            <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
              {/* ヒーローセクション - キャロセルバナー */}
              <section className="mb-8 md:mb-12">
                <BannerCarousel mobile={isMobile} />
              </section>

          {/* ナモアイフレンズセクション */}
          <section className="mb-12">
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 via-blue-500/20 to-cyan-500/20">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
              </div>
              <h2 className="text-xl md:text-3xl font-bold text-white">
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
              <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                  <Star className="w-10 h-10 text-blue-400/50" />
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
            gradient="bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
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
            gradient="bg-gradient-to-br from-blue-500/20 to-purple-500/20"
          />
          <CharacterRow
            title="新規キャラクター紹介"
            characters={pageData.generalCharacters}
            moreLink="/charlist"
            icon={MessageSquare}
          />
            </main>

            {/* 右サイドバー - PCのみ表示 */}
            <PCRightSidebar />
          </div>
        ) : (
          /* Mobile: full width layout */
          <main className="px-4 md:px-8 py-6 md:py-8">
            {/* ヒーローセクション - キャロセルバナー */}
            <section className="mb-8 md:mb-12">
              <BannerCarousel mobile={isMobile} />
            </section>

            {/* ナモアイフレンズセクション */}
            <section className="mb-12">
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 via-blue-500/20 to-cyan-500/20">
                  <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                </div>
                <h2 className="text-xl md:text-3xl font-bold text-white">
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
                <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                    <Star className="w-10 h-10 text-blue-400/50" />
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
              gradient="bg-gradient-to-br from-blue-500/20 to-cyan-500/20"
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
              gradient="bg-gradient-to-br from-blue-500/20 to-purple-500/20"
            />
            <CharacterRow
              title="新規キャラクター紹介"
              characters={pageData.generalCharacters}
              moreLink="/charlist"
              icon={MessageSquare}
            />
          </main>
        )}
      </div>
    </div>
  );
}