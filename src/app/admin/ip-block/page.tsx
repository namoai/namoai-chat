"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, X, Plus } from 'lucide-react';
import { fetchWithCsrf } from '@/lib/csrf-client';

type BlockedIP = {
  ip: string;
  reason: string;
  blockedAt: string;
};

type AllowedAdminIP = {
  ip: string;
  label: string | null;
  createdAt: string;
};

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  isAlert?: boolean;
};

export default function IPBlockPage() {
  const router = useRouter();
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [allowedAdminIPs, setAllowedAdminIPs] = useState<AllowedAdminIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newAdminIP, setNewAdminIP] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');

  useEffect(() => {
    fetchBlockedIPs();
    fetchAllowedAdminIPs();
  }, []);

  const fetchBlockedIPs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-block');
      if (response.ok) {
        const data = await response.json();
        setBlockedIPs(data.blacklist || []);
      }
    } catch (error) {
      console.error('IP取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllowedAdminIPs = async () => {
    try {
      const response = await fetch('/api/admin/ip-allowlist');
      if (response.ok) {
        const data = await response.json();
        setAllowedAdminIPs(data.allowlist || []);
      }
    } catch (error) {
      console.error('管理者IP取得エラー:', error);
    }
  };

  const handleBlockIP = async () => {
    if (!newIP.trim()) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'IPアドレスを入力してください。',
        isAlert: true,
      });
      return;
    }

    try {
      const response = await fetchWithCsrf('/api/admin/ip-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIP.trim(), reason: newReason.trim() || undefined }),
      });

      if (response.ok) {
        setModalState({
          isOpen: true,
          title: '成功',
          message: `IPアドレス ${newIP} をブロックしました。`,
          isAlert: true,
        });
        setNewIP('');
        setNewReason('');
        fetchBlockedIPs();
      } else {
        const data = await response.json();
        setModalState({
          isOpen: true,
          title: 'エラー',
          message: data.error || 'ブロックに失敗しました。',
          isAlert: true,
        });
      }
    } catch (error) {
      console.error('IPブロックエラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: 'ブロック処理中にエラーが発生しました。',
        isAlert: true,
      });
    }
  };

  const handleAddAdminIP = async () => {
    if (!newAdminIP.trim()) {
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '管理者IPを入力してください。',
        isAlert: true,
      });
      return;
    }
    try {
      const response = await fetchWithCsrf('/api/admin/ip-allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newAdminIP.trim(), label: newAdminLabel.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        setModalState({
          isOpen: true,
          title: 'エラー',
          message: data.error || '登録に失敗しました。',
          isAlert: true,
        });
        return;
      }
      setNewAdminIP('');
      setNewAdminLabel('');
      await fetchAllowedAdminIPs();
      setModalState({
        isOpen: true,
        title: '成功',
        message: '管理者IPを登録しました。',
        isAlert: true,
      });
    } catch (error) {
      console.error('管理者IP登録エラー:', error);
      setModalState({
        isOpen: true,
        title: 'エラー',
        message: '登録処理中にエラーが発生しました。',
        isAlert: true,
      });
    }
  };

  const handleRemoveAdminIP = (ip: string) => {
    setModalState({
      isOpen: true,
      title: '確認',
      message: `管理者IP ${ip} を削除しますか？`,
      confirmText: '削除',
      onConfirm: async () => {
        try {
          const response = await fetchWithCsrf('/api/admin/ip-allowlist', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip }),
          });
          if (response.ok) {
            await fetchAllowedAdminIPs();
            setModalState({
              isOpen: true,
              title: '成功',
              message: '削除しました。',
              isAlert: true,
            });
          } else {
            const data = await response.json().catch(() => ({} as any));
            setModalState({
              isOpen: true,
              title: 'エラー',
              message: data.error || '削除に失敗しました。',
              isAlert: true,
            });
          }
        } catch (error) {
          console.error('管理者IP削除エラー:', error);
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: '削除処理中にエラーが発生しました。',
            isAlert: true,
          });
        }
      },
      onCancel: () => setModalState({ ...modalState, isOpen: false }),
    });
  };

  const handleUnblockIP = (ip: string) => {
    setModalState({
      isOpen: true,
      title: '確認',
      message: `IPアドレス ${ip} のブロックを解除しますか？`,
      confirmText: '解除',
      onConfirm: async () => {
        try {
          const response = await fetchWithCsrf('/api/admin/ip-block', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip }),
          });

          if (response.ok) {
            setModalState({
              isOpen: true,
              title: '成功',
              message: 'ブロックを解除しました。',
              isAlert: true,
            });
            fetchBlockedIPs();
          } else {
            const data = await response.json();
            setModalState({
              isOpen: true,
              title: 'エラー',
              message: data.error || '解除に失敗しました。',
              isAlert: true,
            });
          }
        } catch (error) {
          console.error('IP解除エラー:', error);
          setModalState({
            isOpen: true,
            title: 'エラー',
            message: '解除処理中にエラーが発生しました。',
            isAlert: true,
          });
        }
      },
      onCancel: () => setModalState({ ...modalState, isOpen: false }),
    });
  };

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            IPブロック管理
          </h1>
          <Link href="/admin" className="flex items-center bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50">
            <ArrowLeft size={16} className="mr-2" />
            管理パネルに戻る
          </Link>
        </header>

        {/* 管理者IP（許可リスト） */}
        <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
          <h2 id="admin-ip-allowlist" className="text-xl font-bold mb-2 flex items-center">
            <Shield size={20} className="mr-2 text-pink-400" />
            管理者IP（許可リスト）
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            ここに登録されたIPからのみ <span className="text-gray-200">/admin</span> にアクセスできます（登録が0件なら制限なし）。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">管理者IP *</label>
              <input
                type="text"
                value={newAdminIP}
                onChange={(e) => setNewAdminIP(e.target.value)}
                placeholder="例: 192.168.1.10"
                className="w-full bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">ラベル（任意）</label>
              <input
                type="text"
                value={newAdminLabel}
                onChange={(e) => setNewAdminLabel(e.target.value)}
                placeholder="例: 自宅WiFi / 会社"
                className="w-full bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
              />
            </div>
          </div>
          <button
            onClick={handleAddAdminIP}
            className="mt-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center"
          >
            <Plus size={16} className="mr-2" />
            登録
          </button>

          <div className="mt-6 overflow-x-auto">
            {allowedAdminIPs.length === 0 ? (
              <div className="text-center text-gray-400 py-6">登録済みの管理者IPはありません。</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-4 text-left">IP</th>
                    <th className="p-4 text-left">ラベル</th>
                    <th className="p-4 text-left">登録日時</th>
                    <th className="p-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {allowedAdminIPs.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-4 font-mono">{row.ip}</td>
                      <td className="p-4 text-gray-300">{row.label || '-'}</td>
                      <td className="p-4 text-gray-400">{new Date(row.createdAt).toLocaleString('ja-JP')}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleRemoveAdminIP(row.ip)}
                          className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1 rounded transition-colors flex items-center ml-auto"
                        >
                          <X size={14} className="mr-1" />
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* IP追加フォーム */}
        <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Plus size={20} className="mr-2 text-pink-400" />
            IPアドレスをブロック
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">IPアドレス *</label>
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="例: 192.168.1.100"
                className="w-full bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">ブロック理由（任意）</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="例: 不正アクセス試行"
                className="w-full bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
              />
            </div>
          </div>
          <button
            onClick={handleBlockIP}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center"
          >
            <Shield size={16} className="mr-2" />
            ブロック
          </button>
        </div>

        {/* ブロック済みIP一覧 */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-xl font-bold flex items-center">
              <Shield size={20} className="mr-2 text-red-400" />
              ブロック済みIP一覧
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">読み込み中...</div>
          ) : blockedIPs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">ブロック済みIPはありません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-4 text-left">IPアドレス</th>
                    <th className="p-4 text-left">ブロック理由</th>
                    <th className="p-4 text-left">ブロック日時</th>
                    <th className="p-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedIPs.map((blocked, index) => (
                    <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-4 font-mono">{blocked.ip}</td>
                      <td className="p-4">{blocked.reason}</td>
                      <td className="p-4 text-gray-400">{new Date(blocked.blockedAt).toLocaleString('ja-JP')}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleUnblockIP(blocked.ip)}
                          className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1 rounded transition-colors flex items-center ml-auto"
                        >
                          <X size={14} className="mr-1" />
                          解除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* モーダル */}
      {modalState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
            <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
            <p className="text-gray-200 mb-6">{modalState.message}</p>
            <div className="flex justify-end gap-4">
              {!modalState.isAlert && (
                <button
                  onClick={() => setModalState({ ...modalState, isOpen: false })}
                  className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg"
                >
                  キャンセル
                </button>
              )}
              <button
                onClick={() => {
                  modalState.onConfirm?.();
                  if (modalState.isAlert) {
                    setModalState({ ...modalState, isOpen: false });
                  }
                }}
                className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-500 rounded-lg"
              >
                {modalState.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


