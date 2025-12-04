"use client";

import { useState, useEffect } from 'react';
// Next.jsのナビゲーション機能とImageコンポーネントをインポートします
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Heart, MessageSquare, ArrowLeft } from 'lucide-react';

// キャラクターのデータ型を定義します。
type Character = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
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

// キャラクターカードコンポーネント（画像なし）
function CharacterCard({ character }: { character: Character }) {
  return (
    <Link href={`/characters/${character.id}`} className="group block">
      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-xl p-4 border border-gray-800/50 hover:border-pink-500/30 transition-all">
        <h3 className="font-semibold text-white mb-2 truncate group-hover:text-pink-400 transition-colors">
          {character.name}
        </h3>
        <p className="text-sm text-gray-400 line-clamp-3 mb-3 min-h-[3rem]">{character.description || '説明なし'}</p>
        {character.hashtags && character.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {character.hashtags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 text-xs bg-pink-500/20 text-pink-300 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <MessageSquare size={12} /> 
            <span>{character._count?.interactions ?? 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart size={12} /> 
            <span>{character._count?.favorites ?? 0}</span>
          </div>
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
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 bg-black/80 backdrop-blur-xl border-b border-gray-900/50 z-10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
            <header className="relative flex justify-center items-center mb-4">
              <button onClick={() => router.back()} className="absolute left-0 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
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
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30' 
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white'
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800/50 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all"
              >
                {activeSort.label}
                <ChevronDown size={16} className={`transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isSortMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-lg z-20 border border-gray-700/50">
                  {sortOptions.map(option => (
                    <button
                      key={option.key}
                      onClick={() => handleSortChange(option)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-pink-500/10 hover:text-pink-400 transition-colors first:rounded-t-xl last:rounded-b-xl"
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
                <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                <p className="text-gray-400">読み込み中...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {characters.map((char) => (
                  <CharacterCard key={char.id} character={char} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700/50"
                  >
                    前へ
                  </button>
                  <span className="font-semibold px-4">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700/50"
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
