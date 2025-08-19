"use client";

import { useState, useEffect, FormEvent } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';

// キャラクターのデータ型を定義します。
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
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // コンポーネントのマウント時に最近の検索履歴と人気検索語を読み込みます。
  useEffect(() => {
    const storedSearches = localStorage.getItem('recentSearches');
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
    fetchPopularKeywords();
  }, []);

  const fetchPopularKeywords = async () => {
    try {
      const response = await fetch('/api/search');
      const data = await response.json();
      setPopularKeywords(data.popularKeywords || []);
    } catch (error) {
      console.error("人気検索語の取得に失敗:", error);
    }
  };

  const handleSearch = async (e?: FormEvent<HTMLFormElement>, keyword?: string) => {
    if (e) e.preventDefault();
    const searchTerm = keyword || query;
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`);
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
    const updatedSearches = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };
  
  const removeRecentSearch = (term: string) => {
    const updatedSearches = recentSearches.filter(s => s !== term);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  return (
    <div className="bg-black min-h-screen text-white p-4">
      <header className="flex items-center mb-6">
        {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
        <button onClick={() => window.history.back()} className="p-2 mr-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft size={24} />
        </button>
        <form onSubmit={handleSearch} className="flex-grow relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="話したいキャラクターを探す"
            className="w-full bg-gray-800 border-none rounded-full py-2 pl-4 pr-10 text-white placeholder-gray-500"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer">
            <Search size={20} className="text-gray-400 hover:text-white" />
          </button>
        </form>
      </header>

      {hasSearched ? (
        // 検索結果表示
        <div>
          <h2 className="text-xl font-bold mb-4">検索結果</h2>
          {isLoading ? (
            <p>検索中...</p>
          ) : searchResults.length > 0 ? (
            <div className="space-y-4">
              {searchResults.map(char => (
                // ▼▼▼ 変更点: 検索結果にもホバーエフェクトとカーソル変更を追加 ▼▼▼
                <a href={`/characters/${char.id}`} key={char.id} className="flex items-start bg-gray-900 p-3 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                  <img src={char.characterImages[0]?.imageUrl || 'https://placehold.co/100x100/1a1a1a/ffffff?text=?'} alt={char.name} className="w-16 h-16 rounded-md object-cover mr-4"/>
                  <div className="flex-grow">
                    <h3 className="font-bold">{char.name}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{char.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {char.hashtags.map(tag => <span key={tag} className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">{tag}</span>)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p>検索結果がありません。</p>
          )}
        </div>
      ) : (
        // 初期表示 (最近の検索履歴と人気検索語)
        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">最近の検索語</h2>
              {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
              <button onClick={clearRecentSearches} className="text-sm text-gray-500 hover:text-white transition-colors cursor-pointer">すべて削除</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map(term => (
                <div key={term} className="flex items-center bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                  <button onClick={() => handleSearch(undefined, term)} className="px-3 py-1 cursor-pointer">{term}</button>
                  <button onClick={() => removeRecentSearch(term)} className="pr-2 text-gray-500 hover:text-white transition-colors cursor-pointer"><X size={14}/></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-bold mb-3">人気の検索語</h2>
            <ol className="space-y-2">
              {popularKeywords.map((keyword, index) => (
                <li key={index}>
                    {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
                  <button onClick={() => handleSearch(undefined, keyword)} className="flex items-center w-full text-left p-1 rounded-md hover:bg-gray-800 transition-colors cursor-pointer">
                    <span className="font-bold text-pink-500 w-6">{index + 1}</span>
                    <span>{keyword}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
