"use client";

import { useState, useEffect, FormEvent } from "react";
// ▼▼▼【修正点】useRouter と Link をインポートします ▼▼▼
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import Image from "next/image";

// キャラクターのデータ型
type SearchResult = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
  characterImages: { imageUrl: string }[];
  _count: {
    favorites: number;
    chat: number;
  };
};

export default function SearchPage() {
  // ▼▼▼【修正点】useRouterを使用します ▼▼▼
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 初期ロード時に検索履歴と人気検索語を取得
  useEffect(() => {
    const storedSearches = localStorage.getItem("recentSearches");
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
    fetchPopularKeywords();
  }, []);

  const fetchPopularKeywords = async () => {
    try {
      const response = await fetch("/api/search");
      const data = await response.json();
      setPopularKeywords(data.popularKeywords || []);
    } catch (error) {
      console.error("人気検索語の取得に失敗:", error);
    }
  };

  const handleSearch = async (
    e?: FormEvent<HTMLFormElement>,
    keyword?: string
  ) => {
    if (e) e.preventDefault();
    const searchTerm = keyword || query;
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/search?query=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      setSearchResults(data);
      updateRecentSearches(searchTerm);
    } catch (error) {
      console.error("検索に失敗:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRecentSearches = (term: string) => {
    const updatedSearches = [
      term,
      ...recentSearches.filter((s) => s !== term),
    ].slice(0, 5);
    setRecentSearches(updatedSearches);
    localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
  };

  const removeRecentSearch = (term: string) => {
    const updatedSearches = recentSearches.filter((s) => s !== term);
    setRecentSearches(updatedSearches);
    localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  };

  return (
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          {/* ヘッダー（戻る + 検索フォーム） */}
          <header className="flex items-center gap-3 mb-8">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <form onSubmit={handleSearch} className="flex-grow relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="話したいキャラクターを探す"
                  className="w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                />
              </div>
            </form>
          </header>

          {hasSearched ? (
            // 検索結果表示
            <div>
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                検索結果
              </h2>
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
                    <p className="text-gray-400">検索中...</p>
                  </div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((char) => {
                    const src =
                      char.characterImages[0]?.imageUrl ||
                      "https://placehold.co/100x100/1a1a1a/ffffff?text=?";
                    return (
                      <Link
                        href={`/characters/${char.id}`}
                        key={char.id}
                        className="group flex items-start bg-gray-900/50 backdrop-blur-sm p-4 rounded-xl hover:bg-gray-800/50 transition-all border border-gray-800/50 hover:border-pink-500/30"
                      >
                        <div className="relative w-20 h-20 mr-4 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                          <Image
                            src={src}
                            alt={char.name}
                            fill
                            sizes="80px"
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h3 className="font-bold text-lg mb-1 group-hover:text-pink-400 transition-colors">
                            {char.name}
                          </h3>
                          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                            {char.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {char.hashtags.slice(0, 5).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-3 py-1 rounded-full text-pink-300 border border-pink-500/30"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-gray-500 text-lg">検索結果がありません。</p>
                </div>
              )}
            </div>
          ) : (
            // 初期表示 (検索履歴と人気検索語)
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    最近の検索語
                  </h2>
                  {recentSearches.length > 0 && (
                    <button
                      onClick={clearRecentSearches}
                      className="text-sm text-gray-500 hover:text-pink-400 transition-colors"
                    >
                      すべて削除
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.length > 0 ? (
                    recentSearches.map((term) => (
                      <div
                        key={term}
                        className="flex items-center bg-gray-800/50 backdrop-blur-sm rounded-full hover:bg-gray-700/50 transition-all border border-gray-700/50"
                      >
                        <button
                          onClick={() => handleSearch(undefined, term)}
                          className="px-4 py-2 text-sm hover:text-pink-400 transition-colors"
                        >
                          {term}
                        </button>
                        <button
                          onClick={() => removeRecentSearch(term)}
                          className="pr-2 text-gray-500 hover:text-pink-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">最近の検索履歴がありません</p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  人気の検索語
                </h2>
                <div className="space-y-2">
                  {popularKeywords.map((keyword, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(undefined, keyword)}
                      className="flex items-center w-full text-left p-3 rounded-xl bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/50 transition-all border border-gray-800/50 hover:border-pink-500/30 group"
                    >
                      <span className="font-bold text-pink-400 w-8 text-lg">
                        {index + 1}
                      </span>
                      <span className="group-hover:text-pink-400 transition-colors">{keyword}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
