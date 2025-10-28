"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { notices as Notice } from '@prisma/client';

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
};

const NotificationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
    if (!modalState.isOpen) return null;

    const handleConfirm = () => {
        modalState.onConfirm?.();
        setModalState({ isOpen: false, title: '', message: '' });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex justify-center items-center">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
                <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
                <p className="text-gray-200 mb-6">{modalState.message}</p>
                <div className="flex justify-end">
                    <button onClick={handleConfirm} className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-500 rounded-lg transition-colors">
                        確認
                    </button>
                </div>
            </div>
        </div>
    );
};
// ▲▲▲【追加完了】▲▲▲

type NoticeFormProps = {
  initialData?: Notice | null;
  noticeId?: number | null;
};

export default function NoticeForm({ initialData = null, noticeId = null }: NoticeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('一般');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });

  const isEditMode = !!initialData;

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setCategory(initialData.category);
      setContent(initialData.content);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!title || !category || !content) {
      setModalState({ isOpen: true, title: '入力エラー', message: 'すべての項目を入力してください。' });
      setIsSubmitting(false);
      return;
    }

    const apiUrl = isEditMode ? `/api/notice/${noticeId}` : '/api/notice';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(apiUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存に失敗しました。');
      }
      
      setModalState({
        isOpen: true,
        title: '成功',
        message: `お知らせを${isEditMode ? '更新' : '作成'}しました。`,
        onConfirm: () => {
          router.push('/notice');
          router.refresh();
        }
      });

    } catch (err) {
      setModalState({ isOpen: true, title: 'エラー', message: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <NotificationModal modalState={modalState} setModalState={setModalState} />
      <form onSubmit={handleSubmit} className="space-y-6 p-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">タイトル</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
            required
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">カテゴリー</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option>一般</option>
            <option>アップデート</option>
            <option>重要</option>
            <option>イベント</option>
          </select>
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">内容 (HTML使用可能)</label>
          <textarea
            id="content"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 focus:ring-pink-500 focus:border-pink-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-md transition-colors"
        >
          {isSubmitting ? '保存中...' : (isEditMode ? '更新する' : '作成する')}
        </button>
      </form>
    </>
  );
}
