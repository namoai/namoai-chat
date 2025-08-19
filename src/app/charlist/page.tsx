"use client";

import { useState, useEffect } from 'react';
import { ChevronDown, Heart, MessageSquare, ArrowLeft } from 'lucide-react';

// キャラクターのデータ型を定義します。
type Character = {
  id: number;
  name: string;
  description: string | null;
  hashtags: string[];
  characterImages: { imageUrl: string }[];
  _count: {
    favorites: number;
    interactions: number;
  };
};

type SortOption = {
  key: 'newest' | 'popular' | 'likes';
  label: string;
};

const sortOptions: SortOption[] = [
  { key: 'newest', label: '最新登録順' },
  { key: 'popular', label: 'チャット数順' },
  { key: 'likes', label: 'いいね数順' },
];

export default function CharListPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tags, setTags] = useState<string[]>(['全体']);
  const [activeTag, setActiveTag] = useState('全体');
  const [activeSort, setActiveSort] = useState<SortOption>(sortOptions[0]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/charlist?tag=${activeTag}&sort=${activeSort.key}`);
        if (!response.ok) throw new Error('データ取得失敗');
        const data = await response.json();
        setCharacters(data.characters || []);
        if (data.tags) {
          setTags(data.tags);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTag, activeSort]);

  const handleSortChange = (option: SortOption) => {
    setActiveSort(option);
    setIsSortMenuOpen(false);
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="sticky top-0 bg-black z-10 p-4">
        <header className="relative flex justify-center items-center mb-4">
            {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
            <button onClick={() => window.history.back()} className="absolute left-0 p-2 rounded-full hover:bg-pink-500/20 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold">キャラクター一覧</h1>
        </header>
        <div className="overflow-x-auto whitespace-nowrap pb-2 -mx-4 px-4">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              // ▼▼▼ 変更点: ボタンにカーソルポインターを追加 ▼▼▼
              className={`inline-block px-4 py-2 mr-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                activeTag === tag ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="flex justify-end mb-4">
          <div className="relative">
            {/* ▼▼▼ 変更点: ボタンにホバーエフェクトとカーソル変更を追加 ▼▼▼ */}
            <button onClick={() => setIsSortMenuOpen(!isSortMenuOpen)} className="flex items-center text-sm text-gray-300 hover:text-white transition-colors cursor-pointer">
              {activeSort.label}
              <ChevronDown size={16} className={`ml-1 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-gray-800 rounded-md shadow-lg z-20">
                {sortOptions.map(option => (
                  <button
                    key={option.key}
                    onClick={() => handleSortChange(option)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-center">読み込み中...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {characters.map(char => (
              // ▼▼▼ 変更点: リンクにカーソルポインターを追加 ▼▼▼
              <a href={`/characters/${char.id}`} key={char.id} className="group cursor-pointer">
                <div className="aspect-w-1 aspect-h-1 bg-gray-800 rounded-lg overflow-hidden">
                  <img src={char.characterImages[0]?.imageUrl || 'https://placehold.co/300x300/1a1a1a/ffffff?text=?'} alt={char.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
                </div>
                <h3 className="mt-2 font-bold truncate">{char.name}</h3>
                <p className="text-sm text-gray-400 truncate h-10">{char.description}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <div className="flex items-center mr-2">
                    <MessageSquare size={12} className="mr-1" /> {char._count.interactions}
                  </div>
                  <div className="flex items-center">
                    <Heart size={12} className="mr-1" /> {char._count.favorites}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
