"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  mobile?: boolean;
}

export default function SearchBar({ 
  placeholder = "キャラクターやユーザーを検索...", 
  className = "",
  mobile = false 
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const router = useRouter();

  // 最近の検索語と人気検索語を取得
  useEffect(() => {
    const storedSearches = localStorage.getItem("recentSearches");
    if (storedSearches) {
      setRecentSearches(JSON.parse(storedSearches));
    }
    
    const fetchPopularKeywords = async () => {
      try {
        const response = await fetch("/api/search");
        const data = await response.json();
        setPopularKeywords(data.popularKeywords || []);
      } catch (error) {
        console.error("人気検索語の取得に失敗:", error);
      }
    };
    fetchPopularKeywords();
  }, []);

  // 入力中の関連検索語を更新
  useEffect(() => {
    if (query.trim().length > 0) {
      // 検索履歴と人気検索語から入力値と一致する項目をフィルタリング
      const allKeywords = [...recentSearches, ...popularKeywords];
      const uniqueKeywords = Array.from(new Set(allKeywords));
      const filtered = uniqueKeywords
        .filter((keyword) => keyword.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [query, recentSearches, popularKeywords]);

  const handleSearch = (e?: FormEvent<HTMLFormElement>, keyword?: string) => {
    if (e) e.preventDefault();
    const searchTerm = keyword || query;
    if (searchTerm.trim()) {
      router.push(`/search?query=${encodeURIComponent(searchTerm.trim())}`);
    }
    setSuggestions([]);
  };

  const inputSize = mobile 
    ? "px-4 py-2 pl-10" 
    : "px-4 py-2 pl-10";

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${inputSize} rounded-full bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all`}
        />
        <Search 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          size={mobile ? 20 : 20}
        />
        {/* 入力中の関連検索語ドロップダウン */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
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
  );
}



