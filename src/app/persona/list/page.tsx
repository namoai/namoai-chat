"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Check, Trash2, Pencil, ArrowLeft } from 'lucide-react';

type Persona = {
  id: number;
  nickname: string;
  age: number | null;
  gender: string | null;
  description: string;
};

// モーダル用のProps型定義
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

// 汎用モーダルコンポーネント
const CustomModal = ({ state }: { state: ModalState }) => {
  if (!state.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4 text-white">{state.title}</h2>
        <p className="text-sm text-gray-200 mb-6 whitespace-pre-wrap">{state.message}</p>
        <div className={`flex justify-end gap-4`}>
          {!state.isAlert && (
            <button onClick={state.onClose} className="border border-gray-600 text-white hover:bg-gray-700 py-2 px-4 rounded-lg transition-colors cursor-pointer">キャンセル</button>
          )}
          <button onClick={state.onConfirm} className={`${state.confirmText === '削除' ? 'bg-red-600 hover:bg-red-700' : 'bg-pink-600 hover:bg-pink-700'} text-white py-2 px-4 rounded-lg transition-colors cursor-pointer`}>
            {state.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 本体コンポーネント
function PersonaListComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false, title: '', message: '', onConfirm: () => {}, onClose: () => {}
  });

  const fromChat = searchParams.get('fromChat') === 'true';
  const characterId = searchParams.get('characterId');
  const chatId = searchParams.get('chatId');

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/persona');
        if (!response.ok) throw new Error('データの読み込みに失敗しました。');
        
        const data = await response.json();
        setPersonas(data.personas);
        setSelectedId(data.defaultPersonaId);
      } catch (error) {
        setModalState({
          isOpen: true,
          title: 'エラー',
          message: (error as Error).message,
          isAlert: true,
          onConfirm: () => setModalState(prev => ({...prev, isOpen: false})),
          onClose: () => {}
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPersonas();
  }, []);

  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleSelectPersona = async (id: number) => {
    if (id === selectedId) return;
    const originalSelectedId = selectedId;
    setSelectedId(id);

    try {
      const response = await fetch('/api/persona', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: id }),
      });
      if (!response.ok) throw new Error('基本ペルソナの設定に失敗しました。');
    } catch (error) {
      setSelectedId(originalSelectedId);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: (error as Error).message,
        isAlert: true,
        onConfirm: closeModal,
        onClose: closeModal,
      });
    }
  };

  const openDeleteModal = (persona: Persona) => {
    setModalState({
      isOpen: true,
      title: 'ペルソナ削除',
      message: `「${persona.nickname}」を本当に削除しますか？\nこの操作は元に戻せません。`,
      confirmText: '削除',
      onConfirm: () => handleDeletePersona(persona.id),
      onClose: closeModal,
    });
  };

  const handleDeletePersona = async (id: number) => {
    try {
      const response = await fetch(`/api/persona/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '削除に失敗しました。');
      }
      
      const fetchResponse = await fetch('/api/persona');
      const data = await fetchResponse.json();
      setPersonas(data.personas);
      setSelectedId(data.defaultPersonaId);
    } catch (error) {
       setModalState({
        isOpen: true,
        title: 'エラー',
        message: (error as Error).message,
        isAlert: true,
        onConfirm: closeModal,
        onClose: closeModal,
      });
    } finally {
      closeModal();
    }
  };
  
  // ▼▼▼【修正】戻るロジックを修正 ▼▼▼
  const handleGoBack = () => {
    if (fromChat && characterId && chatId) {
      // チャットルームから来た場合、replaceを使用して閲覧履歴を残さずに戻ります。
      router.replace(`/chat/${characterId}?chatId=${chatId}`);
    } else {
      // その他の場合（マイページなど）、標準の戻る機能を使用します。
      router.back();
    }
  };
  // ▲▲▲【修正完了】▲▲▲

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">ローディング中...</div>;
  }

  const personaQuery = searchParams.toString();

  return (
    <>
      <CustomModal state={modalState} />
      <div className="bg-black min-h-screen text-white p-4">
        <header className="text-center py-4 relative">
          <button 
            onClick={handleGoBack} 
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">ペルソナ</h1>
        </header>
        <div className="mt-4">
          <p className="text-sm text-gray-400">ペルソナを設定して、役割に合ったキャラクターと会話できます。</p>
          <p className="text-sm text-gray-400 mt-1">生成されたキャラクターの制作者は、あなたの基本プロフィールとニックネームを閲覧できます。</p>
        </div>
        <main className="mt-6 space-y-4">
          {personas.map(p => (
            <div 
              key={p.id}
              onClick={() => handleSelectPersona(p.id)}
              className={`p-4 rounded-lg cursor-pointer transition-all border relative ${selectedId === p.id ? 'bg-pink-500/20 border-pink-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{p.nickname}</h3>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${selectedId === p.id ? 'border-pink-500 bg-pink-500' : 'border-gray-500'}`}>
                      {selectedId === p.id && <Check size={14} className="text-white" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{p.gender || '未設定'} | {p.age ? `${p.age}歳` : '未設定'}</p>
                  <p className="text-sm text-gray-300 mt-2 pr-16 truncate">{p.description}</p>
                </div>
                <div className="absolute top-3 right-3 flex gap-1">
                  <Link href={`/persona/form/${p.id}?${personaQuery}`} onClick={(e) => e.stopPropagation()} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors cursor-pointer">
                    <Pencil size={16} />
                  </Link>
                  <button onClick={(e) => { e.stopPropagation(); openDeleteModal(p); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full transition-colors cursor-pointer">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Link href={`/persona/form?${personaQuery}`} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800 hover:border-gray-500 transition-colors cursor-pointer">
            <Plus size={20} />
            ペルソナ追加
          </Link>
        </main>
      </div>
    </>
  );
}

export default function PersonaListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">読み込み中...</div>}>
      <PersonaListComponent />
    </Suspense>
  );
}
