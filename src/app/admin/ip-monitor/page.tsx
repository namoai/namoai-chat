"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Search, User } from 'lucide-react';

type AccessLog = {
  ip: string;
  timestamp: string;
  path: string;
};

type UserIPInfo = {
  user: {
    id: number;
    email: string;
    nickname: string;
    registeredAt: string;
    role?: string;
  };
  sessions?: Array<{
    id: number;
    expires: string;
    createdAt: string;
  }>;
  currentIp?: string;
  accessLogs: AccessLog[];
  message?: string;
};

type IPStat = {
  ip: string;
  count: number;
};

type User = {
  id: number;
  email: string;
  nickname: string;
  name: string;
  role: string;
  created_at: string;
};

type SessionInfo = {
  userId: number;
  userEmail: string;
  userNickname: string;
  userRole: string;
  sessionId: number;
  expires: string;
};

export default function IPMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'id' | 'email' | 'nickname' | 'query'>('query');
  const [userIPInfo, setUserIPInfo] = useState<UserIPInfo | null>(null);
  const [ipStats, setIpStats] = useState<IPStat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionInfo[]>([]);
  const [showUserList, setShowUserList] = useState(false);

  useEffect(() => {
    fetchIPStats();
  }, []);

  const fetchIPStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-monitor');
      if (response.ok) {
        const data = await response.json();
        setIpStats(data.ipStats || []);
        setRecentSessions(data.recentSessions || []);
      }
    } catch (error) {
      console.error('IP統計取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    try {
      setLoading(true);
      let url = '/api/admin/ip-monitor?';
      
      if (searchType === 'id') {
        url += `userId=${searchQuery}`;
      } else if (searchType === 'email') {
        url += `email=${encodeURIComponent(searchQuery)}`;
      } else if (searchType === 'nickname') {
        url += `nickname=${encodeURIComponent(searchQuery)}`;
      } else {
        // query: 自動検索
        url += `query=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.users) {
          // ユーザー一覧が返された場合
          setUsers(data.users);
          setShowUserList(true);
          setUserIPInfo(null);
        } else {
          // 特定ユーザー情報が返された場合
          setUserIPInfo(data);
          setShowUserList(false);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'ユーザーが見つかりません。');
        setUserIPInfo(null);
        setUsers([]);
        setShowUserList(false);
      }
    } catch (error) {
      console.error('ユーザーIP取得エラー:', error);
      alert('取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (userId: number) => {
    setSearchQuery(userId.toString());
    setSearchType('id');
    await handleSearchUser();
  };

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            IP観察ツール
          </h1>
          <Link href="/admin" className="flex items-center bg-gray-800/50 hover:bg-gray-700/50 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all border border-gray-700/50">
            <ArrowLeft size={16} className="mr-2" />
            管理パネルに戻る
          </Link>
        </header>

        {/* 注意書き */}
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-300">
            <strong>注意:</strong> IPアドレスの観察はサービス運営のために必要な範囲内で実施されており、
            個人情報保護法に準拠しています。適切に管理してください。
          </p>
        </div>

        {/* ユーザー検索 */}
        <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <User size={20} className="mr-2 text-pink-400" />
            会員IP検索
          </h2>
          <div className="flex gap-4 mb-4">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'id' | 'email' | 'nickname' | 'query')}
              className="bg-gray-800 border-gray-700 rounded-md text-white px-4 py-2"
            >
              <option value="query">自動検索（ID/メール/ニックネーム）</option>
              <option value="id">ユーザーID</option>
              <option value="email">メールアドレス</option>
              <option value="nickname">ニックネーム</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'id' ? 'ユーザーIDを入力' : searchType === 'email' ? 'メールアドレスを入力' : searchType === 'nickname' ? 'ニックネームを入力' : 'ID、メール、ニックネームで検索'}
              className="flex-1 bg-gray-800 border-gray-700 rounded-md text-white placeholder-gray-500 px-4 py-2"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
            />
            <button
              onClick={handleSearchUser}
              disabled={loading || !searchQuery.trim()}
              className="bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center disabled:opacity-50"
            >
              <Search size={16} className="mr-2" />
              検索
            </button>
          </div>
          <p className="text-sm text-gray-400">
            💡 ヒント: ユーザー管理ページ (<Link href="/admin/users" className="text-pink-400 hover:underline">/admin/users</Link>) でユーザーIDを確認できます。
          </p>
        </div>

        {/* ユーザー一覧（検索結果） */}
        {showUserList && users.length > 0 && (
          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
            <h2 className="text-xl font-bold mb-4">検索結果 ({users.length}件)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">ニックネーム</th>
                    <th className="p-3 text-left">メール</th>
                    <th className="p-3 text-left">役割</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-3">{user.id}</td>
                      <td className="p-3">{user.nickname}</td>
                      <td className="p-3 text-gray-400">{user.email}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.role === 'SUPER_ADMIN' ? 'bg-red-600 text-white' :
                          user.role === 'ADMIN' ? 'bg-orange-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSelectUser(user.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded transition-colors"
                        >
                          詳細を見る
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ユーザーIP情報 */}
        {userIPInfo && (
          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50 mb-6">
            <h2 className="text-xl font-bold mb-4">ユーザー情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-400 text-sm">ユーザーID</p>
                <p className="text-white font-semibold">{userIPInfo.user.id}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">メールアドレス</p>
                <p className="text-white font-semibold">{userIPInfo.user.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">ニックネーム</p>
                <p className="text-white font-semibold">{userIPInfo.user.nickname}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">登録日時</p>
                <p className="text-white font-semibold">
                  {new Date(userIPInfo.user.registeredAt).toLocaleString('ja-JP')}
                </p>
              </div>
            </div>
            {userIPInfo.currentIp && (
              <div className="mb-4 p-4 bg-blue-900/30 border border-blue-600 rounded-lg">
                <p className="text-sm text-blue-300">
                  <strong>現在のリクエストIP:</strong> <span className="font-mono">{userIPInfo.currentIp}</span>
                </p>
              </div>
            )}
            {userIPInfo.sessions && userIPInfo.sessions.length > 0 ? (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">アクティブセッション ({userIPInfo.sessions.length}件)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="p-3 text-left">セッションID</th>
                        <th className="p-3 text-left">有効期限</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userIPInfo.sessions.map((session) => (
                        <tr key={session.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="p-3 font-mono text-sm">{session.id}</td>
                          <td className="p-3 text-gray-400">
                            {new Date(session.expires).toLocaleString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {userIPInfo.accessLogs.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">アクセスログ</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="p-3 text-left">IPアドレス</th>
                        <th className="p-3 text-left">アクセス日時</th>
                        <th className="p-3 text-left">パス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userIPInfo.accessLogs.map((log, index) => (
                        <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="p-3 font-mono">{log.ip}</td>
                          <td className="p-3 text-gray-400">
                            {new Date(log.timestamp).toLocaleString('ja-JP')}
                          </td>
                          <td className="p-3 text-gray-400">{log.path}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                {userIPInfo.message || 'アクセスログは将来の実装で表示されます。'}
              </p>
            )}
          </div>
        )}

        {/* アクティブセッション一覧 */}
        {recentSessions.length > 0 && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold flex items-center">
                <Eye size={20} className="mr-2 text-purple-400" />
                アクティブセッション一覧 ({recentSessions.length}件)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-4 text-left">ユーザーID</th>
                    <th className="p-4 text-left">ニックネーム</th>
                    <th className="p-4 text-left">メール</th>
                    <th className="p-4 text-left">役割</th>
                    <th className="p-4 text-left">セッション有効期限</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((session) => (
                    <tr key={session.sessionId} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-4">{session.userId}</td>
                      <td className="p-4">{session.userNickname}</td>
                      <td className="p-4 text-gray-400">{session.userEmail}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          session.userRole === 'SUPER_ADMIN' ? 'bg-red-600 text-white' :
                          session.userRole === 'ADMIN' ? 'bg-orange-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {session.userRole}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {new Date(session.expires).toLocaleString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* IP統計 */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-xl font-bold flex items-center">
              <Eye size={20} className="mr-2 text-purple-400" />
              IPアクセス統計
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">読み込み中...</div>
          ) : ipStats.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              IP統計データは将来の実装で表示されます。
              <br />
              （アクセスログテーブルから集計）
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="p-4 text-left">IPアドレス</th>
                    <th className="p-4 text-left">アクセス回数</th>
                  </tr>
                </thead>
                <tbody>
                  {ipStats.map((stat, index) => (
                    <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-4 font-mono">{stat.ip}</td>
                      <td className="p-4">{stat.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

