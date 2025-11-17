"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Check, Trash2, Pencil, ArrowLeft, HelpCircle } from 'lucide-react';
import HelpModal from '@/components/HelpModal';

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  const personaQuery = searchParams.toString();

  const helpContent = (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-pink-400 mb-3">ペルソナとは？</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          ペルソナは、あなたがキャラクターと会話する際の役割を定義する設定です。
          ニックネーム、年齢、性別、詳細情報を設定することで、キャラクターはその情報を参考にして会話を生成します。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
          <h3 className="text-base font-semibold text-pink-300 mb-3">基本ペルソナの設定</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>ペルソナカードをクリックすると、そのペルソナが基本ペルソナとして設定されます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>チェックマークが表示されているペルソナが現在の基本ペルソナです</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>新しくチャットを開始すると、基本ペルソナの情報が使用されます</span>
            </li>
          </ul>
        </div>

        <div className="bg-black/30 border border-gray-800/80 rounded-xl p-4">
          <h3 className="text-base font-semibold text-pink-300 mb-3">ペルソナの作成・編集</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>「ペルソナ追加」ボタンで新しいペルソナを作成できます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>各ペルソナカードの編集アイコン（鉛筆）から編集できます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-400 mt-0.5">•</span>
              <span>削除アイコン（ゴミ箱）でペルソナを削除できます</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <h3 className="text-base font-semibold text-blue-400 mb-2">プライバシーについて</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          生成されたキャラクターの制作者は、あなたの基本プロフィールとニックネームを閲覧できます。
          詳細情報は制作者には表示されませんので、安心して使用してください。
        </p>
      </div>
    </div>
  );

  return (
    <>
      <CustomModal state={modalState} />
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="ペルソナについて"
        content={helpContent}
      />
      <div className="bg-black min-h-screen text-white">
        {/* 背景装飾 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
            <header className="text-center py-6 mb-6 relative">
              <button 
                onClick={handleGoBack} 
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                ペルソナ
              </h1>
              <button 
                onClick={() => setIsHelpOpen(true)} 
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-pink-500/10 hover:text-pink-400 transition-all"
              >
                <HelpCircle size={24} />
              </button>
            </header>
            <div className="mb-8 bg-gray-900/60 border border-gray-800/60 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <p className="text-sm text-gray-300 leading-relaxed">ペルソナを設定して、役割に合ったキャラクターと会話できます。</p>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="w-full md:w-auto bg-gray-800/70 border border-pink-400/40 text-pink-300 font-semibold px-4 py-2 rounded-xl hover:bg-pink-500/10 transition-all"
                >
                  詳細を見る
                </button>
              </div>
            </div>
            <main className="space-y-4">
              {personas.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleSelectPersona(p.id)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all border relative group ${
                    selectedId === p.id 
                      ? 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/50 shadow-lg shadow-pink-500/20' 
                      : 'bg-gray-900/50 backdrop-blur-sm border-gray-800/50 hover:border-pink-500/30 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-grow min-w-0 pr-16">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`font-bold text-lg ${selectedId === p.id ? 'text-pink-400' : 'text-white group-hover:text-pink-400'} transition-colors`}>
                          {p.nickname}
                        </h3>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedId === p.id 
                            ? 'border-pink-500 bg-pink-500 shadow-lg shadow-pink-500/50' 
                            : 'border-gray-500 group-hover:border-pink-500/50'
                        }`}>
                          {selectedId === p.id && <Check size={16} className="text-white" />}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{p.gender || '未設定'} | {p.age ? `${p.age}歳` : '未設定'}</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="absolute top-4 right-4 flex gap-1">
                      <Link 
                        href={`/persona/form/${p.id}?${personaQuery}`} 
                        onClick={(e) => e.stopPropagation()} 
                        className="p-2 text-gray-400 hover:text-pink-400 hover:bg-pink-500/10 rounded-xl transition-all"
                      >
                        <Pencil size={18} />
                      </Link>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(p); }} 
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <Link 
                href={`/persona/form?${personaQuery}`} 
                className="w-full flex items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-700/50 rounded-2xl text-gray-400 hover:bg-gray-900/50 hover:border-pink-500/50 hover:text-pink-400 transition-all group"
              >
                <Plus size={20} className="group-hover:scale-110 transition-transform" />
                <span className="font-semibold">ペルソナ追加</span>
              </Link>
            </main>
          </div>
        </div>
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
