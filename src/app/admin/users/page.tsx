"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // useRouterをインポート
import Link from 'next/link'; // Linkをインポート
import { ArrowLeft, Search } from 'lucide-react';
import { apiPut, ApiErrorResponse } from '@/lib/api-client';

// Role Enumをクライアントサイドで定義
enum Role {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  CHAR_MANAGER = 'CHAR_MANAGER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

// ユーザーデータの型定義
type User = {
  id: number;
  name: string;
  email: string;
  nickname: string;
  role: Role;
  created_at: string;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
  phone?: string | null;
  bio?: string | null;
  emailVerified?: string | null; // ✅ メール認証状態を追加
  lockedUntil?: string | null; // ✅ アカウントロック期限を追加
  loginAttempts?: number; // ✅ ログイン失敗回数を追加
};

type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancelButton?: boolean;
  isAlert?: boolean;
};

// 停止モーダルの型定義
type SuspendModalState = {
  isOpen: boolean;
  userId: number | null;
  userName: string;
};

// 編集モーダルの型定義
type EditModalState = {
  isOpen: boolean;
  userId: number | null;
  userData: {
    name: string;
    nickname: string;
    email: string;
    phone: string;
    bio: string;
    role: Role;
    freePoints: number;
    paidPoints: number;
    isSocialLogin: boolean;
    dateOfBirth: string | null;
    isMinor: boolean;
  } | null;
};

