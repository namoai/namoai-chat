"use client";

import { useState, useEffect, FormEvent } from 'react';
import type { Session } from 'next-auth';
import { ArrowLeft } from 'lucide-react'; // 戻るボタン用のアイコンをインポート

// ガイドデータの型定義
type Guide = {
  id: number;
  mainCategory: string;
  subCategory: string;
  title: string;
  content: string;
  displayOrder: number;
};

export default function AdminGuidesPage() {
  // const [session, setSession] = useState<Session | null>(null); // ▼▼▼ 変更点: 未使用のため、この行を削除しました ▼▼▼
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  
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

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();

        if (sessionData && Object.keys(sessionData).length > 0) {
          // setSession(sessionData); // ▼▼▼ 変更点: 未使用のため、この行を削除しました ▼▼▼
          setStatus('authenticated');

          if (sessionData.user?.role !== 'ADMIN') {
            alert('管理者権限がありません。');
            window.location.href = '/';
          } else {
            fetchGuides();
          }
        } else {
          setStatus('unauthenticated');
          window.location.href = '/login';
        }
      } catch (error) {
        console.error("セッション確認エラー:", error);
        setStatus('unauthenticated');
        window.location.href = '/login';
      }
    };
    checkSessionAndFetchData();
  }, []);

  const fetchGuides = async () => {
    setLoading(true);
    const response = await fetch('/api/admin/guides');
    if (response.ok) {
      const data = await response.json();
      setGuides(data);
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const url = isEditing ? `/api/admin/guides` : '/api/admin/guides';
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing ? JSON.stringify({ ...formData, id: isEditing.id }) : JSON.stringify(formData);

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.ok) {
      alert(isEditing ? '更新しました。' : '作成しました。');
      resetForm();
      fetchGuides();
    } else {
      alert('エラーが発生しました。');
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
  };

  const handleDelete = async (id: number) => {
    if (confirm('本当に削除しますか？')) {
      const response = await fetch(`/api/admin/guides`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        alert('削除しました。');
        fetchGuides();
      } else {
        alert('削除に失敗しました。');
      }
    }
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({
      mainCategory: '',
      subCategory: '',
      title: '',
      content: '',
      displayOrder: 0,
    });
  };

  if (status === 'loading' || loading) {
    return <div className="bg-black text-white min-h-screen flex justify-center items-center">読み込み中...</div>;
  }

  return (
    <div className="bg-black text-white min-h-screen p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ガイド管理</h1>
        <a href="/guide" className="flex items-center bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors">
          <ArrowLeft size={16} className="mr-2" />
          ユーザーガイドに戻る
        </a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-bold mb-4">{isEditing ? 'ガイド編集' : '新規ガイド作成'}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-400">大メニュー</label>
              <input type="text" name="mainCategory" value={formData.mainCategory} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">小メニュー</label>
              <input type="text" name="subCategory" value={formData.subCategory} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">タイトル</label>
              <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">内容 (HTML可)</label>
              <textarea name="content" value={formData.content} onChange={handleInputChange} rows={10} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1" required />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-400">表示順</label>
              <input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleInputChange} className="w-full bg-gray-800 border-gray-700 rounded-md mt-1" required />
            </div>
            <div className="flex gap-4">
              <button type="submit" className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md">
                {isEditing ? '更新' : '作成'}
              </button>
              {isEditing && (
                <button type="button" onClick={resetForm} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">ガイド一覧</h2>
            <div className="space-y-2">
              {guides.map(guide => (
                <div key={guide.id} className="bg-gray-800 p-4 rounded-md flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500">{guide.mainCategory} &gt; {guide.subCategory} (順: {guide.displayOrder})</p>
                    <p className="font-semibold">{guide.title}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(guide)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md">編集</button>
                    <button onClick={() => handleDelete(guide.id)} className="text-sm bg-red-600 hover:red-700 text-white py-1 px-3 rounded-md">削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
