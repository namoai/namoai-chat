"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // useRouterをインポート
import Link from 'next/link'; // Linkをインポート
import { ArrowLeft, Search } from 'lucide-react';

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
        <div className="flex justify-end gap-4">
          <button 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg transition-colors"
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
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole }),
      });

      if (response.ok) {
        setModalState({ isOpen: true, title: '成功', message: '役割を更新しました。', isAlert: true });
        fetchUsers(searchQuery);
      } else {
        const data = await response.json();
        setModalState({ isOpen: true, title: 'エラー', message: `更新に失敗しました: ${data.error}`, isAlert: true });
      }
  };
  
  const getRoleStyle = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN: return 'bg-red-600 text-white';
      case Role.CHAR_MANAGER: return 'bg-blue-600 text-white';
      case Role.MODERATOR: return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-gray-300';
    }
  };

  if (loading && users.length === 0) {
    return <div className="bg-black text-white min-h-screen flex justify-center items-center">読み込み中...</div>;
  }

  return (
    <div className="bg-black text-white min-h-screen p-4 sm:p-8">
      <ConfirmationModal modalState={modalState} setModalState={setModalState} />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">ユーザー管理</h1>
          {/* ▼▼▼【修正点】<a>タグを<Link>コンポーネントに変更 ▼▼▼ */}
          <Link href="/admin" className="flex items-center bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
            <ArrowLeft size={16} className="mr-2" />
            管理パネルに戻る
          </Link>
        </div>

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

        <div className="bg-gray-900 rounded-lg overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-800">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">名前</th>
                <th className="p-4">メールアドレス</th>
                <th className="p-4">登録日</th>
                <th className="p-4">役割</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-4">{user.id}</td>
                  <td className="p-4">{user.name} (@{user.nickname})</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{new Date(user.created_at).toLocaleDateString('ja-JP')}</td>
                  <td className="p-4">
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
                </tr>
              ))}
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
  );
}
