"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// ▼▼▼【修正点】未使用の 'X' アイコンを削除しました ▼▼▼
import { Search, MoreVertical, Edit, Trash2, Eye, EyeOff, ArrowLeft, Star, StarOff, Download, Upload } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';

// 型定義
type Character = {
  id: number;
  name: string;
  description: string | null;
  visibility: string | null;
  isOfficial?: boolean;
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
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const MENU_WIDTH = 192;

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - MENU_WIDTH,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current?.contains(event.target as Node) ||
        menuRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      updateMenuPosition();
      window.addEventListener("scroll", updateMenuPosition, true);
      window.addEventListener("resize", updateMenuPosition);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  const handleAction = (action: string) => {
    setIsOpen(false);
    onAction(action, character);
  };

  return (
    <>
      <button ref={buttonRef} onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
        <MoreVertical size={20} />
      </button>
      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="absolute w-48 bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl z-[9999] text-sm border border-gray-700/50 py-2"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button onClick={() => handleAction('toggleOfficial')} className="w-full text-left flex items-center gap-2 px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 group">
              {character.isOfficial ? <StarOff size={16} className="text-yellow-400 group-hover:scale-110 group-hover:text-yellow-300 transition-all duration-300" /> : <Star size={16} className="text-yellow-400 group-hover:scale-110 group-hover:text-yellow-300 transition-all duration-300" />}
              <span className="group-hover:translate-x-1 transition-transform duration-300">{character.isOfficial ? 'ナモアイフレンズから削除' : 'ナモアイフレンズに登録'}</span>
            </button>
            <button onClick={() => handleAction('toggleVisibility')} className="w-full text-left flex items-center gap-2 px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 group">
              {character.visibility === 'private' ? <Eye size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> : <EyeOff size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" />}
              <span className="group-hover:translate-x-1 transition-transform duration-300">{character.visibility === 'private' ? '公開に切り替え' : '非公開に切り替え'}</span>
            </button>
            <button onClick={() => handleAction('export')} className="w-full text-left flex items-center gap-2 px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 group">
              <Download size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
              <span className="group-hover:translate-x-1 transition-transform duration-300">エクスポート</span>
            </button>
            <button onClick={() => handleAction('edit')} className="w-full text-left flex items-center gap-2 px-4 py-2 !text-white hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 hover:text-pink-300 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-300 group">
              <Edit size={16} className="text-white group-hover:scale-110 group-hover:text-pink-400 transition-all duration-300" /> 
              <span className="group-hover:translate-x-1 transition-transform duration-300">修正</span>
            </button>
            <button onClick={() => handleAction('delete')} className="w-full text-left flex items-center gap-2 px-4 py-2 !text-red-400 hover:bg-gradient-to-r hover:from-red-500/20 hover:via-pink-500/20 hover:to-red-500/20 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/30 transition-all duration-300 group">
              <Trash2 size={16} className="text-red-400 group-hover:scale-110 group-hover:text-red-300 transition-all duration-300" /> 
              <span className="group-hover:translate-x-1 transition-transform duration-300">削除</span>
            </button>
          </div>,
          document.body
        )}
    </>
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCharacterId, setImportCharacterId] = useState<number | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportCharacter = async (characterId: number) => {
    try {
      const response = await fetch(`/api/characters/${characterId}/export`);
      if (!response.ok) {
        throw new Error('エクスポートに失敗しました');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `character_${characterId}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setModalState({ isOpen: true, title: '成功', message: 'キャラクターをエクスポートしました。', isAlert: true });
    } catch (error) {
      console.error('Export error:', error);
      setModalState({ isOpen: true, title: 'エラー', message: 'エクスポートに失敗しました。', isAlert: true });
    }
  };

  const handleImportCharacter = async (characterId: number, file: File) => {
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchWithCsrf(`/api/characters/${characterId}/import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'インポートに失敗しました');
      }

      setModalState({ isOpen: true, title: '成功', message: 'キャラクターをインポートしました。', isAlert: true });
      setImportModalOpen(false);
      setImportCharacterId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchCharacters(currentPage, debouncedQuery);
    } catch (error) {
      console.error('Import error:', error);
      setModalState({ 
        isOpen: true, 
        title: 'エラー', 
        message: error instanceof Error ? error.message : 'インポートに失敗しました。', 
        isAlert: true 
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setModalState({ isOpen: true, title: 'エラー', message: 'ZIPファイルを選択してください。', isAlert: true });
      return;
    }

    if (importCharacterId) {
      handleImportCharacter(importCharacterId, file);
    }
  };

  const handleMenuAction = (action: string, char: Character) => {
    switch (action) {
      case 'toggleOfficial':
        const newOfficialStatus = !char.isOfficial;
        setModalState({
          isOpen: true,
          title: 'ナモアイフレンズ',
          message: `このキャラクターを${newOfficialStatus ? 'ナモアイフレンズに登録' : 'ナモアイフレンズから削除'}しますか？`,
          confirmText: newOfficialStatus ? '登録' : '削除',
          onConfirm: async () => {
            const res = await fetchWithCsrf('/api/admin/characters', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: char.id, isOfficial: newOfficialStatus }),
            });
            if (res.ok) {
              setModalState({ isOpen: true, title: '成功', message: `${newOfficialStatus ? 'ナモアイフレンズに登録' : 'ナモアイフレンズから削除'}しました。`, isAlert: true });
              fetchCharacters(currentPage, debouncedQuery);
            } else {
              setModalState({ isOpen: true, title: 'エラー', message: '更新に失敗しました。', isAlert: true });
            }
          }
        });
        break;
      case 'toggleVisibility':
        const newVisibility = char.visibility === 'private' ? 'public' : 'private';
        setModalState({
          isOpen: true,
          title: '状態の切り替え',
          message: `このキャラクターを「${newVisibility === 'public' ? '公開' : '非公開'}」に切り替えますか？`,
          confirmText: '切り替え',
          onConfirm: async () => {
            const res = await fetchWithCsrf('/api/admin/characters', {
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
      case 'export':
        handleExportCharacter(char.id);
        break;
      case 'delete':
        setModalState({
          isOpen: true,
          title: 'キャラクター削除',
          message: `「${char.name}」を本当に削除しますか？この操作は元に戻せません。`,
          confirmText: '削除',
          onConfirm: async () => {
             const res = await fetchWithCsrf('/api/admin/characters', {
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen" style={{ overflow: 'visible' }}>
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10" style={{ overflow: 'visible' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24" style={{ overflow: 'visible' }}>
          <ConfirmationModal modalState={modalState} setModalState={setModalState} />

          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-2xl md:text-3xl font-bold ml-4 bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                キャラクター管理
              </h1>
            </div>
            <button
              onClick={() => {
                const characterId = prompt('インポート先のキャラクターIDを入力してください:');
                if (characterId) {
                  const id = parseInt(characterId, 10);
                  if (!isNaN(id)) {
                    setImportCharacterId(id);
                    setImportModalOpen(true);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  } else {
                    setModalState({ isOpen: true, title: 'エラー', message: '無効なキャラクターIDです。', isAlert: true });
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 rounded-xl border border-pink-500/30 hover:border-pink-500/50 transition-all"
            >
              <Upload size={20} />
              <span>インポート</span>
            </button>
          </header>

          {/* インポートモーダル */}
          {importModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md m-4">
                <h2 className="text-xl font-bold mb-4 text-white">キャラクターインポート</h2>
                <p className="text-gray-200 mb-4">
                  キャラクターID: <span className="font-bold text-pink-400">{importCharacterId}</span>
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  ZIPファイルを選択してください。キャラクター情報、画像、ロアブックがインポートされます。
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportCharacterId(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors"
                    disabled={importLoading}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-500 rounded-lg transition-colors"
                    disabled={importLoading}
                  >
                    {importLoading ? 'インポート中...' : 'ファイルを選択'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="relative mb-6">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="キャラクター名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 rounded-xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all placeholder-gray-500"
            />
          </div>

          <div className="space-y-4" style={{ overflow: 'visible' }}>
            {characters.length > 0 ? characters.map(char => (
              <div key={char.id} className="bg-gray-900/50 backdrop-blur-sm p-4 md:p-6 rounded-2xl border border-gray-800/50 hover:border-pink-500/30 transition-all group relative" style={{ overflow: 'visible' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link href={`/characters/${char.id}`} className="flex items-center gap-4 flex-grow min-w-0 group/link">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-gray-800 to-gray-900 ring-2 ring-pink-500/20 group-hover:ring-pink-500/50 transition-all">
                      <Image
                        src={char.characterImages[0]?.imageUrl || 'https://placehold.co/80x80/1a1a1a/ffffff?text=?'}
                        alt={char.name}
                        fill
                        className="object-cover group-hover/link:scale-110 transition-transform duration-300"
                        sizes="80px"
                      />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold text-lg group-hover/link:text-pink-400 transition-colors truncate">{char.name}</p>
                        {char.isOfficial && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20 rounded-full text-xs text-pink-400 border border-pink-500/30">
                            <Star size={12} className="fill-pink-400" />
                            ナモアイフレンズ
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{char.description || '説明がありません'}</p>
                      <p className="text-xs text-gray-500">
                        作成者: <span className="text-gray-400">{char.author?.nickname || '不明'}</span> | 
                        状態: <span className={char.visibility === 'private' ? 'text-red-400' : 'text-green-400'}>
                          {char.visibility === 'private' ? '非公開' : '公開'}
                        </span>
                      </p>
                    </div>
                  </Link>
                  <div className="ml-auto flex-shrink-0">
                    <KebabMenu character={char} onAction={handleMenuAction} />
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">該当するキャラクターがいません。</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700/50"
              >
                前へ
              </button>
              <span className="font-semibold px-4">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-gray-700/50"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}