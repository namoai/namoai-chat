"use client";

import React, { useState, useEffect } from 'react';
// import { useSearchParams } from 'next/navigation'; // エラーの原因となるため削除
import { Plus, Check, Trash2, Pencil, ArrowLeft } from 'lucide-react';

type Persona = {
  id: number;
  nickname: string;
  age: number | null;
  gender: string | null;
  description: string;
};

// 確認モーダルコンポーネント
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
            <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
                <h2 className="text-lg font-bold mb-4">{title}</h2>
                <p className="text-sm text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="border border-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg transition-colors cursor-pointer">キャンセル</button>
                    <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg transition-colors cursor-pointer">削除</button>
                </div>
            </div>
        </div>
    );
};


const PersonaItem = ({ persona, onSelect, onEdit, onDelete, isSelected }: { persona: Persona; onSelect: (id: number) => void; onEdit: (id: number) => void; onDelete: (persona: Persona) => void; isSelected: boolean; }) => (
  <div 
    onClick={() => onSelect(persona.id)}
    className={`p-4 rounded-lg cursor-pointer transition-all border relative ${isSelected ? 'bg-pink-500/20 border-pink-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}
  >
    <div className="flex justify-between items-start">
        <div className="flex-grow">
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-white">{persona.nickname}</h3>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'border-pink-500 bg-pink-500' : 'border-gray-500'}`}>
                    {isSelected && <Check size={14} className="text-white" />}
                </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">{persona.gender || '未設定'} | {persona.age ? `${persona.age}歳` : '未設定'}</p>
            <p className="text-sm text-gray-300 mt-2 pr-16 truncate">{persona.description}</p>
        </div>
        <div className="absolute top-3 right-3 flex gap-1">
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(persona.id); }} 
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
                aria-label={`${persona.nickname}を編集`}
            >
                <Pencil size={16} />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(persona); }} 
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded-full transition-colors cursor-pointer"
                aria-label={`${persona.nickname}を削除`}
            >
                <Trash2 size={16} />
            </button>
        </div>
    </div>
  </div>
);

// ▼▼▼【ここから修正】Suspenseとコンポーネント分離を解除し、標準APIを使用 ▼▼▼
export default function PersonaListPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ isOpen: boolean; personaToDelete: Persona | null }>({ isOpen: false, personaToDelete: null });
  
  // URLクエリパラメータをstateで管理
  const [queryParams, setQueryParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    // クライアントサイドでのみ実行されるようにし、URLSearchParamsを取得
    setQueryParams(new URLSearchParams(window.location.search));

    const fetchPersonas = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/persona');
        if (!response.ok) throw new Error('データの読み込みに失敗しました。');
        
        const data = await response.json();
        setPersonas(data.personas);
        setSelectedId(data.defaultPersonaId);
      } catch (error) {
        console.error(error);
        alert((error as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonas();
  }, []);

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
      console.error(error);
      alert((error as Error).message);
      setSelectedId(originalSelectedId);
    }
  };

  const handleEditPersona = (id: number) => {
    const query = queryParams ? `?${queryParams.toString()}` : '';
    window.location.href = `/persona/form/${id}${query}`;
  };

  const openDeleteModal = (persona: Persona) => {
    setModal({ isOpen: true, personaToDelete: persona });
  };

  const closeDeleteModal = () => {
    setModal({ isOpen: false, personaToDelete: null });
  };

  const handleDeletePersona = async () => {
    if (!modal.personaToDelete) return;

    try {
      const response = await fetch(`/api/persona/${modal.personaToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '削除に失敗しました。');
      }
      
      const fetchResponse = await fetch('/api/persona');
      const data = await fetchResponse.json();
      setPersonas(data.personas);
      setSelectedId(data.defaultPersonaId);

    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    } finally {
      closeDeleteModal();
    }
  };
  
  const handleGoBack = () => {
    if (queryParams?.get('fromChat') && queryParams?.get('characterId') && queryParams?.get('chatId')) {
      window.location.href = `/chat/${queryParams.get('characterId')}?chatId=${queryParams.get('chatId')}`;
    } else {
        window.history.back();
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">ローディング中...</div>;
  }

  return (
    <>
      <ConfirmationModal
        isOpen={modal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeletePersona}
        title="ペルソナ削除"
        message={`「${modal.personaToDelete?.nickname}」を本当に削除しますか？\nこの操作は元に戻せません。`}
      />
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
            <PersonaItem 
              key={p.id} 
              persona={p} 
              onSelect={handleSelectPersona} 
              onEdit={handleEditPersona}
              onDelete={openDeleteModal}
              isSelected={selectedId === p.id}
            />
          ))}
          <button 
            onClick={() => {
                const query = queryParams ? `?${queryParams.toString()}` : '';
                window.location.href = `/persona/form${query}`;
            }}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-800 hover:border-gray-500 transition-colors cursor-pointer"
          >
            <Plus size={20} />
            ペルソナ追加
          </button>
        </main>
      </div>
    </>
  );
}
// ▲▲▲【ここまで修正】▲▲▲
