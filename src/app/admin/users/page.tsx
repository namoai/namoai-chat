"use client";

import { useState, useEffect, FormEvent } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
// import { Role } from '@prisma/client'; // ▼▼▼ 変更点: ビルドエラーのため、この行を削除しました ▼▼▼

// ▼▼▼ 変更点: Role Enumをクライアントサイドで定義します ▼▼▼
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
  role: Role; // stringからRoleに変更
  created_at: string;
};

export default function AdminUsersPage() {
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const sessionData = await res.json();

        if (sessionData && Object.keys(sessionData).length > 0) {
          setStatus('authenticated');
          if (sessionData.user?.role !== Role.SUPER_ADMIN) { // SUPER_ADMINのみアクセス可能
            alert('管理者権限がありません。');
            window.location.href = '/';
          } else {
            fetchUsers();
          }
        } else {
          setStatus('unauthenticated');
          window.location.href = '/login';
        }
      } catch (error) {
        console.error("セッション確認エラー:", error);
        window.location.href = '/login';
      }
    };
    checkSessionAndFetchData();
  }, []);

  const fetchUsers = async (query = '') => {
    setLoading(true);
    const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
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
        alert('役割を更新しました。');
        fetchUsers(searchQuery);
      } else {
        const data = await response.json();
        alert(`更新に失敗しました: ${data.error}`);
      }
  };
  
  if (status !== 'authenticated' || loading) {
    return <div className="bg-black text-white min-h-screen flex justify-center items-center">読み込み中...</div>;
  }

  const getRoleStyle = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN: return 'bg-red-600 text-white';
      case Role.CHAR_MANAGER: return 'bg-blue-600 text-white';
      case Role.MODERATOR: return 'bg-green-600 text-white';
      default: return 'bg-gray-600 text-gray-300';
    }
  };

  return (
    <div className="bg-black text-white min-h-screen p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">ユーザー管理</h1>
        <a href="/admin" className="flex items-center bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
          <ArrowLeft size={16} className="mr-2" />
          管理パネルに戻る
        </a>
      </div>

      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="名前、ニックネーム、メールアドレスで検索"
          className="flex-grow bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
        />
        <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-md flex items-center">
          <Search size={16} className="mr-2" />
          検索
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
      </div>
    </div>
  );
}
