"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, MoreVertical, Edit, Trash2, Eye, EyeOff, ArrowLeft } from 'lucide-react';

// 型定義
type Character = {
  id: number;
  name: string;
  description: string | null;
  visibility: string | null;
  author: { nickname: string | null } | null;
  characterImages: { imageUrl: string }[];
};

// ケバブメニューコンポーネント
const KebabMenu = ({ character, onAction }: { character: Character, onAction: (action: string, char: Character) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (action: string) => {
    setIsOpen(false);
    onAction(action, character);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-gray-700">
        <MoreVertical size={20} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-20 text-sm">
          <button onClick={() => handleAction('toggleVisibility')} className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-700">
            {character.visibility === 'private' ? <Eye size={16} /> : <EyeOff size={16} />}
            {character.visibility === 'private' ? '公開に切り替え' : '非公開に切り替え'}
          </button>
          <button onClick={() => handleAction('edit')} className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-700">
            <Edit size={16} /> 修正
          </button>
          <button onClick={() => handleAction('delete')} className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-red-400">
            <Trash2 size={16} /> 削除
          </button>
        </div>
      )}
    </div>
  );
};

export default function AdminCharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 権限チェック
  useEffect(() => {
    const checkSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const sessionData = await res.json();
            if (!sessionData || Object.keys(sessionData).length === 0) {
                router.push('/login');
                return;
            }
            const userRole = sessionData.user?.role;
            if (userRole !== 'CHAR_MANAGER' && userRole !== 'SUPER_ADMIN') {
                alert('このページにアクセスする権限がありません。');
                router.push('/admin');
            }
        } catch (error) {
            router.push('/login');
        }
    };
    checkSession();
  }, [router]);

  // データ取得
  const fetchCharacters = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/characters?page=${page}&search=${search}`);
      if (!response.ok) throw new Error('データ取得失敗');
      const data = await response.json();
      setCharacters(data.characters || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (error) {
      console.error(error);
      alert('キャラクター一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  // 検索クエリの遅延反映 (debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1); // 検索時は1ページ目に戻る
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ページまたは検索クエリ変更時にデータを再取得
  useEffect(() => {
    fetchCharacters(currentPage, debouncedQuery);
  }, [currentPage, debouncedQuery, fetchCharacters]);

  // ケバブメニューのアクション処理
  const handleMenuAction = async (action: string, char: Character) => {
    switch (action) {
      case 'toggleVisibility':
        const newVisibility = char.visibility === 'private' ? 'public' : 'private';
        if (confirm(`このキャラクターを「${newVisibility === 'public' ? '公開' : '非公開'}」に切り替えますか？`)) {
          const res = await fetch('/api/admin/characters', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: char.id, visibility: newVisibility }),
          });
          if (res.ok) {
            alert('状態を更新しました。');
            fetchCharacters(currentPage, debouncedQuery);
          } else {
            alert('更新に失敗しました。');
          }
        }
        break;
      case 'edit':
        router.push(`/characters/edit/${char.id}`);
        break;
      case 'delete':
        if (confirm(`「${char.name}」を本当に削除しますか？この操作は元に戻せません。`)) {
           const res = await fetch('/api/admin/characters', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: char.id }),
          });
          if (res.ok) {
            alert('キャラクターを削除しました。');
            fetchCharacters(currentPage, debouncedQuery);
          } else {
            alert('削除に失敗しました。');
          }
        }
        break;
    }
  };

  return (
    <div className="bg-black text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center mb-6">
          <button onClick={() => router.push('/admin')} className="p-2 rounded-full hover:bg-gray-700">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold ml-4">キャラクター管理</h1>
        </header>

        <div className="relative mb-6">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="キャラクター名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-pink-500 focus:border-pink-500"
          />
        </div>

        {loading ? (
          <p className="text-center py-16">読み込み中...</p>
        ) : (
          <>
            <div className="space-y-4">
              {characters.length > 0 ? characters.map(char => (
                <div key={char.id} className="bg-gray-900 p-4 rounded-lg flex items-center gap-4">
                  <Image
                    src={char.characterImages[0]?.imageUrl || 'https://placehold.co/64x64/1a1a1a/ffffff?text=?'}
                    alt={char.name}
                    width={64}
                    height={64}
                    className="rounded-md object-cover flex-shrink-0"
                  />
                  <div className="flex-grow overflow-hidden">
                    <p className="font-bold truncate">{char.name}</p>
                    <p className="text-sm text-gray-400 truncate">{char.description || '説明がありません'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      作成者: {char.author?.nickname || '不明'} | 状態: {char.visibility === 'private' ? '非公開' : '公開'}
                    </p>
                  </div>
                  <KebabMenu character={char} onAction={handleMenuAction} />
                </div>
              )) : (
                <p className="text-center text-gray-500 py-16">該当するキャラクターがいません。</p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50"
                >
                  前へ
                </button>
                <span className="font-semibold">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
