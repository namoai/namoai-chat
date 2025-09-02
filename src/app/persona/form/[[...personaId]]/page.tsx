"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// FormDataの型定義
type PersonaData = {
  nickname: string;
  age: number | null;
  gender: '女性' | '男性' | null;
  description: string;
};

// モーダルコンポーネントのPropsの型定義
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isAlert?: boolean;
};

// 汎用モーダルコンポーネント
const CustomModal = ({ isOpen, onClose, onConfirm, title, message, isAlert }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-gray-800 text-white rounded-lg p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        <p className="text-sm text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button onClick={onConfirm} className="bg-pink-600 hover:bg-pink-700 py-2 px-4 rounded-lg">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PersonaFormPage() {
  const router = useRouter();
  const params = useParams();
  
  const personaId = params.personaId?.[0]; 
  const isEditMode = !!personaId;

  const [formData, setFormData] = useState<PersonaData>({
    nickname: '',
    age: null,
    gender: null,
    description: '',
  });
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ▼▼▼【修正点】モーダル用のstateを追加 ▼▼▼
  const [modalState, setModalState] = useState<Omit<ModalProps, 'onClose' | 'onConfirm'>>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    if (isEditMode) {
      const fetchPersona = async () => {
        try {
          const response = await fetch(`/api/persona/${personaId}`);
          if (!response.ok) throw new Error('ペルソナ情報の読み込みに失敗しました。');
          const data = await response.json();
          setFormData({
              nickname: data.nickname,
              age: data.age,
              gender: data.gender,
              description: data.description,
          });
        } catch (error) {
          console.error(error);
          // ▼▼▼【修正点】alertをモーダルに変更 ▼▼▼
          setModalState({
            isOpen: true,
            title: '読み込みエラー',
            message: (error as Error).message,
            isAlert: true,
          });
          router.push('/persona/list'); // エラー時は一覧へ
        } finally {
          setIsLoading(false);
        }
      };
      fetchPersona();
    }
  }, [isEditMode, personaId, router]);

  const closeModal = () => setModalState(prev => ({ ...prev, isOpen: false }));

  const handleChange = (field: keyof PersonaData, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, age: value === '' ? null : Number(value) }));
  };

  const handleSave = async () => {
    if (isSubmitting || !formData.nickname || !formData.description) return;
    setIsSubmitting(true);

    const url = isEditMode ? `/api/persona/${personaId}` : '/api/persona';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...formData,
            age: formData.age ? Number(formData.age) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存に失敗しました。');
      }

      // ▼▼▼【修正点】alertをモーダルに変更 ▼▼▼
      setModalState({
        isOpen: true,
        title: '成功',
        message: isEditMode ? 'ペルソナが更新されました。' : 'ペルソナが作成されました。',
        isAlert: true,
      });
      // モーダルを閉じた後にページ遷移
    } catch (error) {
      console.error(error);
      // ▼▼▼【修正点】alertをモーダルに変更 ▼▼▼
      setModalState({
        isOpen: true,
        title: '保存エラー',
        message: (error as Error).message,
        isAlert: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleModalConfirm = () => {
    closeModal();
    // 成功メッセージの時だけリストページに戻る
    if (modalState.title === '成功') {
      router.push('/persona/list');
      router.refresh();
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">ローディング中...</div>;
  }

  return (
    <>
      <CustomModal 
        {...modalState}
        onClose={closeModal}
        onConfirm={handleModalConfirm}
      />
      <div className="bg-black min-h-screen text-white p-4">
        <header className="flex justify-between items-center py-4">
          {/* ▼▼▼【修正点】router.back()を使用して前のページに戻るように変更 ▼▼▼ */}
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">{isEditMode ? 'ペルソナ修正' : 'ペルソナ追加'}</h1>
          <button
            onClick={handleSave}
            className={`font-bold py-2 px-3 rounded-lg transition-colors disabled:cursor-not-allowed ${
              formData.nickname && formData.description 
              ? 'text-white hover:bg-gray-800 cursor-pointer' 
              : 'text-gray-600'
            }`}
            disabled={!formData.nickname || !formData.description || isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </header>
        <main className="mt-8 space-y-8">
          <div>
            <label className="text-sm font-bold text-white">ニックネーム <span className="text-red-500">*</span></label>
            <div className="relative mt-2">
              <input type="text" value={formData.nickname} onChange={(e) => handleChange('nickname', e.target.value)} maxLength={20} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{formData.nickname.length}/20</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-white">年齢</label>
            <input type="number" value={formData.age ?? ''} onChange={handleAgeChange} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 mt-2 focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <div>
            <label className="text-sm font-bold text-white">性別</label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <button onClick={() => handleChange('gender', '女性')} className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${formData.gender === '女性' ? 'bg-pink-500/20 border-pink-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>女性</button>
              <button onClick={() => handleChange('gender', '男性')} className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${formData.gender === '男性' ? 'bg-pink-500/20 border-pink-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>男性</button>
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-white">詳細情報 <span className="text-red-500">*</span></label>
            <div className="relative mt-2">
              <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)} maxLength={1000} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 h-40 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500" />
              <span className="absolute right-3 bottom-3 text-sm text-gray-400">{formData.description.length}/1000</span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
