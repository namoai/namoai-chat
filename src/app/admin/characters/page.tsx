"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// ▼▼▼【修正点】未使用の 'X' アイコンを削除しました ▼▼▼
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

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

// 汎用モーダルコンポーネント
const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => setModalState({ ...modalState, isOpen: false });
  const handleConfirm = () => {
    modalState.onConfirm?.();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
        <p className="text-gray-200 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors">
              キャンセル
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'} rounded-lg transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });

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
                setModalState({ isOpen: true, title: '権限エラー', message: 'このページにアクセスする権限がありません。', onConfirm: () => router.push('/admin'), isAlert: true });
            }
        } catch (err) {
            console.error("セッション確認エラー:", err);
            router.push('/login');
        }
    };
    checkSession();
  }, [router]);

  const fetchCharacters = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/characters?page=${page}&search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('データ取得失敗');
      const data = await response.json();
      setCharacters(data.characters || []);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (error) {
      console.error(error);
      setModalState({ isOpen: true, title: 'エラー', message: 'キャラクター一覧の取得に失敗しました。', isAlert: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchCharacters(currentPage, debouncedQuery);
  }, [currentPage, debouncedQuery, fetchCharacters]);

  const handleMenuAction = (action: string, char: Character) => {
    switch (action) {
      case 'toggleVisibility':
        const newVisibility = char.visibility === 'private' ? 'public' : 'private';
        setModalState({
          isOpen: true,
          title: '状態の切り替え',
          message: `このキャラクターを「${newVisibility === 'public' ? '公開' : '非公開'}」に切り替えますか？`,
          confirmText: '切り替え',
          onConfirm: async () => {
            const res = await fetch('/api/admin/characters', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: char.id, visibility: newVisibility }),
            });
            if (res.ok) {
              setModalState({ isOpen: true, title: '成功', message: '状態を更新しました。', isAlert: true });
              fetchCharacters(currentPage, debouncedQuery);
            } else {
              setModalState({ isOpen: true, title: 'エラー', message: '更新に失敗しました。', isAlert: true });
            }
          }
        });
        break;
      case 'edit':
        router.push(`/character-management/edit/${char.id}`);
        break;
      case 'delete':
        setModalState({
          isOpen: true,
          title: 'キャラクター削除',
          message: `「${char.name}」を本当に削除しますか？この操作は元に戻せません。`,
          confirmText: '削除',
          onConfirm: async () => {
             const res = await fetch('/api/admin/characters', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: char.id }),
            });
            if (res.ok) {
              setModalState({ isOpen: true, title: '成功', message: 'キャラクターを削除しました。', isAlert: true });
              fetchCharacters(1, '');
            } else {
              setModalState({ isOpen: true, title: 'エラー', message: '削除に失敗しました。', isAlert: true });
            }
          }
        });
        break;
    }
  };

  return (
    <div className="bg-black text-white min-h-screen p-4 sm:p-8">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />

      <div className="max-w-7xl mx-auto">
        <header className="flex items-center mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-700">
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
                <div key={char.id} className="bg-gray-900 p-4 rounded-lg flex items-center gap-4 flex-wrap">
                  <Link href={`/characters/${char.id}`} className="flex items-center gap-4 flex-grow min-w-[200px]">
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
                  </Link>
                  <div className="ml-auto">
                    <KebabMenu character={char} onAction={handleMenuAction} />
                  </div>
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