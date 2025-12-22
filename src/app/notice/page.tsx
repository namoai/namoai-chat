"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ChevronRight, PlusCircle } from 'lucide-react';
// ▼▼▼ 変更点: 型安全性のためにRole Enumをインポートします ▼▼▼
// Client Componentではビルドエラーを避けるため、PrismaのEnumを直接インポートせず、
// 文字列リテラルとして扱うか、別途定義します。
// ここではsessionのroleが文字列であることを前提に直接比較します。

// お知らせデータの型定義
type Notice = {
  id: number;
  category: string;
  title: string;
  createdAt: string;
};

export default function NoticesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/notice');
        if (!response.ok) {
          throw new Error('お知らせの読み込みに失敗しました。');
        }
        const data = await response.json();
        setNotices(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotices();
  }, []);

  const getCategoryClass = (category: string) => {
    switch (category) {
      case 'アップデート': return 'text-green-400';
      case '重要': return 'text-red-400';
      case 'イベント': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  // ▼▼▼ 変更点: 権限チェックのロジックを修正します ▼▼▼
  const userRole = session?.user?.role;
  const canCreateNotice = userRole === 'MODERATOR' || userRole === 'SUPER_ADMIN';

  if (isLoading) {
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
    <div className="bg-black min-h-screen text-white">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-24">
          <header className="flex items-center justify-between mb-6 sticky top-0 bg-black/80 backdrop-blur-xl z-10 py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-900/50 gap-2">
            <button 
              onClick={() => router.push('/MyPage')}
              className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all flex-shrink-0"
            >
              <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-base sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent flex-1 text-center px-2 truncate">
              お知らせ
            </h1>
            {canCreateNotice ? (
              <button 
                onClick={() => router.push('/notice/admin')}
                className="p-2 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all flex-shrink-0"
              >
                <PlusCircle size={20} className="sm:w-6 sm:h-6" />
              </button>
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0"></div>
            )}
          </header>

          <main>
            {notices.length > 0 ? (
              <div className="space-y-3">
                {notices.map((notice) => (
                  <button 
                    key={notice.id}
                    onClick={() => router.push(`/notice/${notice.id}`)}
                    className="w-full flex items-center justify-between p-5 bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800/50 hover:border-blue-500/30 hover:bg-gray-800/50 transition-all group"
                  >
                    <div className="flex-grow text-left min-w-0">
                      <p className={`text-sm font-bold mb-2 ${getCategoryClass(notice.category)}`}>
                        [{notice.category}]
                      </p>
                      <h2 className="text-white text-lg font-semibold mb-2 group-hover:text-blue-400 transition-colors truncate">
                        {notice.title}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {new Date(notice.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                    <ChevronRight className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 ml-4" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">登録されたお知らせがありません。</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}