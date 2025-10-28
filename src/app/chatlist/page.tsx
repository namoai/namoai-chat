"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { VscChevronLeft } from "react-icons/vsc";
import { BsThreeDotsVertical } from "react-icons/bs";

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

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#1c1c1e] text-gray-400">ローディング中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#1c1c1e] p-4 font-sans text-[#f2f2f7]">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <header className="mb-5 flex items-center justify-between">
        {isSelectionMode ? (
          <button onClick={cancelSelectionMode} className="text-pink-400">キャンセル</button>
        ) : (
          <button onClick={() => router.back()} className="rounded-full p-1 hover:bg-gray-700">
            <VscChevronLeft size={24} />
          </button>
        )}
        <h1 className="text-lg font-semibold">
          {isSelectionMode ? `${selectedChatIds.size}件選択中` : 'チャット'}
        </h1>
        {isSelectionMode ? (
          <button onClick={handleBulkDelete} className="text-pink-400 disabled:text-gray-500" disabled={selectedChatIds.size === 0}>
            削除
          </button>
        ) : (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <BsThreeDotsVertical size={20} className="cursor-pointer" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-gray-700 rounded-md shadow-lg z-10">
                <button onClick={enterSelectionMode} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-600">
                  選択削除
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {!isSelectionMode && (
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="チャット検索"
            className="w-full rounded-lg border-none bg-[#2c2c2e] p-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      )}

      <main>
        {chats.length > 0 ? (
          chats.map((chat) => (
            <div key={chat.id} className={`mb-4 flex items-center rounded-xl p-2 transition-colors ${isSelectionMode ? 'hover:bg-[#2c2c2e]' : ''}`}>
              {isSelectionMode && (
                <input
                  type="checkbox"
                  checked={selectedChatIds.has(chat.id)}
                  onChange={() => handleToggleSelection(chat.id)}
                  className="flex-shrink-0 w-5 h-5 mr-3 accent-pink-500 cursor-pointer"
                  style={{ minWidth: '20px', minHeight: '20px' }}
                />
              )}
              <Link href={isSelectionMode ? '#' : `/chat/${chat.characterId}?chatId=${chat.id}`} className="flex flex-grow items-start overflow-hidden">
                <Image
                  src={chat.characters.characterImages[0]?.imageUrl || "/avatars/default.png"}
                  alt={chat.characters.name}
                  width={50}
                  height={50}
                  className="mr-3 rounded-full object-cover"
                />
                <div className="flex-grow overflow-hidden">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-base font-medium text-gray-200">
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
          ))
        ) : (
          <p className="pt-12 text-center text-gray-500">チャット履歴がありません。</p>
        )}
      </main>
    </div>
  );
}
