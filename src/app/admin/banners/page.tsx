"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Edit, Trash2, Upload, X } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';
import { uploadImageToStorage } from '@/lib/cloudflare-images';

type Banner = {
  id: number;
  title: string | null;
  description: string | null;
  imageUrl: string;
  link: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
};

const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => setModalState({ ...modalState, isOpen: false });
  const handleConfirm = () => {
    modalState.onConfirm?.();
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl p-6 w-full max-w-sm border border-gray-700/50">
        <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
        <p className="text-gray-200 mb-6">{modalState.message}</p>
        <div className="flex justify-between gap-4">
          <button onClick={handleClose} className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-xl transition-colors">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white ${modalState.confirmText?.includes('削除') ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} rounded-xl transition-colors`}
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    link: '',
    displayOrder: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      // すべてのバナーを取得（アクティブでないものも含む）
      const response = await fetch('/api/banners?all=true');
      if (response.ok) {
        const data = await response.json();
        setBanners(data);
      }
    } catch (error) {
      console.error('バナーの取得に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像ファイルの検証
    if (!file.type.startsWith('image/')) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '画像ファイルを選択してください。',
      });
      return;
    }

    // サイズチェック (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '画像サイズは5MB以下にしてください。',
      });
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await uploadImageToStorage(file);
      setFormData(prev => ({ ...prev, imageUrl }));
    } catch (error) {
      console.error('画像アップロードエラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '画像のアップロードに失敗しました。',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      link: '',
      displayOrder: banners.length,
      isActive: true,
    });
    setEditingBanner(null);
    setIsEditModalOpen(true);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleEdit = (banner: Banner) => {
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      imageUrl: banner.imageUrl,
      link: banner.link || '',
      displayOrder: banner.displayOrder,
      isActive: banner.isActive,
    });
    setEditingBanner(banner);
    setIsEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.imageUrl) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '画像をアップロードしてください。',
      });
      return;
    }

    try {
      if (editingBanner) {
        // 更新
        const response = await fetchWithCsrf(`/api/banners/${editingBanner.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'バナーの更新に失敗しました');
        }
      } else {
        // 作成
        const response = await fetchWithCsrf('/api/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'バナーの作成に失敗しました');
        }
      }

      setIsEditModalOpen(false);
      fetchBanners();
    } catch (error) {
      console.error('保存エラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: error instanceof Error ? error.message : '保存に失敗しました。',
      });
    }
  };

  const handleDelete = (banner: Banner) => {
    setModalState({
      isOpen: true,
      title: 'バナーを削除',
      message: 'このバナーを削除しますか？この操作は取り消せません。',
      onConfirm: async () => {
        try {
          const response = await fetchWithCsrf(`/api/banners/${banner.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('バナーの削除に失敗しました');
          }

          fetchBanners();
        } catch (error) {
          console.error('削除エラー:', error);
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: 'バナーの削除に失敗しました。',
          });
        }
      },
      confirmText: '削除',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          <ConfirmationModal modalState={modalState} setModalState={setModalState} />

          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Link href="/admin" className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all">
                <ArrowLeft size={24} />
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold ml-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                バナー管理
              </h1>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30"
            >
              <Plus size={20} />
              新規作成
            </button>
          </header>

          {/* バナーサイズ情報 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <h3 className="text-lg font-bold text-blue-400 mb-2">バナーサイズについて</h3>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>• PC版: 1920px × 500px (推奨)</li>
              <li>• モバイル版: 768px × 400px (推奨)</li>
              <li>• アスペクト比: 約 3.84:1 (PC), 約 1.92:1 (モバイル)</li>
              <li>• 最大ファイルサイズ: 5MB</li>
              <li>• 対応形式: JPEG, PNG, WebP</li>
            </ul>
          </div>

          {/* バナー一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`bg-gray-900/50 backdrop-blur-sm rounded-2xl border ${banner.isActive ? 'border-blue-500/30' : 'border-gray-700/50'} overflow-hidden`}
              >
                <div className="relative aspect-[3.84/1] bg-gray-800">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || 'バナー'}
                    className="w-full h-full object-cover"
                  />
                  {!banner.isActive && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-gray-400 font-semibold">非アクティブ</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white mb-2 truncate">{banner.title || 'タイトルなし'}</h3>
                  {banner.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{banner.description}</p>
                  )}
                  {banner.link && (
                    <p className="text-xs text-blue-400 mb-3 truncate">リンク: {banner.link}</p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">表示順: {banner.displayOrder}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(banner)}
                        className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(banner)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {banners.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">バナーがありません</p>
            </div>
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-gray-800/95 backdrop-blur-xl rounded-2xl p-6 w-full max-w-2xl border border-gray-700/50 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingBanner ? 'バナーを編集' : '新規バナー作成'}
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
              >
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 画像アップロード */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  バナー画像 <span className="text-red-400">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full p-4 border-2 border-dashed border-gray-600 rounded-xl hover:border-blue-500/50 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-blue-400 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      <span>アップロード中...</span>
                    </>
                  ) : formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="プレビュー" className="max-h-32 rounded-lg" />
                      <span className="ml-2">画像を変更</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      <span>画像をアップロード</span>
                    </>
                  )}
                </button>
              </div>

              {/* タイトル */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">タイトル（任意）</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="バナータイトル"
                />
              </div>

              {/* 説明 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">説明（任意）</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="バナー説明"
                  rows={3}
                />
              </div>

              {/* リンク */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">リンクURL（任意）</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="https://example.com"
                />
                <p className="text-xs text-gray-500 mt-1">バナーをクリックしたときに移動するURL</p>
              </div>

              {/* 表示順 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">表示順</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* アクティブ */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500/50"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-300">
                  アクティブ（表示する）
                </label>
              </div>

              {/* ボタン */}
              <div className="flex justify-end gap-4 pt-4">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
