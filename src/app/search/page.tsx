"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, FormEvent, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import Image from "next/image";
import SearchRightSidebar from "@/components/SearchRightSidebar";

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

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // モバイル/PC判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // updateRecentSearchesを先に定義
  const updateRecentSearches = useCallback((term: string) => {
    setRecentSearches(prev => {
      const updatedSearches = [
        term,
        ...prev.filter((s) => s !== term),
      ].slice(0, 5);
      localStorage.setItem("recentSearches", JSON.stringify(updatedSearches));
      return updatedSearches;
    });
  }, []);

  // URLクエリパラメータから検索語を取得
  useEffect(() => {
    const queryParam = searchParams.get('query');
    if (queryParam && !hasSearched) {
      setQuery(queryParam);
      const performSearch = async () => {
        setIsLoading(true);
        setHasSearched(true);
        setRelatedKeywords([]);
        try {
          const response = await fetch(
            `/api/search?query=${encodeURIComponent(queryParam)}`
          );
          const data = await response.json();
          setSearchResults(data);
          updateRecentSearches(queryParam);
          
          // 関連検索語を生成
          if (data && data.length > 0) {
            const allHashtags = data.flatMap((char: SearchResult) => char.hashtags || []);
            const uniqueHashtags = Array.from(new Set(allHashtags)) as string[];
            const related = uniqueHashtags
              .filter((tag: string) => tag.toLowerCase().includes(queryParam.toLowerCase()) || queryParam.toLowerCase().includes(tag.toLowerCase()))
              .slice(0, 5);
            setRelatedKeywords(related);
          }
        } catch (error) {
          console.error("検索に失敗:", error);
        } finally {
          setIsLoading(false);
        }
      };
      performSearch();
    }
  }, [searchParams, hasSearched, updateRecentSearches]);

  // 初期ロード時に検索履歴と人気検索語を取得
  useEffect(() => {
    const storedSearches = localStorage.getItem("recentSearches");
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
    fetchPopularKeywords();
  }, []);

  // 入力中の関連検索語を更新
  useEffect(() => {
    if (!hasSearched && query.trim().length > 0) {
      const allKeywords = [...recentSearches, ...popularKeywords];
      const uniqueKeywords = Array.from(new Set(allKeywords));
      const filtered = uniqueKeywords
        .filter((keyword) => keyword.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [query, hasSearched, recentSearches, popularKeywords]);

  const fetchPopularKeywords = async () => {
    try {
      const response = await fetch("/api/search");
      const data = await response.json();
      setPopularKeywords(data.popularKeywords || []);
    } catch (error) {
      console.error("人気検索語の取得に失敗:", error);
    }
  };

  const handleSearch = useCallback(async (
    e?: FormEvent<HTMLFormElement>,
    keyword?: string
  ) => {
    if (e) e.preventDefault();
    const searchTerm = keyword || query;
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setRelatedKeywords([]);

    try {
      const response = await fetch(
        `/api/search?query=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      setSearchResults(data);
      updateRecentSearches(searchTerm);
      
      // 연관검색어 생성
      if (data && data.length > 0) {
        const allHashtags = data.flatMap((char: SearchResult) => char.hashtags || []);
        const uniqueHashtags = Array.from(new Set(allHashtags)) as string[];
        const related = uniqueHashtags
          .filter((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()) || searchTerm.toLowerCase().includes(tag.toLowerCase()))
          .slice(0, 5);
        setRelatedKeywords(related);
      }
    } catch (error) {
      console.error("検索に失敗:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, updateRecentSearches]);

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
    <div className="bg-gray-950 min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-gray-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {!isMobile ? (
          // PC版: 3-column layout
          <div className="flex max-w-[1920px] mx-auto">
            <main className="flex-1 px-4 md:px-6 py-6 md:py-8">
              {/* ヘッダー（戻る + 検索フォーム） - 검색 결과가 있을 때는 검색창 숨김 */}
              {!hasSearched && (
                <header className="flex items-center gap-3 mb-8">
                  <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <form onSubmit={handleSearch} className="flex-grow relative max-w-2xl">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="話したいキャラクターを探す"
                        className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full py-3 pl-12 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                      />
                      {/* 入力中の関連検索語ドロップダウン */}
                      {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                          {suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSearch(undefined, suggestion)}
                              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                            >
                              <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-300 hover:text-blue-400">{suggestion}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </form>
                </header>
              )}

              {hasSearched ? (
                // 検索結果表示
                <div>
                  {/* 検索結果がある場合の戻るボタン - ホームへ移動 */}
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      onClick={() => router.push('/')}
                      className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
                    >
                      <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-white">
                      検索結果: {query}
                    </h2>
                  </div>
                  
                  {/* 関連検索語を表示 */}
                  {!isLoading && relatedKeywords.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-400 mb-3">関連検索語</h3>
                      <div className="flex flex-wrap gap-2">
                        {relatedKeywords.map((keyword) => (
                          <button
                            key={keyword}
                            onClick={() => handleSearch(undefined, keyword)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-sm text-gray-300 hover:text-blue-400 transition-all border border-white/10 hover:border-blue-500/30"
                          >
                            #{keyword}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {isLoading ? (
                    <div className="flex justify-center items-center py-16">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
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
                            className="group flex items-start bg-black/40 backdrop-blur-sm p-4 rounded-xl hover:bg-white/5 transition-all border border-white/10 hover:border-blue-500/30"
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
                              <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors">
                                {char.name}
                              </h3>
                              <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                                {char.description}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {char.hashtags.slice(0, 5).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-xs bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-3 py-1 rounded-full text-blue-300 border border-blue-500/30"
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
                // 初期表示 (検索結果がない場合のみ表示)
                <div className="text-center py-16">
                  <p className="text-gray-500 text-lg">検索語を入力してください</p>
                </div>
              )}
            </main>
            {/* 右サイドバー: 最近の検索語と人気検索語 */}
            <SearchRightSidebar
              recentSearches={recentSearches}
              popularKeywords={popularKeywords}
              onSearch={(keyword) => handleSearch(undefined, keyword)}
              onRemoveRecentSearch={removeRecentSearch}
              onClearRecentSearches={clearRecentSearches}
            />
          </div>
        ) : (
          // モバイル版: 従来のレイアウト
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
            {/* ヘッダー（戻る + 検索フォーム） */}
            {!hasSearched && (
              <header className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => router.push('/')}
                  className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
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
                      className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-full py-3 pl-12 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                    {/* 입력 중 연관 검색어 드롭다운 */}
                    {suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSearch(undefined, suggestion)}
                            className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <Search className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300 hover:text-blue-400">{suggestion}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </form>
              </header>
            )}

            {hasSearched ? (
              // 検索結果表示
              <div>
                {/* 검색 결과가 있을 때 뒤로가기 버튼 - 홈으로 이동 */}
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => router.push('/')}
                    className="p-2 rounded-xl hover:bg-white/10 hover:text-blue-400 transition-all"
                  >
                    <ArrowLeft size={24} />
                  </button>
                  <h2 className="text-2xl font-bold text-white">
                    検索結果: {query}
                  </h2>
                </div>
                
                {/* 연관검색어 표시 */}
                {!isLoading && relatedKeywords.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">関連検索語</h3>
                    <div className="flex flex-wrap gap-2">
                      {relatedKeywords.map((keyword) => (
                        <button
                          key={keyword}
                          onClick={() => handleSearch(undefined, keyword)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-sm text-gray-300 hover:text-blue-400 transition-all border border-white/10 hover:border-blue-500/30"
                        >
                          #{keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {isLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
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
                          className="group flex items-start bg-black/40 backdrop-blur-sm p-4 rounded-xl hover:bg-white/5 transition-all border border-white/10 hover:border-blue-500/30"
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
                            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors">
                              {char.name}
                            </h3>
                            <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                              {char.description}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {char.hashtags.slice(0, 5).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs bg-gradient-to-r from-blue-500/20 to-cyan-500/20 px-3 py-1 rounded-full text-blue-300 border border-blue-500/30"
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

                {/* 過去の検索履歴 - 検索結果の下 */}
                {recentSearches.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-white/10">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-sm font-semibold text-gray-400">
                        最近の検索語
                      </h2>
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        すべて削除
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          className="flex items-center bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 transition-all border border-white/10 px-3 py-1.5"
                        >
                          <button
                            onClick={() => handleSearch(undefined, term)}
                            className="text-sm text-gray-300 hover:text-blue-400 transition-colors pr-2"
                          >
                            {term}
                          </button>
                          <button
                            onClick={() => removeRecentSearch(term)}
                            className="text-gray-500 hover:text-blue-400 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 人気検索語 - 最下部 */}
                {popularKeywords.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-white/10">
                    <h2 className="text-lg font-bold mb-4 text-white">
                      人気の検索語
                    </h2>
                    <div className="space-y-2">
                      {popularKeywords.map((keyword, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearch(undefined, keyword)}
                          className="flex items-center w-full text-left p-3 rounded-xl bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all border border-white/10 hover:border-blue-500/30 group"
                        >
                          <span className="font-bold text-blue-400 w-8 text-lg flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-gray-300 group-hover:text-blue-400 transition-colors">{keyword}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // モバイル版: 初期表示 (検索履歴と人気検索語)
              <div className="space-y-6">
                {/* 過去の検索履歴 - 小さな四角いボックス形式 */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-semibold text-gray-400">
                      最近の検索語
                    </h2>
                    {recentSearches.length > 0 && (
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        すべて削除
                      </button>
                    )}
                  </div>
                  {recentSearches.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          className="flex items-center bg-white/5 backdrop-blur-sm rounded-lg hover:bg-white/10 transition-all border border-white/10 px-3 py-1.5"
                        >
                          <button
                            onClick={() => handleSearch(undefined, term)}
                            className="text-sm text-gray-300 hover:text-blue-400 transition-colors pr-2"
                          >
                            {term}
                          </button>
                          <button
                            onClick={() => removeRecentSearch(term)}
                            className="text-gray-500 hover:text-blue-400 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">検索履歴がありません</p>
                  )}
                </div>
                
                {/* 人気検索語 - 最下部 */}
                <div className="mt-8">
                  <h2 className="text-lg font-bold mb-4 text-white">
                    人気の検索語
                  </h2>
                  {popularKeywords.length > 0 ? (
                    <div className="space-y-2">
                      {popularKeywords.map((keyword, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearch(undefined, keyword)}
                          className="flex items-center w-full text-left p-3 rounded-xl bg-black/40 backdrop-blur-sm hover:bg-white/5 transition-all border border-white/10 hover:border-blue-500/30 group"
                        >
                          <span className="font-bold text-blue-400 w-8 text-lg flex-shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-gray-300 group-hover:text-blue-400 transition-colors">{keyword}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-950 min-h-screen text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
