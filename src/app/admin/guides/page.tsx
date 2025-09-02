"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // useRouterをインポート
import Link from 'next/link'; // Linkをインポート
import { ArrowLeft } from 'lucide-react';

// 型定義
type Guide = {
  id: number;
  mainCategory: string;
  subCategory: string;
  title: string;
  content: string;
  displayOrder: number;
};

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
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
        <h2 className="text-xl font-bold mb-4">{modalState.title}</h2>
        <p className="text-gray-300 mb-6">{modalState.message}</p>
        <div className={`flex ${modalState.isAlert ? 'justify-end' : 'justify-between'} gap-4`}>
          {!modalState.isAlert && (
            <button onClick={handleClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors">
              キャンセル
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className={`px-4 py-2 ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-pink-600 hover:bg-pink-500'} rounded-lg transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
// ▲▲▲【追加完了】▲▲▲

export default function AdminGuidesPage() {
  const router = useRouter();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<Guide | null>(null);
  const [formData, setFormData] = useState({
    mainCategory: '',
    subCategory: '',
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
            fetchGuides();
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

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/guides');
      if (response.ok) {
        const data = await response.json();
        setGuides(data);
      } else {
        setModalState({ isOpen: true, title: 'エラー', message: 'ガイド一覧の取得に失敗しました。', isAlert: true });
      }
    } catch (error) {
        console.error('ガイド取得中にエラー:', error);
        setModalState({ isOpen: true, title: 'エラー', message: 'ガイド取得中にエラーが発生しました。', isAlert: true });
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
    const response = await fetch('/api/admin/guides', { method, headers: { 'Content-Type': 'application/json' }, body });

    if (response.ok) {
      setModalState({ isOpen: true, title: '成功', message: isEditing ? 'ガイドを更新しました。' : 'ガイドを作成しました。', isAlert: true });
      resetForm();
      fetchGuides();
    } else {
      const err = await response.json().catch(() => null);
      setModalState({ isOpen: true, title: 'エラー', message: `エラーが発生しました。${err?.message ? `\n${err.message}` : ''}`, isAlert: true });
    }
  };

  const handleEdit = (guide: Guide) => {
    setIsEditing(guide);
    setFormData({
      mainCategory: guide.mainCategory,
      subCategory: guide.subCategory,
      title: guide.title,
      content: guide.content,
      displayOrder: guide.displayOrder,
    });
    window.scrollTo(0, 0);
  };

  const handleDelete = (id: number) => {
    setModalState({
      isOpen: true,
      title: 'ガイド削除',
      message: 'このガイドを本当に削除しますか？この操作は元に戻せません。',
      confirmText: '削除',
      onConfirm: async () => {
        const response = await fetch('/api/admin/guides', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (response.ok) {
          setModalState({ isOpen: true, title: '成功', message: 'ガイドを削除しました。', isAlert: true });
          fetchGuides();
        } else {
          const err = await response.json().catch(() => null);
          setModalState({ isOpen: true, title: 'エラー', message: `削除に失敗しました。${err?.message ? `\n${err.message}` : ''}`, isAlert: true });
        }
      }
    });
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({ mainCategory: '', subCategory: '', title: '', content: '', displayOrder: 0 });
  };

  if (loading) {
    return <div className="bg-black text-white min-h-screen flex justify-center items-center">読み込み中...</div>;
  }

  return (
    <div className="bg-black text-white min-h-screen p-4 sm:p-8">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">ガイド管理</h1>
          {/* ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼ */}
          <Link href="/guide" className="flex items-center bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">
            <ArrowLeft size={16} className="mr-2" />
            ユーザーガイドに戻る
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-lg space-y-4 sticky top-8">
              <h2 className="text-xl font-bold mb-4">{isEditing ? 'ガイド編集' : '新規ガイド作成'}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-400">大メニュー</label>
                <input type="text" name="mainCategory" value={formData.mainCategory} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">小メニュー</label>
                <input type="text" name="subCategory" value={formData.subCategory} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">タイトル</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">内容 (HTML可)</label>
                <textarea name="content" value={formData.content} onChange={handleInputChange} rows={10} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">表示順</label>
                <input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1 text-white" required />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
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
            <div className="bg-gray-900 p-6 rounded-lg">
              <h2 className="text-xl font-bold mb-4">ガイド一覧</h2>
              <div className="space-y-2">
                {guides.length > 0 ? guides.map((guide) => (
                  <div key={guide.id} className="bg-gray-800 p-4 rounded-md flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-gray-500">{guide.mainCategory} &gt; {guide.subCategory} (順: {guide.displayOrder})</p>
                      <p className="font-semibold mt-1">{guide.title}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleEdit(guide)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md transition-colors">編集</button>
                      <button onClick={() => handleDelete(guide.id)} className="text-sm bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md transition-colors">削除</button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center text-sm text-gray-400 py-8">登録されたガイドはありません。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
