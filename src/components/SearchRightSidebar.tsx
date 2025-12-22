"use client";

import { X } from "lucide-react";

interface SearchRightSidebarProps {
  recentSearches: string[];
  popularKeywords: string[];
  onSearch: (keyword: string) => void;
  onRemoveRecentSearch: (term: string) => void;
  onClearRecentSearches: () => void;
}

export default function SearchRightSidebar({
  recentSearches,
  popularKeywords,
  onSearch,
  onRemoveRecentSearch,
  onClearRecentSearches,
}: SearchRightSidebarProps) {
  return (
    <aside className="w-80 flex-shrink-0 bg-black/80 backdrop-blur-xl border-l border-white/10 p-6 overflow-y-auto">
      {/* 最近の検索語 */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-300">最近の検索語</h3>
          {recentSearches.length > 0 && (
            <button
              onClick={onClearRecentSearches}
              className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              すべて削除
            </button>
          )}
        </div>
        <div className="space-y-2">
          {recentSearches.length > 0 ? (
            recentSearches.map((term) => (
              <div
                key={term}
                className="flex items-center justify-between bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-all group"
              >
                <button
                  onClick={() => onSearch(term)}
                  className="flex-1 text-left text-sm text-gray-300 hover:text-blue-400 transition-colors truncate"
                >
                  {term}
                </button>
                <button
                  onClick={() => onRemoveRecentSearch(term)}
                  className="p-1 text-gray-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">最近の検索履歴がありません</p>
          )}
        </div>
      </div>

      {/* 人気の検索語 */}
      <div>
        <h3 className="font-semibold text-gray-300 mb-4">人気の検索語</h3>
        <div className="space-y-2">
          {popularKeywords.map((keyword, index) => (
            <button
              key={index}
              onClick={() => onSearch(keyword)}
              className="flex items-center w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 hover:border-blue-500/30 group"
            >
              <span className="font-bold text-blue-400 w-8 text-lg flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-sm text-gray-300 group-hover:text-blue-400 transition-colors truncate">
                {keyword}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}


