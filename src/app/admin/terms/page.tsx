"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';

// 型定義
type Term = {
  id: number;
  slug: string;
  title: string;
  content: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
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
        <p className="text-gray-200 mb-6 whitespace-pre-line">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors">
              キャンセル
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} rounded-lg transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AdminTermsPage() {
  const router = useRouter();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<Term | null>(null);
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: '',
    displayOrder: 0,
  });
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();
        if (sessionData && Object.keys(sessionData).length > 0) {
          const userRole = sessionData.user?.role;
          if (userRole !== 'MODERATOR' && userRole !== 'SUPER_ADMIN') {
            setModalState({ 
              isOpen: true, 
              title: '権限エラー', 
              message: 'このページにアクセスする権限がありません。', 
              onConfirm: () => router.push('/admin'), 
              isAlert: true 
            });
          } else {
            fetchTerms();
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error("セッション確認エラー:", error);
        router.push('/login');
      }
    };
    checkSessionAndFetchData();
  }, [router]);

  const fetchTerms = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/terms');
      if (response.ok) {
        const data = await response.json();
        setTerms(data);
      } else {
        setModalState({ isOpen: true, title: 'エラー', message: '約款一覧の取得に失敗しました。', isAlert: true });
      }
    } catch (error) {
        console.error('約款取得中にエラー:', error);
        setModalState({ isOpen: true, title: 'エラー', message: '約款取得中にエラーが発生しました。', isAlert: true });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'displayOrder' ? Number(value) : value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? JSON.stringify({ ...formData, id: isEditing.id }) : JSON.stringify(formData);
    const response = await fetchWithCsrf('/api/admin/terms', { method, headers: { 'Content-Type': 'application/json' }, body });

    if (response.ok) {
      setModalState({ isOpen: true, title: '成功', message: isEditing ? '約款を更新しました。' : '約款を作成しました。', isAlert: true });
      resetForm();
      fetchTerms();
    } else {
      const err = await response.json().catch(() => null);
      setModalState({ isOpen: true, title: 'エラー', message: `エラーが発生しました。${err?.message ? `\n${err.message}` : ''}`, isAlert: true });
    }
  };

  const handleEdit = (term: Term) => {
    setIsEditing(term);
    setFormData({
      slug: term.slug,
      title: term.title,
      content: term.content,
      displayOrder: term.displayOrder,
    });
    window.scrollTo(0, 0);
  };

  const handleDelete = (id: number) => {
    setModalState({
      isOpen: true,
      title: '約款削除',
      message: 'この約款を本当に削除しますか？この操作は元に戻せません。',
      confirmText: '削除',
      onConfirm: async () => {
        const response = await fetchWithCsrf('/api/admin/terms', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (response.ok) {
          setModalState({ isOpen: true, title: '成功', message: '約款を削除しました。', isAlert: true });
          fetchTerms();
        } else {
          const err = await response.json().catch(() => null);
          setModalState({ isOpen: true, title: 'エラー', message: `削除に失敗しました。${err?.message ? `\n${err.message}` : ''}`, isAlert: true });
        }
      }
    });
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({ slug: '', title: '', content: '', displayOrder: 0 });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen p-4 sm:p-8 pb-24">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              約款管理
            </h1>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <form onSubmit={handleSubmit} className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg space-y-4 sticky top-8 border border-gray-800/50">
              <h2 className="text-xl font-bold mb-4">{isEditing ? '約款編集' : '新規約款作成'}</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">スラッグ (URL識別子)</label>
                <input 
                  type="text" 
                  name="slug" 
                  value={formData.slug} 
                  onChange={handleInputChange} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-md mt-1 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="例: terms-of-service"
                  required 
                />
                <p className="text-xs text-gray-500 mt-1">英数字とハイフンのみ使用可能</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">タイトル</label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-md mt-1 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="例: ナモアイ利用規約"
                  required 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">内容 (マークダウン形式)</label>
                <textarea 
                  name="content" 
                  value={formData.content} 
                  onChange={handleInputChange} 
                  rows={15} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-md mt-1 px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" 
                  placeholder="# 見出し&#10;&#10;本文..."
                  required 
                />
                <p className="text-xs text-gray-500 mt-1">マークダウン形式で入力してください</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">表示順</label>
                <input 
                  type="number" 
                  name="displayOrder" 
                  value={formData.displayOrder} 
                  onChange={handleInputChange} 
                  min="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md mt-1 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>
              
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-all">
                  {isEditing ? '更新' : '作成'}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    キャンセル
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg border border-gray-800/50">
              <h2 className="text-xl font-bold mb-4">約款一覧</h2>
              <div className="space-y-2">
                {terms.length > 0 ? terms.map((term) => (
                  <div key={term.id} className="bg-gray-800/50 p-4 rounded-md flex justify-between items-center flex-wrap gap-2 border border-gray-700/50 hover:border-blue-500/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1">
                        <span className="font-mono text-blue-400">/{term.slug}</span> 
                        {' '}・ 表示順: {term.displayOrder}
                      </p>
                      <p className="font-semibold mt-1 text-white">{term.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        更新: {new Date(term.updatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link 
                        href={`/terms/${term.slug}`} 
                        target="_blank"
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md transition-colors"
                      >
                        表示
                      </Link>
                      <button 
                        onClick={() => handleEdit(term)} 
                        className="text-sm bg-cyan-600 hover:bg-cyan-700 text-white py-1 px-3 rounded-md transition-colors"
                      >
                        編集
                      </button>
                      <button 
                        onClick={() => handleDelete(term.id)} 
                        className="text-sm bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-sm text-gray-400 py-8">登録された約款はありません。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

