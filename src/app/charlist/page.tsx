"use client";

import { useState, useEffect } from 'react';
// Next.jsのナビゲーション機能とImageコンポーネントをインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Heart, MessageSquare, ArrowLeft } from 'lucide-react';

// キャラクターのデータ型を定義します。
type Character = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
  characterImages: { imageUrl: string }[];
  _count?: { // APIからの応答に_countが含まれない場合も考慮し、オプショナルにします
    favorites: number;
    interactions: number;
  };
};

// ソートオプションの型を定義します
type SortOption = {
  key: 'newest' | 'popular' | 'likes';
  label: string;
};

const sortOptions: SortOption[] = [
  { key: 'newest', label: '最新登録順' },
  { key: 'popular', label: 'チャット数順' },
  { key: 'likes', label: 'いいね数順' },
];

// キャラクター画像カードコンポーネント（画像エラー処理付き）
function CharacterImageCard({ character }: { character: Character }) {
  const [imageError, setImageError] = useState(false);
  const originalSrc = character.characterImages[0]?.imageUrl;
  const placeholderSrc = 'https://placehold.co/300x400/1a1a1a/ffffff?text=?';
  const src = imageError || !originalSrc ? placeholderSrc : originalSrc;
  
  return (
    <Link href={`/characters/${character.id}`} className="group">
      <div className="relative aspect-[3/4] bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden mb-3">
        <Image
          src={src}
          alt={character.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          onError={() => setImageError(true)}
        />
        {/* ホバー時のグラデーションオーバーレイ */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-cyan-500/0 to-blue-500/0 group-hover:from-blue-500/20 group-hover:via-cyan-500/10 group-hover:to-blue-500/20 transition-all duration-500" />
      </div>
      <h3 className="font-semibold text-white mb-1 truncate group-hover:text-blue-400 transition-colors">
        {character.name}
      </h3>
      <p className="text-sm text-gray-400 truncate line-clamp-2 mb-2">{character.description}</p>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <MessageSquare size={12} /> 
          <span>{character._count?.interactions ?? 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart size={12} /> 
          <span>{character._count?.favorites ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}

export default function CharListPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [tags, setTags] = useState<string[]>(['全体']);
  const [activeTag, setActiveTag] = useState('全体');
  const [activeSort, setActiveSort] = useState<SortOption>(sortOptions[0]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tag: activeTag,
          sort: activeSort.key,
          page: String(page),
        });
        const response = await fetch(`/api/charlist?${params.toString()}`, { cache: 'no-store' }); // キャッシュを無効化
        if (!response.ok) throw new Error('データ取得失敗');
        const data = await response.json();
        setCharacters(data.characters || []);
        if (data.tags) {
          setTags(data.tags);
        }
        if (typeof data.page === 'number') {
          setPage(data.page);
        }
        if (typeof data.totalPages === 'number') {
          setTotalPages(data.totalPages || 1);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTag, activeSort, page]);

  const handleSortChange = (option: SortOption) => {
    setActiveSort(option);
    setIsSortMenuOpen(false);
    setPage(1);
  };

  return (
    <div className="bg-gray-950 min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 bg-black/80 backdrop-blur-xl border-b border-white/10 z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
            <header className="relative flex justify-center items-center mb-4">
              <button onClick={() => router.back()} className="absolute left-0 p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-2xl font-bold text-white">
                キャラクター一覧
              </h1>
            </header>
            <div className="overflow-x-auto whitespace-nowrap pb-2 -mx-4 px-4 scrollbar-hide">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setActiveTag(tag);
                    setPage(1);
                  }}
                  className={`inline-block px-4 py-2 mr-2 rounded-full text-sm font-semibold transition-all ${
                    activeTag === tag 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white border border-white/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24">
          <div className="flex justify-end mb-6">
            <div className="relative">
              <button 
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-sm text-gray-300 hover:text-white hover:bg-white/15 transition-all border border-white/20"
              >
                {activeSort.label}
                <ChevronDown size={16} className={`transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-black/90 backdrop-blur-xl rounded-xl shadow-lg z-20 border border-white/10">
                  {sortOptions.map(option => (
                    <button
                      key={option.key}
                      onClick={() => handleSortChange(option)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 hover:text-blue-400 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-400">読み込み中...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {characters.map((char) => (
                  <CharacterImageCard key={char.id} character={char} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/20 cursor-pointer"
                  >
                    前へ
                  </button>
                  <span className="font-semibold px-4">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/20 cursor-pointer"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
