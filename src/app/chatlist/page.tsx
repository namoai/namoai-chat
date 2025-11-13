"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { VscChevronLeft } from "react-icons/vsc";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Search } from "lucide-react";

// 型定義
type ChatData = {
  id: number;
  updatedAt: string;
  characterId: number;
  characters: {
    name: string;
    characterImages: { imageUrl: string }[];
  };
  chat_message: { content: string }[];
};

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => {
    modalState.onCancel?.();
    setModalState({ ...modalState, isOpen: false });
  };
  const handleConfirm = () => {
    modalState.onConfirm?.();
    setModalState({ ...modalState, isOpen: false });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
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
// ▲▲▲【追加完了】▲▲▲

export default function ChatListPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<number>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // 検索クエリの状態を追加
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch("/api/chatlist");
        if (!response.ok) throw new Error("データ取得失敗");
        const data = await response.json();
        setChats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleSelection = (chatId: number) => {
    setSelectedChatIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  // ▼▼▼【修正点】confirmとalertをモーダルに置き換え ▼▼▼
  const handleBulkDelete = async () => {
    if (selectedChatIds.size === 0) {
      setModalState({ isOpen: true, title: '情報', message: '削除するチャットを選択してください。', isAlert: true });
      return;
    }

    setModalState({
      isOpen: true,
      title: 'チャット履歴の削除',
      message: `${selectedChatIds.size}件のチャット履歴を本当に削除しますか？`,
      confirmText: '削除',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/chatlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatIds: Array.from(selectedChatIds) }),
          });

          if (!response.ok) throw new Error('チャットの削除に失敗しました。');
          
          setChats(current => current.filter(chat => !selectedChatIds.has(chat.id)));
          setModalState({ isOpen: true, title: '成功', message: `${selectedChatIds.size}件のチャットを削除しました。`, isAlert: true });
          setIsSelectionMode(false);
          setSelectedChatIds(new Set());

        } catch (error) {
          console.error(error);
          setModalState({ isOpen: true, title: 'エラー', message: (error as Error).message, isAlert: true });
        }
      }
    });
  };
  // ▲▲▲【修正完了】▲▲▲

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setIsMenuOpen(false);
  };
  
  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedChatIds(new Set());
  };

  // 検索フィルタリング機能を追加
  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const characterName = chat.characters.name.toLowerCase();
    const lastMessage = chat.chat_message[0]?.content?.toLowerCase() || '';
    return characterName.includes(query) || lastMessage.includes(query);
  });

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
    <div className="min-h-screen bg-black text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          <ConfirmationModal modalState={modalState} setModalState={setModalState} />
          
          <header className="mb-6 flex items-center justify-between">
            {isSelectionMode ? (
              <button onClick={cancelSelectionMode} className="text-pink-400 hover:text-pink-300 transition-colors">
                キャンセル
              </button>
            ) : (
              <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all">
                <VscChevronLeft size={24} />
              </button>
            )}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              {isSelectionMode ? `${selectedChatIds.size}件選択中` : 'チャット'}
            </h1>
            {isSelectionMode ? (
              <button 
                onClick={handleBulkDelete} 
                className="text-pink-400 hover:text-pink-300 disabled:text-gray-500 transition-colors" 
                disabled={selectedChatIds.size === 0}
              >
                削除
              </button>
            ) : (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-xl hover:bg-gray-800/50 transition-all">
                  <BsThreeDotsVertical size={20} />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-lg z-10 border border-gray-700/50">
                    <button onClick={enterSelectionMode} className="w-full text-left px-4 py-2 text-sm hover:bg-pink-500/10 hover:text-pink-400 transition-colors rounded-xl">
                      選択削除
                    </button>
                  </div>
                )}
              </div>
            )}
          </header>

          {!isSelectionMode && (
            <div className="relative mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="チャット検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/50 backdrop-blur-sm p-3 pl-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all"
                />
              </div>
            </div>
          )}

          <main>
            {filteredChats.length > 0 ? (
              <div className="space-y-3">
                {filteredChats.map((chat) => (
                  <div 
                    key={chat.id} 
                    className={`group flex items-center rounded-xl p-4 transition-all border ${
                      isSelectionMode 
                        ? 'hover:bg-gray-800/50 border-gray-800/50' 
                        : 'bg-gray-900/50 backdrop-blur-sm border-gray-800/50 hover:border-pink-500/30 hover:bg-gray-800/50'
                    }`}
                  >
                    {isSelectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedChatIds.has(chat.id)}
                        onChange={() => handleToggleSelection(chat.id)}
                        className="flex-shrink-0 w-5 h-5 mr-3 accent-pink-500 cursor-pointer"
                        style={{ minWidth: '20px', minHeight: '20px' }}
                      />
                    )}
                    <Link 
                      href={isSelectionMode ? '#' : `/chat/${chat.characterId}?chatId=${chat.id}`} 
                      className="flex flex-grow items-start overflow-hidden"
                    >
                      <div className="relative w-14 h-14 mr-4 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                        <Image
                          src={chat.characters.characterImages[0]?.imageUrl || "/avatars/default.png"}
                          alt={chat.characters.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                          sizes="56px"
                        />
                      </div>
                      <div className="flex-grow overflow-hidden min-w-0">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="truncate text-base font-semibold text-white group-hover:text-pink-400 transition-colors">
                            {chat.characters.name}
                          </span>
                          <span className="ml-2 flex-shrink-0 text-xs text-gray-500">
                            {new Date(chat.updatedAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        <p className="truncate text-sm text-gray-400">
                          {chat.chat_message[0]?.content || "まだメッセージがありません。"}
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pt-12 text-center">
                <p className="text-gray-500 text-lg">
                  {searchQuery.trim() ? '検索結果がありません。' : 'チャット履歴がありません。'}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
