"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Ban, LogOut } from 'lucide-react';

export default function SuspendedPage() {
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
    await signOut({ redirect: false });
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-8">
        {/* アイコン */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-600/20 p-4 rounded-full">
            <Ban size={64} className="text-red-500" />
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-3xl font-bold text-white text-center mb-4">
          アカウント停止中
        </h1>

        {/* 説明 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2">停止理由</h2>
            <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
              {suspensionInfo.reason}
            </p>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">停止期限</h2>
            <p className="text-white text-base">
              {suspensionInfo.until}
            </p>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 text-sm leading-relaxed">
            停止期間が経過するまで、このアカウントではログインできません。
            サポートが必要な場合は、お問い合わせください。
          </p>
        </div>

        {/* ログアウトボタン */}
        <button
          onClick={handleLogout}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
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
  );
}