// ▼▼▼【新規追加】汎用モーダルコンポーネント ▼▼▼
const ConfirmationModal = ({ modalState, setModalState }: { modalState: ModalState, setModalState: (state: ModalState) => void }) => {
  if (!modalState.isOpen) return null;

  const handleClose = () => setModalState({ ...modalState, isOpen: false });
  const handleConfirm = () => {
    modalState.onConfirm?.();
    handleClose();
  };
  const handleCancel = () => {
    modalState.onCancel?.();
    handleClose();
  };

  const showCancel =
    modalState.showCancelButton ??
    (!!modalState.onConfirm && !modalState.isAlert); // confirmations default to showing Cancel

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm m-4">
        <h2 className="text-xl font-bold mb-4 text-white">{modalState.title}</h2>
        <p className="text-gray-200 mb-6">{modalState.message}</p>
        <div className="flex justify-end gap-4">
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-500 rounded-lg transition-colors"
            >
              {modalState.cancelText || 'キャンセル'}
            </button>
          )}
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-pink-600 text-white hover:bg-pink-500 rounded-lg transition-colors"
          >
            {modalState.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
// ▲▲▲【追加完了】▲▲▲

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '' });
  const [suspendModal, setSuspendModal] = useState<SuspendModalState>({ isOpen: false, userId: null, userName: '' });
  const [suspendDays, setSuspendDays] = useState<number>(1);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, userId: null, userData: null });

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();

        if (sessionData && Object.keys(sessionData).length > 0) {
          if (sessionData.user?.role !== Role.SUPER_ADMIN) {
            setModalState({ 
                isOpen: true, 
                title: '権限エラー', 
                message: 'このページにアクセスする権限がありません。', 
                onConfirm: () => router.push('/'), 
                isAlert: true 
            });
          } else {
            fetchUsers();
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

  const fetchUsers = async (query = '') => {
    setLoading(true);
    try {
        const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            setUsers(data);
        } else {
            setModalState({ isOpen: true, title: 'エラー', message: 'ユーザー一覧の取得に失敗しました。', isAlert: true });
        }
    } catch (error) {
        console.error("ユーザー取得エラー:", error);
        setModalState({ isOpen: true, title: 'エラー', message: 'ユーザー取得中にエラーが発生しました。', isAlert: true });
    }
    setLoading(false);
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchUsers(searchQuery);
  };

  const handleRoleChange = async (userId: number, newRole: Role) => {
      try {
        await apiPut('/api/admin/users', { userId, newRole });
        setModalState({ isOpen: true, title: '成功', message: '役割を更新しました。', isAlert: true });
        fetchUsers(searchQuery);
      } catch (error) {
        // エラーメッセージを適切に処理
        const errorMessage = error instanceof ApiErrorResponse
          ? error.message
          : '不明なエラーが発生しました。';
        setModalState({ isOpen: true, title: 'エラー', message: `更新に失敗しました: ${errorMessage}`, isAlert: true });
      }
  };

  // ▼▼▼【新機能】ユーザー停止機能 ▼▼▼
  const openSuspendModal = (user: User) => {
    setSuspendModal({ isOpen: true, userId: user.id, userName: user.name });
    setSuspendDays(1);
    setSuspendReason('');
  };

  const handleSuspend = async () => {
    if (!suspendModal.userId || !suspendReason.trim()) {
      setModalState({ isOpen: true, title: 'エラー', message: '停止理由を入力してください。', isAlert: true });
      return;
    }

    try {
      // ✅ fetchWithCsrf を使用してCSRFトークンを自動的に含める
      const { fetchWithCsrf } = await import('@/lib/csrf-client');
      const response = await fetchWithCsrf('/api/admin/users/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: suspendModal.userId, 
          days: suspendDays, 
          reason: suspendReason 
        }),
      });

      if (response.ok) {
        setModalState({ isOpen: true, title: '成功', message: 'ユーザーを停止しました。', isAlert: true });
        setSuspendModal({ isOpen: false, userId: null, userName: '' });
        fetchUsers(searchQuery);
      } else {
        const data = await response.json();
        setModalState({ isOpen: true, title: 'エラー', message: `停止に失敗しました: ${data.error}`, isAlert: true });
      }
    } catch (error) {
      console.error('停止エラー:', error);
      setModalState({ isOpen: true, title: 'エラー', message: '停止処理中にエラーが発生しました。', isAlert: true });
    }
  };

  const handleUnsuspend = async (userId: number) => {
    setModalState({
      isOpen: true,
      title: '確認',
      message: 'このユーザーの停止を解除しますか？',
      confirmText: '解除',
      onConfirm: async () => {
        try {
          // ✅ fetchWithCsrf を使用してCSRFトークンを自動的に含める
          const { fetchWithCsrf } = await import('@/lib/csrf-client');
          const response = await fetchWithCsrf('/api/admin/users/suspend', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });

          if (response.ok) {
            setModalState({ isOpen: true, title: '成功', message: 'ユーザーの停止を解除しました。', isAlert: true });
            fetchUsers(searchQuery);
          } else {
            const data = await response.json();
            setModalState({ isOpen: true, title: 'エラー', message: `解除に失敗しました: ${data.error}`, isAlert: true });
          }
        } catch (error) {
          console.error('停止解除エラー:', error);
          setModalState({ isOpen: true, title: 'エラー', message: '解除処理中にエラーが発生しました。', isAlert: true });
        }
      }
    });
  };
  // ▲▲▲ 停止機能完了 ▲▲▲

  // ▼▼▼【新機能】メール認証切り替え機能 ▼▼▼
  const handleToggleEmailVerified = async (userId: number, currentlyVerified: boolean) => {
    const action = currentlyVerified ? '未認証' : '認証済み';
    setModalState({
      isOpen: true,
      title: '確認',
      message: `このユーザーのメール認証状態を「${action}」に変更しますか？`,
      confirmText: '変更',
      onConfirm: async () => {
        try {
          // ✅ fetchWithCsrf を使用してCSRFトークンを自動的に含める
          const { fetchWithCsrf } = await import('@/lib/csrf-client');
          const response = await fetchWithCsrf('/api/admin/users/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, verified: !currentlyVerified }),
          });

          if (response.ok) {
            setModalState({ isOpen: true, title: '成功', message: `メール認証状態を「${action}」に変更しました。`, isAlert: true });
            fetchUsers(searchQuery);
          } else {
            const data = await response.json();
            setModalState({ isOpen: true, title: 'エラー', message: `変更に失敗しました: ${data.error}`, isAlert: true });
          }
        } catch (error) {
          console.error('メール認証変更エラー:', error);
          setModalState({ isOpen: true, title: 'エラー', message: 'メール認証変更処理中にエラーが発生しました。', isAlert: true });
        }
      },
      onCancel: () => setModalState({ ...modalState, isOpen: false }),
    });
  };
  // ▲▲▲ メール認証切り替え機能完了 ▲▲▲

  // ▼▼▼【新機能】アカウントロック解除機能 ▼▼▼
  const handleUnlock = async (userId: number, userName: string) => {
    setModalState({
      isOpen: true,
      title: '確認',
      message: `「${userName}」のアカウントロックを解除しますか？`,
      confirmText: '解除',
      onConfirm: async () => {
        try {
          const { fetchWithCsrf } = await import('@/lib/csrf-client');
          const response = await fetchWithCsrf('/api/admin/users/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });

          if (response.ok) {
            setModalState({ isOpen: true, title: '成功', message: 'アカウントのロックを解除しました。', isAlert: true });
            fetchUsers(searchQuery);
          } else {
            const data = await response.json();
            setModalState({ isOpen: true, title: 'エラー', message: `解除に失敗しました: ${data.error}`, isAlert: true });
          }
        } catch (error) {
          console.error('ロック解除エラー:', error);
          setModalState({ isOpen: true, title: 'エラー', message: '解除処理中にエラーが発生しました。', isAlert: true });
        }
      },
      onCancel: () => setModalState({ ...modalState, isOpen: false }),
    });
  };
  // ▲▲▲ アカウントロック解除機能完了 ▲▲▲

  // ▼▼▼【新機能】ユーザー削除機能 ▼▼▼
  const handleDeleteUser = async (userId: number, userName: string) => {
    setModalState({
      isOpen: true,
      title: '削除確認',
      message: `本当に「${userName}」を削除しますか？\n\nこの操作は取り消せません。ユーザーが作成したキャラクターは作成者が匿名化されて残ります。`,
      confirmText: '削除',
      onConfirm: async () => {
        try {
          // ✅ fetchWithCsrf を使用してCSRFトークンを自動的に含める
          const { fetchWithCsrf } = await import('@/lib/csrf-client');
          const response = await fetchWithCsrf('/api/admin/users/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });

          if (response.ok) {
            setModalState({ isOpen: true, title: '成功', message: 'ユーザーを削除しました。', isAlert: true });
            fetchUsers(searchQuery);
          } else {
            const data = await response.json();
            setModalState({ isOpen: true, title: 'エラー', message: `削除に失敗しました: ${data.error}`, isAlert: true });
          }
        } catch (error) {
          console.error('ユーザー削除エラー:', error);
          setModalState({ isOpen: true, title: 'エラー', message: '削除処理中にエラーが発生しました。', isAlert: true });
        }
      },
      // ✅ キャンセルボタンも表示して、誤操作を防ぐ
      onCancel: () => setModalState({ ...modalState, isOpen: false }),
    });
  };
  // ▲▲▲ 削除機能完了 ▲▲▲

  // ▼▼▼【新機能】ユーザー情報編集機能 ▼▼▼
  const openEditModal = async (user: User) => {
    try {
      const response = await fetch(`/api/admin/users/edit?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setEditModal({
          isOpen: true,
          userId: user.id,
          userData: {
            name: data.name,
            nickname: data.nickname,
            email: data.email,
            phone: data.phone || '',
            bio: data.bio || '',
            role: data.role,
            freePoints: data.points?.free_points || 0,
            paidPoints: data.points?.paid_points || 0,
            isSocialLogin: data.accounts && data.accounts.length > 0,
            dateOfBirth: data.dateOfBirth
              ? new Date(data.dateOfBirth).toISOString().slice(0, 10)
              : null,
            isMinor: data.isMinor || false,
          }
        });
      } else {
        setModalState({ isOpen: true, title: 'エラー', message: 'ユーザー情報の取得に失敗しました。', isAlert: true });
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      setModalState({ isOpen: true, title: 'エラー', message: 'ユーザー情報取得中にエラーが発生しました。', isAlert: true });
    }
  };

  const handleEditSave = async () => {
    if (!editModal.userId || !editModal.userData) return;

    try {
      await apiPut('/api/admin/users/edit', {
        userId: editModal.userId,
        ...editModal.userData
      });
      setModalState({ isOpen: true, title: '成功', message: 'ユーザー情報を更新しました。', isAlert: true });
      setEditModal({ isOpen: false, userId: null, userData: null });
      fetchUsers(searchQuery);
    } catch (error) {
      console.error('更新エラー:', error);
      // エラーメッセージを適切に処理
      const errorMessage = error instanceof ApiErrorResponse
        ? error.message
        : '更新処理中にエラーが発生しました。';
      setModalState({ isOpen: true, title: 'エラー', message: `更新に失敗しました: ${errorMessage}`, isAlert: true });
    }
  };
  // ▲▲▲ 編集機能完了 ▲▲▲
  
  const getRoleStyle = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN: return 'bg-red-600 text-white';
      case Role.CHAR_MANAGER: return 'bg-blue-600 text-white';
      case Role.MODERATOR: return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-gray-300';
    }
  };

  if (loading && users.length === 0) {
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
    <div className="bg-black text-white min-h-screen">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24">
          <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      
      {/* ▼▼▼【停止モーダル】▼▼▼ */}
      {suspendModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-white">ユーザー停止: {suspendModal.userName}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">停止期間</label>
              <select 
                value={suspendDays}
                onChange={(e) => setSuspendDays(parseInt(e.target.value))}
                className="w-full bg-gray-700 text-white rounded-lg p-2"
              >
                <option value={1}>1日</option>
                <option value={3}>3日</option>
                <option value={7}>7日 (1週間)</option>
                <option value={30}>30日 (1ヶ月)</option>
                <option value={90}>90日 (3ヶ月)</option>
                <option value={100}>100日</option>
                <option value={365}>365日 (1年)</option>
                <option value={-1}>永久停止</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">停止理由 (必須)</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg p-2 min-h-[100px]"
                placeholder="停止理由を入力してください..."
              />
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setSuspendModal({ isOpen: false, userId: null, userName: '' })}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                キャンセル
              </button>
              <button 
                onClick={handleSuspend}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                停止する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲【停止モーダル完了】▲▲▲ */}

      {/* ▼▼▼【編集モーダル】▼▼▼ */}
      {editModal.isOpen && editModal.userData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-bold mb-6 text-white">ユーザー情報編集</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">名前</label>
                <input
                  type="text"
                  value={editModal.userData.name}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, name: e.target.value}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ニックネーム</label>
                <input
                  type="text"
                  value={editModal.userData.nickname}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, nickname: e.target.value}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2"
                />
              </div>

              {!editModal.userData.isSocialLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">メールアドレス</label>
                  <input
                    type="email"
                    value={editModal.userData.email}
                    onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, email: e.target.value}})}
                    className="w-full bg-gray-700 text-white rounded-lg p-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">電話番号</label>
                <input
                  type="tel"
                  value={editModal.userData.phone}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, phone: e.target.value}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2"
                  placeholder="任意"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">自己紹介</label>
                <textarea
                  value={editModal.userData.bio}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, bio: e.target.value}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2 min-h-[80px]"
                  placeholder="任意"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">役割</label>
                <select 
                  value={editModal.userData.role}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, role: e.target.value as Role}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2"
                >
                  {Object.values(Role).map(roleValue => (
                    <option key={roleValue} value={roleValue}>
                      {roleValue}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">生年月日</label>
                <input
                  type="date"
                  value={editModal.userData.dateOfBirth || ''}
                  onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, dateOfBirth: e.target.value || null}})}
                  className="w-full bg-gray-700 text-white rounded-lg p-2"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editModal.userData.isMinor}
                    onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, isMinor: e.target.checked}})}
                    className="w-5 h-5 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 mr-2"
                  />
                  <span className="text-sm font-medium text-gray-300">18歳未満として扱う</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-3 mt-2">ポイント管理</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">無料ポイント</label>
                    <input
                      type="number"
                      value={editModal.userData.freePoints}
                      onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, freePoints: parseInt(e.target.value) || 0}})}
                      className="w-full bg-gray-700 text-white rounded-lg p-2"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">有料ポイント</label>
                    <input
                      type="number"
                      value={editModal.userData.paidPoints}
                      onChange={(e) => setEditModal({...editModal, userData: {...editModal.userData!, paidPoints: parseInt(e.target.value) || 0}})}
                      className="w-full bg-gray-700 text-white rounded-lg p-2"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {editModal.userData.isSocialLogin && (
                <div className="md:col-span-2 bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    ℹ️ このユーザーはソーシャルログイン（Google等）で登録されています。
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setEditModal({ isOpen: false, userId: null, userData: null })}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                キャンセル
              </button>
              <button 
                onClick={handleEditSave}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ▲▲▲【編集モーダル完了】▲▲▲ */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ユーザー管理
            </h1>
            <Link href="/admin" className="flex items-center bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50">
              <ArrowLeft size={16} className="mr-2" />
              管理パネルに戻る
            </Link>
          </header>

        <form onSubmit={handleSearch} className="mb-8 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-grow">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前、ニックネーム、メールアドレスで検索"
              className="w-full bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 pl-10 pr-4 py-2"
            />
          </div>
          <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md flex items-center justify-center">
            <Search size={16} className="mr-2 sm:hidden" />
            <span>検索</span>
          </button>
        </form>

        {/* Mobile: 카드형 리스트 (가로 스크롤/잘림 방지) */}
        <div className="md:hidden space-y-3">
          {users.map((user) => {
            const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
            const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
            return (
              <div key={user.id} className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-400">ID {user.id}</div>
                    <div className="font-semibold truncate" title={`${user.name} (@${user.nickname})`}>
                      {user.name} <span className="text-gray-400">(@{user.nickname})</span>
                    </div>
                    <div className="text-sm text-gray-300 truncate" title={user.email}>
                      {user.email}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      className={`border-none text-xs font-semibold rounded-full px-2 py-1 ${getRoleStyle(user.role)}`}
                    >
                      {Object.values(Role).map((roleValue) => (
                        <option key={roleValue} value={roleValue} className="bg-gray-800 text-white">
                          {roleValue}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-col gap-1 items-end">
                      {isSuspended ? (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full">停止中</span>
                      ) : (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">正常</span>
                      )}
                      {isLocked && (
                        <span
                          className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full"
                          title={`ロック中 (失敗回数: ${user.loginAttempts || 0})`}
                        >
                          ロック中
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleToggleEmailVerified(user.id, !!user.emailVerified)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      user.emailVerified ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                    title={user.emailVerified ? `認証済み: ${new Date(user.emailVerified).toLocaleDateString('ja-JP')}` : '未認証'}
                  >
                    {user.emailVerified ? '✓ 認証済み' : '未認証'}
                  </button>

                  <button
                    onClick={() => openEditModal(user)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                  >
                    編集
                  </button>

                  {isLocked && (
                    <button
                      onClick={() => handleUnlock(user.id, user.name)}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      title="アカウントロックを解除"
                    >
                      ロック解除
                    </button>
                  )}

                  {isSuspended ? (
                    <button
                      onClick={() => handleUnsuspend(user.id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                    >
                      解除
                    </button>
                  ) : (
                    <button
                      onClick={() => openSuspendModal(user)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                    >
                      停止
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="bg-gray-700 hover:bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })}

          {users.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-500">検索結果に一致するユーザーがいません。</div>
          )}
        </div>

        {/* Desktop/Tablet: 테이블 */}
        <div className="hidden md:block bg-gray-900 rounded-lg overflow-x-auto">
          <table className="w-full text-left min-w-[1000px] table-auto">
            <thead className="bg-gray-800">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">名前</th>
                <th className="p-4">メールアドレス</th>
                <th className="p-4">登録日</th>
                <th className="p-4">役割</th>
                <th className="p-4">メール認証</th>
                <th className="p-4">状態</th>
                <th className="p-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
                const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
                return (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4 whitespace-nowrap">{user.id}</td>
                    <td className="p-4 min-w-[200px] max-w-[300px]">
                      <div className="truncate" title={`${user.name} (@${user.nickname})`}>
                        {user.name} (@{user.nickname})
                      </div>
                    </td>
                    <td className="p-4 min-w-[200px] max-w-[300px]">
                      <div className="truncate" title={user.email}>
                        {user.email}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">{new Date(user.created_at).toLocaleDateString('ja-JP')}</td>
                    <td className="p-4 whitespace-nowrap">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        className={`border-none text-xs font-semibold rounded-full px-2 py-1 ${getRoleStyle(user.role)}`}
                      >
                        {Object.values(Role).map(roleValue => (
                          <option key={roleValue} value={roleValue} className="bg-gray-800 text-white">
                            {roleValue}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleEmailVerified(user.id, !!user.emailVerified)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          user.emailVerified
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-600 hover:bg-gray-700 text-white'
                        }`}
                        title={user.emailVerified ? `認証済み: ${new Date(user.emailVerified).toLocaleDateString('ja-JP')}` : '未認証'}
                      >
                        {user.emailVerified ? '✓ 認証済み' : '未認証'}
                      </button>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                      {isSuspended ? (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full">停止中</span>
                      ) : (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">正常</span>
                      )}
                        {isLocked && (
                          <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full" title={`ロック中 (失敗回数: ${user.loginAttempts || 0})`}>
                            ロック中
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 flex-nowrap min-w-[200px]">
                        <button 
                          onClick={() => openEditModal(user)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0"
                        >
                          編集
                        </button>
                        {isLocked && (
                          <button 
                            onClick={() => handleUnlock(user.id, user.name)}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0"
                            title="アカウントロックを解除"
                          >
                            ロック解除
                          </button>
                        )}
                        {isSuspended ? (
                          <button 
                            onClick={() => handleUnsuspend(user.id)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0"
                          >
                            解除
                          </button>
                        ) : (
                          <button 
                            onClick={() => openSuspendModal(user)}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0"
                          >
                            停止
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="bg-gray-700 hover:bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-500">
                検索結果に一致するユーザーがいません。
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
