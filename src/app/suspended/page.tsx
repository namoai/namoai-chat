"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Ban, LogOut } from 'lucide-react';

// useSearchParamsを使用するコンポーネントを分離
function SuspendedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [suspensionInfo, setSuspensionInfo] = useState({
    reason: '',
    until: '',
  });

  useEffect(() => {
    // URLパラメータから停止情報を取得
    const reason = searchParams.get('reason') || '不明な理由';
    const until = searchParams.get('until');
    
    if (until) {
      const untilDate = new Date(until);
      setSuspensionInfo({
        reason: reason,
        until: untilDate.toLocaleString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } else {
      setSuspensionInfo({
        reason: reason,
        until: '期限不明',
      });
    }
  }, [searchParams]);

  const handleLogout = async () => {
    // ログアウト前にrefresh tokenを無効化
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('ログアウトAPI呼び出しエラー:', error);
      // エラーが発生してもログアウト処理は続行
    }
    await signOut({ redirect: false });
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* 背景装飾 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-800/50 p-6 md:p-8">
          {/* アイコン */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-600/20 p-4 rounded-full ring-4 ring-red-500/20">
              <Ban size={64} className="text-red-500" />
            </div>
          </div>

          {/* タイトル */}
          <h1 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            アカウント停止中
          </h1>

          {/* 説明 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 space-y-4 border border-gray-700/50">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 mb-2">停止理由</h2>
              <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
                {suspensionInfo.reason}
              </p>
            </div>

            <div className="border-t border-gray-700/50 pt-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-2">停止期限</h2>
              <p className="text-white text-base">
                {suspensionInfo.until}
              </p>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-sm leading-relaxed">
              停止期間が経過するまで、このアカウントではログインできません。
              サポートが必要な場合は、お問い合わせください。
            </p>
          </div>

          {/* ログアウトボタン */}
          <button
            onClick={handleLogout}
            className="w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <LogOut size={20} />
            ログアウト
          </button>

          {/* フッター */}
          <p className="text-gray-500 text-xs text-center mt-6">
            このページについてのお問い合わせは、サポートチームまでご連絡ください。
          </p>
        </div>
      </div>
    </div>
  );
}

// メインコンポーネント（Suspenseで包む）
export default function SuspendedPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <SuspendedContent />
    </Suspense>
  );
}

